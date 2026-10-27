import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

export const FILL_MIN_HEIGHT_PX = 280;

function scrollParent(el: HTMLElement): HTMLElement | null {
  let p = el.parentElement;
  while (p) {
    const oy = getComputedStyle(p).overflowY;
    if (oy === 'auto' || oy === 'scroll') return p;
    p = p.parentElement;
  }
  return null;
}

/** 요소와 스크롤 조상 사이의 아래 패딩 합 — 그만큼은 채울 수 없는 공간이다. */
function paddingBelow(el: HTMLElement, scroller: HTMLElement | null): number {
  let sum = 0;
  let p: HTMLElement | null = el.parentElement;
  while (p) {
    sum += parseFloat(getComputedStyle(p).paddingBottom) || 0;
    if (p === scroller) break;
    p = p.parentElement;
  }
  return sum;
}

/**
 * 요소가 스크롤 영역 아래까지 꼭 차는 높이(px)와 현재 폭(px) — 위쪽 헤더가 몇 줄이든 페이지
 * 스크롤이 생기지 않게 한다. 창 크기와 위쪽 레이아웃 변화에 따라 다시 잰다.
 */
export function useFillHeight(
  bottomGap = 0,
): [RefObject<HTMLDivElement | null>, number | undefined, number | undefined] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);
  const [width, setWidth] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const scroller = scrollParent(el);
    const measure = () => {
      const top = el.getBoundingClientRect().top;
      const bottom = scroller
        ? scroller.getBoundingClientRect().bottom
        : window.innerHeight;
      const h = bottom - top - paddingBelow(el, scroller) - bottomGap;
      setHeight(Math.max(FILL_MIN_HEIGHT_PX, Math.floor(h)));
      setWidth(el.clientWidth || undefined);
    };
    measure();
    window.addEventListener('resize', measure);
    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(measure)
        : null;
    if (ro && el.parentElement) ro.observe(el.parentElement);
    return () => {
      window.removeEventListener('resize', measure);
      ro?.disconnect();
    };
  }, [bottomGap]);

  return [ref, height, width];
}
