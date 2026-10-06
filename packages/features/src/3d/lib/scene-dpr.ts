/**
 * 캔버스 픽셀 비율(DPR) — 기본 범위와, PC 별 해상도 배율을 얹은 값.
 *
 * ui 가 아니라 lib 에 있는 이유: 배율 적용이 수치 계산이라 여기서 테스트하고,
 * 훅(model/use-scene-canvas-dpr)이 ui 를 거꾸로 참조하지 않게 한다.
 */

/**
 * 캔버스 픽셀 비율 상한.
 *
 * Retina(DPR 2~3)에서 네이티브로 그리면 프래그먼트 수가 1.8~4배로 늘어
 * 지도급 씬(philly 지도 42만 삼각형)에서 프레임 예산을 다 먹는다. 1.5는
 * 골리앗 충돌가드 모드에서 먼저 검증된 값 — 라벨은 DOM(Html)이라 텍스트
 * 선명도와 무관하고, MSAA(antialias)가 켜져 있어 엣지도 깨끗하다.
 * 2026-09-11 발열 절감 때 1.25 로 내렸다가 되돌렸다 — 핵심(야드 지도·
 * 크레인)의 선명도가 우선이고, 절감은 주변 지형 Lambert·LOD·바다 반사 제외
 * (미러 패스)처럼 관제와 무관한 곳에서 한다. 느린 PC 는 이 값을 내리지 않고
 * 그 PC 의 해상도 배율(resolveSceneDpr)을 내린다.
 *
 * ThreeSceneViewer(@crane/ui)의 기본값도 같은 [1, 1.5]다 — 그 패키지는
 * features를 참조할 수 없어(SCENE_CAMERA_CLIP과 같은 사정) 리터럴로 들고
 * 있다. 여기 값을 바꾸면 three-scene-viewer.tsx의 기본값도 같이 바꿀 것.
 */
export const SCENE_DEFAULT_DPR = [1, 1.5] as const;

/**
 * 해상도 배율을 얹은 Canvas `dpr` 값.
 *
 * 배율 1(기본)은 기본 범위를 그대로 돌려준다 — R3F 가 기기 값을 그 범위로
 * 클램프하는 원래 경로다. 1 미만이면 "기본 범위로 클램프한 기기 값 × 배율"
 * 숫자 하나다. 범위에 배율을 곱해 넘기지 않는다 — 기기 값이 1 인 PC 는
 * [0.7, 1.05] 안이라 그대로 1 이 되어 아무것도 줄지 않는다.
 *
 * 배율이 (0, 1) 밖이거나 비유한이면 기본 범위다. 기기 값이 비유한·0 이하면
 * 범위 하한으로 본다.
 */
export function resolveSceneDpr(
  devicePixelRatio: number,
  renderScale: number,
): number | [number, number] {
  const [min, max] = SCENE_DEFAULT_DPR;
  if (!Number.isFinite(renderScale) || renderScale <= 0 || renderScale >= 1) {
    return [min, max];
  }
  const device =
    Number.isFinite(devicePixelRatio) && devicePixelRatio > 0
      ? devicePixelRatio
      : min;
  return Math.min(max, Math.max(min, device)) * renderScale;
}
