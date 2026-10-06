/**
 * `window.devicePixelRatio` 변화 구독 — 창을 배율이 다른 모니터로 옮기거나
 * 브라우저 확대를 바꾸면 값이 바뀐다. 이벤트가 따로 없어 "지금 값과 같은
 * 해상도" 미디어 쿼리가 어긋나는 순간을 듣고, 어긋날 때마다 새 값으로 다시
 * 건다(MDN 의 devicePixelRatio 감시 패턴).
 *
 * matchMedia 가 없는 환경(SSR·jsdom)에서는 아무것도 걸지 않는다 — 값은
 * 마운트 시점 그대로 쓰인다.
 */
export function subscribeDevicePixelRatio(onChange: () => void): () => void {
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return () => {};
  }

  let media: MediaQueryList | null = null;
  const handleChange = () => {
    arm();
    onChange();
  };
  const disarm = () => {
    media?.removeEventListener('change', handleChange);
    media = null;
  };
  const arm = () => {
    disarm();
    media = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    media.addEventListener('change', handleChange);
  };

  arm();
  return disarm;
}

export function getDevicePixelRatio(): number {
  return typeof window === 'undefined' ? 1 : window.devicePixelRatio;
}
