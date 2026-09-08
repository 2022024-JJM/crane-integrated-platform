/*
 * jsdom 에는 레이아웃이 없다 — 모든 요소의 `getBoundingClientRect()` 가 0×0 을 낸다.
 * 자리를 다루는 화면 코드(카드 옮기기·가두기)는 그 값을 보고 판단하므로, 테스트가
 * "이 카드는 여기에 이만한 크기로 서 있다"를 **직접 말해 줘야** 한다.
 *
 * 이 파일은 그 말하기를 한 줄로 만든다. 값은 각 테스트가 정한다 — 공용 기본 크기를
 * 두면 나중에 그 숫자에 기댄 테스트가 생기고, 왜 그 숫자인지 아무도 모르게 된다.
 */

export interface StubRect {
  left: number
  top: number
  width: number
  height: number
}

/** 이 요소가 화면 어디에 얼마만 한 크기로 서 있는지 정한다 */
export function stubRect(element: HTMLElement, rect: StubRect): void {
  element.getBoundingClientRect = () =>
    ({
      x: rect.left,
      y: rect.top,
      left: rect.left,
      top: rect.top,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      width: rect.width,
      height: rect.height,
      toJSON: () => ({}),
    }) as DOMRect
}

/** 창 크기를 정한다 — 뷰포트 가두기를 검증할 때의 테두리 */
export function stubViewport(width: number, height: number): void {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: height, configurable: true })
}
