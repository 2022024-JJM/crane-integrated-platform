/**
 * 지형 타일 LOD 선택 — 스크린 공간 오차 기반의 순수 수식.
 *
 * 타일 GLB(scripts/tile-terrain-glb.mjs --lod)는 타일마다 기하 오차 상한이
 * 다른 LOD 인덱스(0=원본, 1=2m, 2=4m, 3=8m)를 갖는다. 어떤 LOD 의 오차
 * `e`(미터)가 카메라 거리 `d` 에서 화면에 차지하는 크기는
 *
 *   px = e × pixelFactor / d,  pixelFactor = 뷰포트 세로 device px / (2·tan(fov/2))
 *
 * 이고, px 가 임계(TERRAIN_LOD_THRESHOLD_PX) 미만이면 그 LOD 를 쓴다 —
 * Unity/Unreal 이 쓰는 것과 같은 스크린 오차 기준이다(1px 이면 원본과 구분
 * 불가, 지금은 주변 지형이라 2.5px 를 허용).
 *
 * 히스테리시스: 경계 거리에서 카메라가 미세하게 흔들리면 LOD 가 매 프레임
 * 튀며 깜빡인다(popping). 거칠어지는 전환(level↑)에만 마진을 요구하고,
 * 세밀해지는 전환(level↓ = 품질 방향)은 즉시 허용한다.
 */

/**
 * LOD 전환 임계(device px). 1 이면 서브픽셀(원본과 구분 불가)이었는데
 * 2026-09-11 에 2.5 로 올렸다 — 타일 LOD 는 컨텍스트 지형(관제와 무관한
 * 주변 도시)에만 있고, 2.5px 오차는 그 지형에서 눈에 띄지 않으면서 먼
 * 타일이 한두 단계 더 성긴 LOD 로 내려가 화면 삼각형이 준다. 야드 지도·
 * 크레인은 LOD 가 없어 영향이 없다.
 */
export const TERRAIN_LOD_THRESHOLD_PX = 2.5;

/** 거칠어지는 전환에 요구하는 추가 마진 비율. */
export const TERRAIN_LOD_HYSTERESIS = 0.15;

/**
 * 월드 오차(m) → 화면 px 환산 계수. `heightPx` 는 **device px**(CSS px ×
 * DPR = gl.drawingBufferHeight)다 — CSS px 로 주면 DPR 1.5 만큼 관대해져
 * 서브픽셀 보장이 깨진다.
 */
export function terrainLodPixelFactor(
  fovDeg: number,
  heightPx: number,
): number {
  // 퇴화 fov(0·180 근처)는 0 — tan 이 폭주하거나 0 이 되어 어느 쪽이든
  // 판정이 무의미하다. 0 을 받은 selectTerrainLod 는 원본(LOD0)을 유지한다.
  if (!(fovDeg > 0) || !(fovDeg < 180) || !(heightPx > 0)) return 0;
  const tanHalf = Math.tan((fovDeg * Math.PI) / 360);
  if (!Number.isFinite(tanHalf) || tanHalf <= 0) return 0;
  return heightPx / (2 * tanHalf);
}

/**
 * 타일 하나의 LOD 레벨 선택.
 *
 * @param lodErrors 레벨별 기하 오차 상한(m), 오름차순. [0]은 원본이라 0.
 * @param distance  카메라 → 타일 AABB 최근접 거리(m). 0 이하는 원본.
 * @param pixelFactor terrainLodPixelFactor 결과. 0 이하는 원본(방어).
 * @param currentLevel 직전 레벨(히스테리시스 기준). 범위 밖은 0 취급.
 */
export function selectTerrainLod(
  lodErrors: readonly number[],
  distance: number,
  pixelFactor: number,
  currentLevel: number,
): number {
  if (lodErrors.length === 0) return 0;
  const clampedCurrent =
    currentLevel >= 0 && currentLevel < lodErrors.length ? currentLevel : 0;
  if (!(distance > 0) || !(pixelFactor > 0)) return 0;

  // 임계 미만인 가장 거친 레벨 = 이상적 레벨.
  let ideal = 0;
  for (let level = lodErrors.length - 1; level >= 1; level -= 1) {
    const px = (lodErrors[level] * pixelFactor) / distance;
    if (px < TERRAIN_LOD_THRESHOLD_PX) {
      ideal = level;
      break;
    }
  }

  if (ideal <= clampedCurrent) {
    // 세밀해지는 방향(또는 유지) — 품질이 좋아지는 쪽이라 즉시.
    return ideal;
  }

  // 거칠어지는 방향 — 마진까지 여유가 있어야 전환(경계 떨림 방지).
  const px = (lodErrors[ideal] * pixelFactor) / distance;
  if (px < TERRAIN_LOD_THRESHOLD_PX / (1 + TERRAIN_LOD_HYSTERESIS)) {
    return ideal;
  }
  return clampedCurrent;
}

/**
 * LOD 캐리어 판정·그룹 키 — 노드 userData(GLTF extras)에서 읽는다.
 * - 지형 타일(tile-terrain-glb.mjs --lod): { tile:[x,z], lod, lodError }
 * - 모델(add-model-lod.mjs): { lodGroup:'<키>', lod, lodError }
 * 같은 루트(인스턴스) 안에서 키가 같은 노드들이 한 LOD 그룹이다. 호출자가
 * 루트 uuid 를 앞에 붙여 인스턴스 간 충돌을 막는다. 캐리어가 아니면 null.
 */
export function lodCarrierKey(userData: unknown): string | null {
  if (!userData || typeof userData !== 'object') return null;
  const data = userData as {
    tile?: unknown;
    lodGroup?: unknown;
    lod?: unknown;
  };
  if (typeof data.lod !== 'number' || !Number.isFinite(data.lod)) return null;
  if (Array.isArray(data.tile)) return `tile:${data.tile.join(',')}`;
  if (typeof data.lodGroup === 'string' && data.lodGroup.length > 0) {
    return `group:${data.lodGroup}`;
  }
  return null;
}
