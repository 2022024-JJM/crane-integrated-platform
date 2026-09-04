/**
 * 편집기 도구 모음의 표면 클래스.
 *
 * 그룹 구분은 위치와 간격(gap)만으로 한다. 캡슐은 "뷰포트 안에 떠 있는
 * 오버레이" 의 표식이지 그룹 표식이 아니다 — 뷰포트 밖 헤더 바는 캡슐
 * 없이 평평한 크롬이고, 뷰포트 안 선택 컨텍스트 바만 이 캡슐을 쓴다. 같은
 * 그룹 안의 소분류 경계에만 구분선을 둔다.
 *
 * ui/ 파일에 두면 react-refresh 규칙(컴포넌트 파일의 non-component export)
 * 에 걸려 lib/ 에 둔다.
 */
export const EDITOR_OVERLAY_SURFACE_CLASS =
  'bg-background/95 border-border/80 flex items-center gap-0.5 rounded-lg border p-px shadow-sm backdrop-blur-sm';

/** 같은 그룹 안 소분류 구분선(가로 도구 모음용 세로선). */
export const EDITOR_TOOLBAR_DIVIDER_CLASS = 'bg-border mx-0.5 h-4 w-px';
