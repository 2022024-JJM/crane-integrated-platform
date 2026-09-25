/**
 * 씬의 수면 높이(월드 y). 바다(features SceneWater), 떠 있는 모델의
 * 드롭 높이, 수면 아래 잠김 처리가 모두 이 값을 본다.
 *
 * 0인 이유: 드롭 배치의 ground plane 폴백이 y=0이고 지도 GLB 의 바닥이 그
 * 기준으로 놓여 있다. philly 지도 GLB 에도 `Sea` 머티리얼 평면(y≈0.59)이
 * 들어 있지만 최적화 스크립트가 단면으로 만든 아래 방향 면이라 위에서는
 * 컬링돼 그려지지 않는다 — 화면의 바다는 SceneWater 다.
 */
export const SEA_LEVEL_Y = 0;
