import {
  Box3,
  Vector3,
  type BufferGeometry,
  type Material,
  type Mesh,
  type Object3D,
  type Texture,
} from 'three';
import type { AssetStats } from '@crane/domain/asset-library';

/**
 * 로드된 GLB(Object3D)의 기하 통계.
 *
 * scripts/asset-library-stats.mjs(배포 파일을 gltf-transform 으로 재는
 * 스크립트)와 같은 기준을 쓴다 — LOD 사본(extras `lod > 0`)은 한 시점에 한
 * 단계만 보이므로 렌더 기준(삼각형·드로우콜·메쉬·크기)에서 빼고, 고유
 * 지오메트리·머티리얼·텍스처는 한 번만 센다.
 */

const MIPMAP_OVERHEAD = 1.33;

/** 머티리얼에서 텍스처가 들어갈 수 있는 슬롯. */
const TEXTURE_SLOTS = [
  'map',
  'normalMap',
  'roughnessMap',
  'metalnessMap',
  'aoMap',
  'emissiveMap',
  'alphaMap',
  'bumpMap',
  'displacementMap',
  'lightMap',
  'envMap',
  'clearcoatMap',
  'clearcoatNormalMap',
  'clearcoatRoughnessMap',
  'transmissionMap',
  'thicknessMap',
  'sheenColorMap',
  'sheenRoughnessMap',
  'specularColorMap',
  'specularIntensityMap',
] as const;

export function getLodLevel(object: Object3D): number {
  const lod = (object.userData as { lod?: unknown }).lod;
  return typeof lod === 'number' && Number.isFinite(lod) && lod > 0
    ? Math.floor(lod)
    : 0;
}

/** 자신 또는 조상이 LOD 사본(lod > 0)인지. */
export function isInsideLodCopy(object: Object3D, root: Object3D): boolean {
  for (let node: Object3D | null = object; node; node = node.parent) {
    if (getLodLevel(node) > 0) return true;
    if (node === root) break;
  }
  return false;
}

const scratchVertex = new Vector3();

/**
 * 측정 전 행렬 갱신. 조상까지 올린 뒤 `updateMatrixWorld` 로 내려간다 —
 * SkinnedMesh 는 바인드 역행렬을 `updateMatrixWorld` 재정의에서만 맞추고,
 * `updateWorldMatrix` 는 그 재정의를 거치지 않는다. 아직 한 번도 그리지 않은
 * 사본은 역행렬이 낡아 있어, 그대로 재면 스킨 정점에 메쉬 노드의 행렬이 한 번
 * 더 곱해진다.
 */
function updateMatricesForMeasure(root: Object3D) {
  root.updateWorldMatrix(true, false);
  root.updateMatrixWorld(true);
}

/**
 * 메쉬의 월드 경계를 **정점 단위로** 상자에 더한다. 지오메트리 AABB 를 월드
 * 행렬로 옮기면 회전한 메쉬에서 상자가 부풀어(기울어진 선체가 실제보다 수 m
 * 길게) 치수 표기가 틀린다. 측정은 로드당 한 번이라 정점 수에 비례하는
 * 비용을 치른다.
 *
 * 정점은 `getVertexPosition` 으로 읽는다 — 화면에 그려지는 위치(스킨 메쉬는
 * 뼈대, 모프 타깃은 영향값을 적용한 뒤)다. 스킨 메쉬의 position 속성은 뼈대
 * 없이는 뜻이 없다: 메쉬 노드의 행렬은 무시되고, 양자화한 파일은 복원 변환이
 * 역바인드 행렬에 들어 있다. 일반 메쉬는 position 속성과 같은 값이다.
 */
function expandBoxByMesh(box: Box3, mesh: Mesh) {
  const position = mesh.geometry.getAttribute('position');
  if (!position) return;
  for (let i = 0; i < position.count; i += 1) {
    mesh.getVertexPosition(i, scratchVertex).applyMatrix4(mesh.matrixWorld);
    box.expandByPoint(scratchVertex);
  }
}

function countTriangles(geometry: BufferGeometry): number {
  const count = geometry.index
    ? geometry.index.count
    : (geometry.getAttribute('position')?.count ?? 0);
  return Math.floor(count / 3);
}

function estimateTextureBytes(texture: Texture): number {
  const compressed = texture as Texture & {
    isCompressedTexture?: boolean;
    mipmaps?: { data?: { byteLength?: number } }[];
  };
  if (compressed.isCompressedTexture && Array.isArray(compressed.mipmaps)) {
    // GPU 압축 텍스처(KTX2)는 압축된 채로 상주한다 — 밉 데이터 크기가 곧 메모리.
    return compressed.mipmaps.reduce(
      (sum, mip) => sum + (mip.data?.byteLength ?? 0),
      0,
    );
  }
  const image = texture.image as
    | { width?: number; height?: number }
    | null
    | undefined;
  const width = image?.width ?? 0;
  const height = image?.height ?? 0;
  if (!(width > 0) || !(height > 0)) return 0;
  return Math.round(width * height * 4 * MIPMAP_OVERHEAD);
}

function collectTextures(material: Material, into: Set<Texture>) {
  const slots = material as unknown as Record<string, unknown>;
  for (const slot of TEXTURE_SLOTS) {
    const value = slots[slot] as (Texture & { isTexture?: boolean }) | undefined;
    if (value?.isTexture) into.add(value);
  }
}

export function computeObjectStats(
  root: Object3D,
  animations = 0,
): AssetStats {
  updateMatricesForMeasure(root);

  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  const bounds = new Box3();
  let triangles = 0;
  let meshes = 0;
  let drawCalls = 0;
  let nodes = 0;
  let maxLod = 0;

  root.traverse((object) => {
    nodes += 1;
    maxLod = Math.max(maxLod, getLodLevel(object));
    const mesh = object as Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;

    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of list) {
      if (!material) continue;
      materials.add(material);
      collectTextures(material, textures);
    }
    geometries.add(mesh.geometry);

    if (isInsideLodCopy(mesh, root)) return;
    meshes += 1;
    triangles += countTriangles(mesh.geometry);
    // 머티리얼 그룹마다 드로우콜이 하나씩 나간다.
    drawCalls += Array.isArray(mesh.material)
      ? Math.max(1, mesh.geometry.groups.length || mesh.material.length)
      : 1;

    expandBoxByMesh(bounds, mesh);
  });

  let vertices = 0;
  for (const geometry of geometries) {
    vertices += geometry.getAttribute('position')?.count ?? 0;
  }
  let textureMemoryBytes = 0;
  for (const texture of textures) {
    textureMemoryBytes += estimateTextureBytes(texture);
  }

  const size = bounds.isEmpty() ? null : bounds.getSize(new Vector3());

  return {
    triangles,
    vertices,
    meshes,
    materials: materials.size,
    textures: textures.size,
    drawCalls,
    nodes,
    textureMemoryBytes,
    size: size ? [size.x, size.y, size.z] : null,
    lodLevels: maxLod + 1,
    animations,
  };
}

/** LOD 사본을 뺀 월드 경계 상자. 메쉬가 없으면 빈 상자. */
export function computeRenderBounds(root: Object3D, target = new Box3()): Box3 {
  updateMatricesForMeasure(root);
  target.makeEmpty();
  root.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (isInsideLodCopy(mesh, root)) return;
    expandBoxByMesh(target, mesh);
  });
  return target;
}
