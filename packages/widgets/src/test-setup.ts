/**
 * jsdom은 canvas 2D 컨텍스트를 구현하지 않아 getContext가 null을 돌려준다.
 * three/examples 모듈(lottie 등)이 로드 시점에 컨텍스트를 만들어 만지므로,
 * jsdom 환경에서만 뭘 해도 조용히 넘어가는 Proxy로 대체한다.
 * node 환경 테스트에는 HTMLCanvasElement가 없어 아무 영향이 없다.
 */
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = function getContext(
    this: HTMLCanvasElement,
  ) {
    const canvas = this;
    return new Proxy(
      {},
      {
        get: (_target, prop) => {
          if (prop === 'canvas') return canvas;
          return () => undefined;
        },
        set: () => true,
      },
    );
  } as unknown as typeof HTMLCanvasElement.prototype.getContext;
}
