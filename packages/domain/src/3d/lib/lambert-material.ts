import {
  Material,
  MeshLambertMaterial,
  type MeshStandardMaterial,
} from 'three';

/**
 * PBR(MeshStandardMaterial) → 저비용 Lambert 변환 — 관제와 무관한 주변
 * 지형(카탈로그 kind 'context')용.
 *
 * 컨텍스트 지형은 화면의 큰 면적(수 km 도시)을 차지하는데 PBR 은 픽셀마다
 * GGX 스펙큘러·환경맵 radiance/irradiance 두 번 샘플링·다중 산란을 계산한다.
 * Lambert 는 조명(방향광·반구광·환경광)과 낮/밤에는 똑같이 반응하면서
 * 환경맵은 irradiance 한 번만 보고 스펙큘러가 없다 — 정점색(COLOR_0)·
 * 오버레이 텍스처는 그대로 살아 "멀리서 보이는 도시" 로는 구분되지 않는다.
 * 야드 지도(kind 'ground')·크레인은 PBR 그대로다(2026-09-11, "핵심인 지도와
 * 크레인만 잘 보이면 된다" 는 방향).
 *
 * 원본 머티리얼 하나당 변환본 하나를 WeakMap 으로 캐시해 같은 GLB 의 clone
 * 들이 공유한다(GLTF 캐시가 원본을 놓으면 함께 수거된다). 원본은 손대지
 * 않는다 — 다른 캔버스가 PBR 로 쓸 수 있다.
 */
const cache = new WeakMap<Material, MeshLambertMaterial>();

function isStandardLike(material: Material): material is MeshStandardMaterial {
  return (material as MeshStandardMaterial).isMeshStandardMaterial === true;
}

export function toLambertMaterial(material: Material): Material {
  if (!isStandardLike(material)) return material;
  const cached = cache.get(material);
  if (cached) return cached;

  const lambert = new MeshLambertMaterial({
    color: material.color,
    map: material.map,
    vertexColors: material.vertexColors,
    side: material.side,
    transparent: material.transparent,
    opacity: material.opacity,
    alphaTest: material.alphaTest,
    depthWrite: material.depthWrite,
    depthTest: material.depthTest,
    // 스펙큘러가 없는 재질이라 환경맵 반사(combine)도 쓰지 않는다 —
    // scene.environment 는 irradiance(확산)로만 들어온다.
    reflectivity: 0,
  });
  lambert.name = `${material.name}#lambert`;
  cache.set(material, lambert);
  return lambert;
}

/** 배열/단일 머티리얼 모두 — Mesh.material 에 그대로 되돌려 넣는다. */
export function toLambertMaterials(
  material: Material | Material[],
): Material | Material[] {
  return Array.isArray(material)
    ? material.map(toLambertMaterial)
    : toLambertMaterial(material);
}
