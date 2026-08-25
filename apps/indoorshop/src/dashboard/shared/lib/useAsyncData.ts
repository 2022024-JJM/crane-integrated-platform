import { useEffect, useState } from 'react'

interface AsyncDataState<T> {
  data: T | null
  loading: boolean
  error: Error | null
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
 */
export function useAsyncData<T>(
  loader: () => Promise<T>,
  deps: React.DependencyList
): AsyncDataState<T> {
  const [state, setState] = useState<AsyncDataState<T>>({
    data: null,
    loading: true,
    error: null,
  })

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
  }, deps)

  return state
}
