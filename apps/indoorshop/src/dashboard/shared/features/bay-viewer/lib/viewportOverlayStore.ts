import { useSyncExternalStore } from 'react'

/**
 * 뷰포트 위에 얹힌 것들(축 기즈모·화면 밖 표식)이 **카메라 속도로** 갱신되는 통로.
 *
 * 왜 별도의 통로가 필요한가 — 이 값들은 궤도 회전 한 번에 초당 60번 바뀐다. 그런데
 * 뷰어 컴포넌트의 `useState` 에 담아 두면 그 60번이 전부 **뷰어 전체의 리렌더**가 된다.
 * 뷰어는 2천 줄짜리 컴포넌트라 훅 수십 개가 매번 다시 돌고, JSX 트리(도구 버튼·레이어
 * 패널·범례)가 통째로 재조정된다 — 실측으로 커밋 한 번에 0.4~4.2ms 가 들었다. 16.7ms
 * 프레임 예산에서 **기즈모 하나 그리자고 최대 4분의 1을 쓴 셈**이고, 그 시간은 정확히
 * 사람이 드래그하고 있는 동안에만 든다.
 *
 * 그래서 값을 React 상태 밖에 두고, **그 값을 실제로 그리는 잎 컴포넌트만** 구독한다.
 * 카메라가 아무리 빨리 움직여도 다시 그려지는 것은 기즈모 SVG 와 표식 몇 개뿐이고,
 * 뷰어 본체는 한 번도 리렌더되지 않는다.
 *
 * 뷰어 인스턴스마다 하나씩 만든다(모듈 전역이 아니다) — 한 화면에 뷰어가 둘 떠 있어도
 * 서로의 카메라를 밀어내지 않아야 한다.
 */
export interface ViewportOverlayStore<T> {
  /** 새 값을 알린다 — 값이 그대로면(===) 구독자를 깨우지 않는다 */
  publish: (value: T) => void
  subscribe: (listener: () => void) => () => void
  read: () => T
}

export function createViewportOverlayStore<T>(initial: T): ViewportOverlayStore<T> {
  let value = initial
  const listeners = new Set<() => void>()
  return {
    publish: (next) => {
      if (Object.is(next, value)) return
      value = next
      for (const listener of listeners) listener()
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    read: () => value,
  }
}

/**
 * 잎 컴포넌트가 이 훅으로 구독한다.
 *
 * `useSyncExternalStore` 의 스냅샷은 **참조가 안정적**이어야 한다 — 매번 새 객체를 만들면
 * React 가 무한히 다시 읽는다. 그래서 `publish` 하는 쪽이 값을 새로 만들어 넣고,
 * `read` 는 들고 있는 그 참조를 그대로 돌려준다.
 */
export function useViewportOverlay<T>(store: ViewportOverlayStore<T>): T {
  return useSyncExternalStore(store.subscribe, store.read, store.read)
}
