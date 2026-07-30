import { useEffect, useRef, useState } from 'react';

/** 고정 설계 해상도 화면을 컨테이너에 맞춰 균등 축소/확대 */
export function useFitScale(designW: number, designH: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        setScale(Math.min(width / designW, height / designH));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [designW, designH]);

  return { ref, scale };
}
