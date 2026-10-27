import { useSyncExternalStore } from 'react';

/** 휴대폰 폭 판정 — MRO2 는 이 폭 이하를 현장 모드로 보내고, 사이드바는 viewport 표식으로 메뉴를 거른다. */
export const MOBILE_MAX_WIDTH_PX = 767;
const QUERY = `(max-width: ${MOBILE_MAX_WIDTH_PX}px)`;

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const mql = window.matchMedia(QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}
function getSnapshot(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(QUERY).matches;
}

export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
