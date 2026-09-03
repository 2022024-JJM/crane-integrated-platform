import { useCallback, useEffect, useState } from 'react'

export interface AsyncDataState<T> {
  data: T | null
  loading: boolean
  /**
   * 실패 채널 — **`Error | null` 뿐이다.**
   *
   * 문자열이나 임의 객체를 섞지 않는 것은, 공용 실패 UI 가 화면마다 다른 모양의 오류를
   * 받아 다시 갈래를 타지 않게 하기 위해서다. 로더가 무엇을 던지든 여기서 `Error` 로
   * 접어 낸다. 실패 표시가 필요한 자리는 `(error, retry)` 두 개만 넘기면 된다.
   */
  error: Error | null
  /**
   * 다시 받기 — 실패 UI 의 '다시 시도' 버튼이 부른다.
   *
   * deps 를 억지로 흔들어(더미 state 를 하나 두고 증가시켜) 재조회하는 관용구가 화면마다
   * 다시 쓰이지 않도록 훅이 제공한다. 성공한 뒤에 불러도 된다(그냥 최신값을 다시 받는다).
   */
  retry: () => void
}

/**
 * Promise 기반 데이터 로더를 컴포넌트에서 소비하기 위한 최소 훅.
 * deps가 바뀌면 다시 로드하며, 언마운트/재로드 시 이전 결과는 무시한다.
 *
 * 다시 로드하는 동안 **이전 데이터를 지우지 않는다**. 지우면 화면이 빈 상태로
 * 무너졌다가 새 데이터로 다시 서면서 깜박이기 때문이다 — 호출부는 `loading` 을
 * 보고 이전 내용 위에 로딩 표시를 덮으면 된다.
 *
 * 대신 `data` 가 어느 요청의 결과인지 호출부가 알아야 한다면, 로더가 돌려주는
 * 값 자체에 식별자를 실어야 한다 (예: `{ locationId, ... }`).
 *
 * ⚠️ 값이 **계속 흐르는** 자리(설비 상태·수집 실적)에는 이 훅이 맞지 않는다 — 이것은
 *    1회성이다. 구독이 필요하면 `shared/lib/liveStore` 를 쓴다.
 */
export function useAsyncData<T>(
  loader: () => Promise<T>,
  deps: React.DependencyList
): AsyncDataState<T> {
  const [state, setState] = useState<Omit<AsyncDataState<T>, 'retry'>>({
    data: null,
    loading: true,
    error: null,
  })
  /* 재시도는 '같은 deps 로 한 번 더' 다 — 세대를 세어 effect 를 다시 태운다 */
  const [generation, setGeneration] = useState(0)
  const retry = useCallback(() => setGeneration((n) => n + 1), [])

  // oxlint-disable-next-line react-hooks/exhaustive-deps -- 호출부가 넘긴 deps를 그대로 전달하는 범용 훅
  useEffect(() => {
    let cancelled = false
    setState((previous) => ({ data: previous.data, loading: true, error: null }))

    loader().then(
      (data) => {
        if (!cancelled) setState({ data, loading: false, error: null })
      },
      (error: unknown) => {
        if (!cancelled) {
          setState({
            // 실패하면 낡은 값을 계속 보여주지 않는다 — 오류는 오류로 낸다
            data: null,
            loading: false,
            error: error instanceof Error ? error : new Error(String(error)),
          })
        }
      }
    )

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, generation])

  return { ...state, retry }
}
