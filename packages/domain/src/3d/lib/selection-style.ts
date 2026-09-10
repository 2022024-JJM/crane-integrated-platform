/**
 * 3D 편집 화면에서 선택된 객체(모델/mesh/텍스트) 외곽선의 공통 스타일.
 * 선 두께는 screen-space px 단위(drei `<Line>` → LineMaterial.linewidth).
 */
export const SELECTION_LINE_COLOR = '#facc15';
export const SELECTION_LINE_WIDTH = 1;
/** 충돌 감지 하이라이트 박스 — 선택(노랑)과 구분되는 빨강, 조금 더 굵게. */
export const COLLISION_LINE_COLOR = '#ef4444';
export const COLLISION_LINE_WIDTH = 2;
/**
 * 충돌 **예측** 표시 — 민트(teal-400).
 *
 * 감지의 빨강·경고의 노랑과 색상환에서 멀어 한눈에 구분되고, 조선소 지형
 * (회갈색 아스팔트·바다)과도 겹치지 않아 반투명 고스트가 배경에 묻히지
 * 않는다. 주황이었을 때는 지형·석양 배경과 명도·색상이 가까워 형태가 잘
 * 안 읽혔다(2026-09-10 교체).
 *
 * 예측 표시는 실루엣 테두리를 쓰지 않는다 — 캔버스당 스텐실 참조값이 하나뿐
 * 이라 빨강 충돌 테두리와 동시에 뜨면 발자국이 전역 합집합이 되고 색
 * 우선순위가 draw 순서에 따라 정해진다(object-silhouette-outline 주석).
 */
export const PREDICTION_LINE_COLOR = '#2dd4bf';
/** `PREDICTION_LINE_COLOR` 의 rgb 성분 — inset box-shadow 등 rgba 가 필요한 곳. */
export const PREDICTION_LINE_RGB = '45, 212, 191';
export const PREDICTION_LINE_WIDTH = 2;
