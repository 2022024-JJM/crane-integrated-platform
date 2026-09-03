/**
 * 지도 위 오버레이의 재질·치수 정의.
 *
 * 두 번의 되돌림이 이 파일에 남아 있다.
 *
 * 1차 — HUD 코스튬(코너 브래킷, `uppercase tracking-[0.14em]`, 회전 스캔
 * 섹터)을 걷어내고 재질과 깊이로 위계를 만들기로 했다.
 *
 * 2차(현재) — 그 유리가 **보이지 않았다.** 구글 로드맵은 거의 흰 바탕이라
 * 흰 반투명 판은 명도차가 0이 되고, 윤곽을 맡던 것이 7% 헤어라인과 40px
 * 넘게 번진 그림자뿐이라 판이 배경에 녹았다. 게다가 판을 전부 `rounded-full`
 * 알약으로 깎아 놨는데, 이 앱의 반지름 토큰은 `--radius: 0.25rem`(4px)이다.
 * 화면의 다른 모든 카드·버튼이 각진 4px 인데 지도 위만 완전 원형이라
 * 같은 제품으로 보이지 않았다.
 *
 * 그래서 지금 규칙은 이렇다.
 *  - **윤곽이 재질보다 먼저다.** 유리의 존재는 진한 헤어라인 + 짧고 또렷한
 *    접촉 그림자가 만든다. 구글 자체 컨트롤이 흰 지도 위에서 살아남는 방식과
 *    같다(흰 판 + 진한 근거리 그림자). 번짐만 큰 그림자는 얼룩으로 읽힌다.
 *  - **굴절은 그 다음이다.** `backdrop-blur` + `backdrop-saturate` 는 위성
 *    영상처럼 복잡한 배경에서 글자 바닥을 만들고 유리감을 준다. 채도를 올리는
 *    쪽이 핵심으로, 이게 없으면 뒤의 지도가 회색으로 죽어 플라스틱이 된다.
 *  - **반지름은 앱 토큰을 따른다.** 지도 위라고 다른 기하를 쓰지 않는다.
 *
 * ⚠ **클래스 하나는 문자열 리터럴 하나 안에 온전히 들어가야 한다.**
 * Tailwind 는 소스를 텍스트로 훑어 후보를 뽑으므로, `'shadow-[inset_0_1px_0_...' +`
 * 처럼 클래스 중간을 잘라 이어 붙이면 어느 쪽 조각도 후보가 되지 못해 규칙이
 * 통째로 생성되지 않는다. 실제로 이 파일의 GLASS_DEPTH 가 그렇게 잘려 있어서
 * 오버레이에 그림자가 하나도 없었다. 줄이 길어지면 상수를 쪼개되 자르는 자리는
 * 반드시 클래스 경계다.
 */

/** 굴절 + 본체. 라이트는 밝은 서리, 다크는 스모크 글라스. */
export const GLASS_BODY =
  'backdrop-blur-xl backdrop-saturate-[1.7] bg-white/80 dark:bg-[rgb(18_20_24)]/78';

/**
 * 모서리 하이라이트 + 접촉/주변 그림자.
 * 접촉(1~2px)이 판을 지도에서 떼어 놓고, 주변(10~28px)이 무게를 준다.
 * 이전 버전은 주변 그림자만 크게 번져 있어서 판의 바닥이 보이지 않았다.
 */
const GLASS_SHADOW_LIGHT =
  'shadow-[inset_0_1px_0_rgb(255_255_255/0.85),0_1px_2px_rgb(0_0_0/0.16),0_4px_10px_-2px_rgb(0_0_0/0.22),0_12px_28px_-12px_rgb(0_0_0/0.3)]';

const GLASS_SHADOW_DARK =
  'dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_1px_2px_rgb(0_0_0/0.55),0_6px_16px_-4px_rgb(0_0_0/0.6),0_16px_36px_-16px_rgb(0_0_0/0.7)]';

export const GLASS_DEPTH = `${GLASS_SHADOW_LIGHT} ${GLASS_SHADOW_DARK}`;

/**
 * 헤어라인 테두리. 흰 지도 위에서 판의 윤곽을 세우는 것이 이 한 줄이라
 * 여기서 인색하게 굴면 유리가 통째로 사라진다.
 */
export const GLASS_EDGE = 'border border-black/[0.14] dark:border-white/[0.14]';

/**
 * 오버레이 반지름 — 앱 토큰 `--radius`(4px)를 그대로 쓴다.
 * 안쪽 요소는 한 단계 작은 `rounded-sm` 으로 동심을 맞춘다.
 */
export const GLASS_RADIUS = 'rounded-lg';

/** 판 하나를 이루는 전체 */
export const GLASS_SURFACE = `${GLASS_BODY} ${GLASS_EDGE} ${GLASS_DEPTH} ${GLASS_RADIUS}`;

/**
 * 오버레이 판의 표준 높이.
 *
 * 이전 40px 은 지도 위에서 너무 작았다 — 지도 타일 자체가 잔글씨투성이라
 * 그 위에 얹히는 컨트롤은 앱 안의 같은 컨트롤보다 오히려 커야 덩어리로
 * 잡힌다. 44px 은 터치 타깃 최소치와도 맞는다.
 */
export const MAP_OVERLAY_PLATE = 'h-11';

/**
 * 오버레이 안 라벨의 기본 타이포.
 *
 * 이전 오버레이는 전부 `uppercase tracking-[0.14em]` 였다. 라틴 문자에서는
 * HUD 느낌을 주지만 한글에서는 uppercase 가 무효이고 자간만 벌어져
 * "지 도" "위 성" 처럼 읽힌다. 오버레이 라벨은 세 언어(ko/en/la)를 모두
 * 담으므로 자간을 원래대로 되돌리고 크기·굵기로 위계를 만든다.
 */
export const MAP_OVERLAY_LABEL = 'text-sm leading-none font-medium';
