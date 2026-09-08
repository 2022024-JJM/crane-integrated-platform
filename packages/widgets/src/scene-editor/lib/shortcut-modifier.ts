/**
 * 수식키 표기 — Mac 에서는 Ctrl 대신 ⌘ 가 실제로 동작하는 키다(편집기
 * 핸들러가 ctrlKey || metaKey 를 받는다). 모듈 상수라 렌더마다 재계산되지
 * 않는다. 단축키 도움말과 도구 모음 툴팁이 함께 쓴다.
 */
export const SHORTCUT_MOD =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad/.test(navigator.platform ?? '')
    ? '⌘'
    : 'Ctrl';
