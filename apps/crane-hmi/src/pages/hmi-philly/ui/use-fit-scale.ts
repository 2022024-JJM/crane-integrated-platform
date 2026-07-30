import { useEffect, useRef, useState } from 'react';

/**
 * 고정 설계 해상도 화면을 컨테이너에 맞춰 균등 축소/확대.
 * 컨테이너 비율이 설계 비율과 다르면 남는 축 방향으로 캔버스를 확장한
 * 크기(fillW/fillH)를 함께 반환해 레터박스 없이 화면을 꽉 채울 수 있게 한다.
 */
export function useFitScale(designW: number, designH: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: designW, h: designH });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = Math.min(size.w / designW, size.h / designH);
  return {
    ref,
    scale,
    /** 화면을 꽉 채우는 캔버스 크기 (설계 크기 이상, 한 축은 설계 크기와 동일) */
    fillW: size.w / scale,
    fillH: size.h / scale,
  };
}
