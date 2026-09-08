import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'

/*
 * jsdom 테스트(`*.test.tsx`)의 공통 준비.
 *
 * jsdom 은 "문서"까지만 흉내 낸다 — 레이아웃도, 그리기도, 포인터 캡처도 없다. 그래서
 * 화면 코드가 당연하게 부르는 브라우저 API 몇 가지가 통째로 비어 있고, 없는 걸 부르면
 * 검증하려던 것과 무관한 자리에서 터진다. 여기서 **한 번만** 채워 둔다 —
 * 테스트 파일마다 같은 스텁을 베껴 두지 않게.
 *
 * 채우는 것은 "있기만 하면 되는" 것들뿐이다. 값이 의미를 갖는 것(요소 크기 등)은
 * 여기서 정하지 않고 각 테스트가 제 시나리오에 맞게 정한다 — 공용 기본값을 두면
 * 그 값에 기댄 테스트가 생기고, 나중에 아무도 왜 그 숫자인지 모르게 된다.
 */

/** jsdom 에 없는 것들 — 없으면 렌더 도중 터진다 */
function stubMissingBrowserApis() {
  if (!('ResizeObserver' in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }

  if (typeof window.matchMedia !== 'function') {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as Window['matchMedia']
  }

  /* 포인터 캡처 — 드래그 코드가 부른다. jsdom 은 선언만 있고 구현이 없다 */
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {}
    Element.prototype.releasePointerCapture = () => {}
    Element.prototype.hasPointerCapture = () => false
  }

  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {}
  }

  /* 캔버스 — 미니맵·뷰어가 컨텍스트를 집는다. 그리는 내용은 검증 대상이 아니다 */
  if (!HTMLCanvasElement.prototype.getContext) {
    HTMLCanvasElement.prototype.getContext = (() => null) as never
  }
}

stubMissingBrowserApis()

beforeEach(() => {
  /* 저장소는 테스트 사이에 새 것 — 앞 테스트가 남긴 카드 자리가 다음 테스트에 흘러들지
     않게 한다(이 종류의 오염은 단독 실행에서만 통과하는 테스트를 만든다) */
  globalThis.sessionStorage?.clear()
  globalThis.localStorage?.clear()
})

/* 그린 것을 걷는다 — 안 걷으면 다음 테스트의 `screen` 질의가 앞 화면까지 함께 본다 */
afterEach(cleanup)
