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
 * 인스펙터 노드 선택기 미리보기(하이라이트한 노드) 테두리 — 선택(노랑)·충돌
 * (빨강)·상태 외곽선(흰·노랑·빨강)과 겹치지 않는 하늘색.
 */
export const NODE_PREVIEW_OUTLINE_COLOR = '#38bdf8';
/** 미리보기 중 같은 모델의 나머지 메시에 곱하는 불투명도(lib/ghost-opacity.ts). */
export const NODE_PREVIEW_GHOST_OPACITY = 0.15;
