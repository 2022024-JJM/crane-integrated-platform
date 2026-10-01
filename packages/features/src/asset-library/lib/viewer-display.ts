import {
  Color,
  MeshBasicMaterial,
  MeshNormalMaterial,
  MeshStandardMaterial,
  type Material,
  type Mesh,
  type Object3D,
} from 'three';
import { getLodLevel } from './model-geometry-stats';

/**
 * 자산 뷰어의 표시 상태 — 뷰 모드(머티리얼 교체)와 LOD 단계 미리보기.
 *
 * 뷰어는 캐시된 GLTF 의 **사본**을 그리지만 머티리얼·지오메트리는 원본과
 * 공유한다. 그래서 원본 머티리얼을 고치지 않고, 메쉬의 material 슬롯만
 * 바꿨다가 되돌린다.
 */

export const ASSET_VIEW_MODES = ['lit', 'clay', 'wireframe', 'normals'] as const;
export type AssetViewMode = (typeof ASSET_VIEW_MODES)[number];

export interface ViewModeMaterials {
  clay: MeshStandardMaterial;
  wireframe: MeshBasicMaterial;
  normals: MeshNormalMaterial;
}

export function createViewModeMaterials(
  wireframeColor: string,
): ViewModeMaterials {
  return {
    // 형태만 보는 단색 — 텍스처·색을 걷어내 실루엣과 면 흐름이 드러난다.
    clay: new MeshStandardMaterial({
      color: new Color('#b9bcc2'),
      roughness: 0.85,
      metalness: 0,
    }),
    wireframe: new MeshBasicMaterial({
      color: new Color(wireframeColor),
      wireframe: true,
    }),
    normals: new MeshNormalMaterial(),
  };
}

export function disposeViewModeMaterials(materials: ViewModeMaterials) {
  materials.clay.dispose();
  materials.wireframe.dispose();
  materials.normals.dispose();
}

/** 메쉬 → 원래 머티리얼. `lit` 으로 돌아올 때 되돌리는 데 쓴다. */
export type OriginalMaterialMap = Map<Mesh, Material | Material[]>;

/**
 * 뷰 모드를 적용한다. 처음 교체하는 메쉬의 원본 머티리얼을 `originals` 에
 * 적어 두고, `lit` 이면 전부 되돌린다. 같은 모드를 다시 적용해도 안전하다.
 */
export function applyViewMode(
  root: Object3D,
  mode: AssetViewMode,
  materials: ViewModeMaterials,
  originals: OriginalMaterialMap,
) {
  root.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    if (!originals.has(mesh)) originals.set(mesh, mesh.material);
    const original = originals.get(mesh)!;
    mesh.material = mode === 'lit' ? original : materials[mode];
  });
}

/**
 * LOD 묶음의 키. 지형 타일은 `tile`, 모델 LOD 는 `lodGroup` 을 extras 로
 * 갖는다(tile-terrain-glb.mjs·add-model-lod.mjs). 둘 다 없으면 null.
 */
function getLodGroupKey(object: Object3D): string | null {
  const data = object.userData as { tile?: unknown; lodGroup?: unknown };
  if (data.tile !== undefined && data.tile !== null) {
    return `tile:${String(data.tile)}`;
  }
  if (data.lodGroup !== undefined && data.lodGroup !== null) {
    return `group:${String(data.lodGroup)}`;
  }
  return null;
}

interface LodCarrier {
  object: Object3D;
  level: number;
  group: string;
}

/** LOD 묶음에 속한 최상위 캐리어만 모은다 — 캐리어의 자손은 건너뛴다. */
function collectLodCarriers(root: Object3D): LodCarrier[] {
  const carriers: LodCarrier[] = [];
  const visit = (object: Object3D) => {
    const group = getLodGroupKey(object);
    if (group !== null) {
      carriers.push({ object, level: getLodLevel(object), group });
      return;
    }
    for (const child of object.children) visit(child);
  };
  visit(root);
  return carriers;
}

/** 이 모델이 가진 LOD 단계 수. LOD 가 없으면 1. */
export function countLodLevels(root: Object3D): number {
  return (
    collectLodCarriers(root).reduce(
      (max, carrier) => Math.max(max, carrier.level),
      0,
    ) + 1
  );
}

/**
 * 한 LOD 단계만 보이게 한다. 묶음마다 단계 수가 다를 수 있어, 요청한 단계가
 * 없는 묶음은 그 묶음의 가장 거친 단계를 보인다(실제 런타임 전환과 같은
 * 폴백). LOD 가 없는 모델에는 아무 일도 하지 않는다.
 */
export function applyLodLevel(root: Object3D, level: number) {
  const carriers = collectLodCarriers(root);
  const maxByGroup = new Map<string, number>();
  for (const carrier of carriers) {
    maxByGroup.set(
      carrier.group,
      Math.max(maxByGroup.get(carrier.group) ?? 0, carrier.level),
    );
  }
  for (const carrier of carriers) {
    const target = Math.min(level, maxByGroup.get(carrier.group) ?? 0);
    carrier.object.visible = carrier.level === target;
  }
}
