import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

/**
 * prefers-reduced-motion 미디어 쿼리 훅.
 * 충돌 감지 레이어의 머티리얼라이즈 스윕·스케일 오버슈트·카메라 플라이트가
 * 공유한다 — 세 곳의 폴백 동작이 항상 일관되도록 단일 소스로 둔다.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches,
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(QUERY);
    const handleChange = (event: MediaQueryListEvent) => {
      setReduced(event.matches);
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return reduced;
}
