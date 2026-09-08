/**
 * 씬의 수면 높이(월드 y). 바다 평면(features SeaSurface), 떠 있는 모델의
 * 드롭 높이, 수면 아래 클리핑이 모두 이 값을 본다.
 *
 * 0인 이유: 지도 GLB 안의 바다 평면(philly `Sea` 머티리얼)이 y≈-0.017에
 * 있어 사실상 0이고, 드롭 배치의 ground plane 폴백도 y=0이다.
 */
export const SEA_LEVEL_Y = 0;
