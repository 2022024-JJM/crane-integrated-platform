import { Material, type MeshStandardMaterial } from 'three';

/**
 * PBR(MeshStandardMaterial) → 무광 변환 — 환경 객체(야드 지도)용.
 *
 * 태양 방향광과 EXR 환경맵이 roughness 가 낮거나 metalness 가 있는 면에서
 * 스펙큘러 하이라이트·하늘 반사로 번들거린다. 지도 GLB 는 디자이너 기본값
 * (roughness 0.5)을 그대로 들고 오고 일부 도크·지붕은 metalness 1 이라,
 * 안벽·바닥·지붕이 하늘을 비추며 눈부시다. 그래서 환경 객체는 roughness 를
 * MATTE_ROUGHNESS_MIN 아래로 내려가지 못하게 하고 metalness 를 0 으로 둔다.
 *
 * roughnessMap·metalnessMap 은 뗀다 — three 는 factor × 텍셀로 계산하므로
 * 맵이 남으면 하한을 보장할 수 없다. 두 맵은 보통 같은 텍스처(glTF 의
 * metallicRoughness)라 텍스처 샘플 하나가 함께 빠진다.
 *
 * 원본은 손대지 않는다 — drei GLTF 캐시가 캔버스 간에 공유하므로 자산
 * 라이브러리 뷰어 등 다른 캔버스는 파일 그대로 본다. 원본 하나당 변환본
 * 하나를 WeakMap 으로 캐시해 같은 GLB 의 clone 들이 공유한다
 * (lambert-material.ts 와 같은 구조). 이미 조건을 만족하는 머티리얼은 그대로
 * 돌려 프로그램이 늘지 않게 한다.
 */

/** 환경 객체의 roughness 하한. 이 아래는 태양 하이라이트가 또렷해진다. */
export const MATTE_ROUGHNESS_MIN = 0.85;

const cache = new WeakMap<Material, Material>();

function isStandardLike(material: Material): material is MeshStandardMaterial {
  return (material as MeshStandardMaterial).isMeshStandardMaterial === true;
}

/** 변환할 것이 없는가 — roughness 하한 이상, 비금속, 두 맵 없음. */
export function isMatteMaterial(material: MeshStandardMaterial): boolean {
  return (
    material.metalness === 0 &&
    material.metalnessMap === null &&
    material.roughness >= MATTE_ROUGHNESS_MIN &&
    material.roughnessMap === null
  );
}

export function toMatteMaterial(material: Material): Material {
  if (!isStandardLike(material)) return material;
  if (isMatteMaterial(material)) return material;
  const cached = cache.get(material);
  if (cached) return cached;

  // clone 은 클래스를 유지한다(Physical 이면 Physical) — 색·맵·정점색·면·
  // 투명도 등 나머지는 그대로 물려받고 반사에 관한 넷만 고친다.
  const matte = material.clone();
  matte.metalness = 0;
  matte.metalnessMap = null;
  matte.roughness = Number.isFinite(material.roughness)
    ? Math.max(material.roughness, MATTE_ROUGHNESS_MIN)
    : MATTE_ROUGHNESS_MIN;
  matte.roughnessMap = null;
  matte.name = `${material.name}#matte`;
  cache.set(material, matte);
  return matte;
}

/** 배열/단일 머티리얼 모두 — Mesh.material 에 그대로 되돌려 넣는다. */
export function toMatteMaterials(
  material: Material | Material[],
): Material | Material[] {
  return Array.isArray(material)
    ? material.map(toMatteMaterial)
    : toMatteMaterial(material);
}
