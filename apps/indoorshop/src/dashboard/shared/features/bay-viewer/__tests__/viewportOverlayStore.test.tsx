import { describe, expect, it } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { useState } from 'react'
import {
  createViewportOverlayStore,
  useViewportOverlay,
} from '../lib/viewportOverlayStore'

/*
 * 카메라 속도로 바뀌는 값이 **뷰어 본체를 리렌더하지 않는가**.
 *
 * P0 성능 작업의 핵심 계약이다. 궤도 회전 한 번은 초당 60번의 갱신을 부르는데, 그 값이
 * 뷰어의 `useState` 에 있으면 그 60번이 전부 2천 줄짜리 컴포넌트의 리렌더가 된다
 * (실측 커밋당 0.4~4.2ms — 16.7ms 예산의 최대 4분의 1을 기즈모 하나에 쓴 셈).
 *
 * 그래서 "잎만 다시 그려진다"를 **렌더 횟수로** 못 박는다. 이 수가 다시 늘어나면
 * 누군가 값을 상태로 되돌린 것이고, 그때 화면은 다시 무거워진다.
 */

describe('뷰포트 오버레이 저장소 — 갱신이 잎에서 멈춘다', () => {
  it('publish 는 구독한 잎만 다시 그린다 — 부모는 그대로다', () => {
    const store = createViewportOverlayStore(0)
    let parentRenders = 0
    let leafRenders = 0

    function Leaf() {
      leafRenders += 1
      return <span data-testid="value">{useViewportOverlay(store)}</span>
    }

    function Viewer() {
      parentRenders += 1
      return <Leaf />
    }

    render(<Viewer />)
    expect(parentRenders).toBe(1)
    expect(leafRenders).toBe(1)

    /* 카메라가 60프레임 움직인 셈 친다 */
    for (let frame = 1; frame <= 60; frame += 1) {
      act(() => store.publish(frame))
    }

    expect(screen.getByTestId('value').textContent).toBe('60')
    /* 잎은 따라 그렸고 — */
    expect(leafRenders).toBe(61)
    /* 뷰어 본체는 한 번도 다시 그리지 않았다 */
    expect(parentRenders).toBe(1)
  })

  it('같은 값을 다시 내면 아무도 깨우지 않는다', () => {
    const marks = Object.freeze([])
    const store = createViewportOverlayStore<readonly never[]>(marks)
    let leafRenders = 0

    function Leaf() {
      leafRenders += 1
      useViewportOverlay(store)
      return null
    }

    render(<Leaf />)
    expect(leafRenders).toBe(1)

    /* 표식이 없는 프레임이 이어지는 상황 — 같은 참조이므로 리렌더가 없어야 한다 */
    act(() => {
      store.publish(marks)
      store.publish(marks)
    })
    expect(leafRenders).toBe(1)
  })

  it('구독을 끊은 뒤에는 알림을 받지 않는다', () => {
    const store = createViewportOverlayStore(0)
    let calls = 0
    const unsubscribe = store.subscribe(() => {
      calls += 1
    })
    store.publish(1)
    expect(calls).toBe(1)

    unsubscribe()
    store.publish(2)
    expect(calls).toBe(1)
    /* 값 자체는 계속 최신이다 — 다음에 붙는 구독자가 낡은 값을 보지 않도록 */
    expect(store.read()).toBe(2)
  })

  it('부모가 제 사정으로 다시 그려도 잎은 최신 값을 유지한다', () => {
    const store = createViewportOverlayStore('A')
    let setLabel: ((next: string) => void) | null = null

    function Leaf() {
      return <span data-testid="value">{useViewportOverlay(store)}</span>
    }

    function Viewer() {
      const [label, set] = useState('처음')
      setLabel = set
      return (
        <>
          <span data-testid="label">{label}</span>
          <Leaf />
        </>
      )
    }

    render(<Viewer />)
    act(() => store.publish('B'))
    act(() => setLabel?.('레이어 열림'))

    expect(screen.getByTestId('label').textContent).toBe('레이어 열림')
    expect(screen.getByTestId('value').textContent).toBe('B')
  })
})
