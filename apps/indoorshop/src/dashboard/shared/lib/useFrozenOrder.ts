import { useCallback, useMemo, useRef, useState } from 'react'
import { freezeOrder } from './stableOrder'

/*
 * 손이 목록 위에 있는 동안 **순서를 얼린다** (`stableOrder` 의 화면 쪽).
 *
 * 얼리는 것은 자리뿐이다 — 각 줄이 보여 주는 값은 계속 갱신된다. 그래서 "읽는 동안 값이
 * 낡는다"와 "누르려는 줄이 도망간다" 중 어느 것도 생기지 않는다.
 *
 * 녹는 시점은 손을 뗄 때다(mouseleave·blur). 타이머로 녹이면 손이 얹힌 채로도 갑자기
 * 재정렬되는 순간이 생겨, 그 한 번이 정확히 사람이 클릭하려던 순간일 수 있다.
 */

export interface FrozenOrder<T> {
  /** 화면에 그릴 목록 — 얼어 있으면 이전 순서, 아니면 준 순서 그대로 */
  items: T[]
  /** 목록 컨테이너에 그대로 펴 넣는 이벤트 — 손이 닿으면 얼고, 떠나면 녹는다 */
  handlers: {
    onMouseEnter: () => void
    onMouseLeave: () => void
    onFocusCapture: () => void
    onBlurCapture: (event: { currentTarget: HTMLElement; relatedTarget: EventTarget | null }) => void
  }
  /** 지금 얼어 있는가 — 테스트·디버그가 짚는 자리 */
  frozen: boolean
}

export function useFrozenOrder<T>(next: readonly T[], keyOf: (item: T) => string): FrozenOrder<T> {
  const [frozen, setFrozen] = useState(false)
  /* 마지막으로 **그린** 순서 — 얼리는 순간의 기준이 된다 */
  const renderedKeys = useRef<string[]>([])

  const items = useMemo(
    () => (frozen ? freezeOrder(renderedKeys.current, next, keyOf) : [...next]),
    [frozen, next, keyOf]
  )
  renderedKeys.current = items.map(keyOf)

  const freeze = useCallback(() => setFrozen(true), [])
  const thaw = useCallback(() => setFrozen(false), [])

  return {
    items,
    frozen,
    handlers: {
      onMouseEnter: freeze,
      onMouseLeave: thaw,
      onFocusCapture: freeze,
      /* 포커스가 목록 **밖으로** 나갈 때만 녹인다 — 줄 사이 이동은 얼린 채로 */
      onBlurCapture: (event) => {
        const nextTarget = event.relatedTarget
        if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return
        thaw()
      },
    },
  }
}
