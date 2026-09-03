import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { carryWorkspaceTab, WORKSPACE_TAB_PARAM, workspaceTabOf } from './workspaceTabUrl'

/*
 * 워크스페이스 축 탭 ↔ URL — **읽기만이 아니라 쓰기까지**.
 *
 * 착지는 이미 `?tab=` 을 읽고 있었다(R28: 링크가 제 도착지를 말한다). 그런데 화면에서
 * 탭을 바꿔도 주소는 그대로였다 — 그래서 3D 를 보다 새로고침하면 현황으로 돌아왔고,
 * 그 자리를 남에게 건네려면 손으로 `?tab=` 을 붙여야 했다. 주소가 도착지를 정한다면
 * **지금 서 있는 자리도 주소가 말해야** 한다.
 *
 * 기록은 `replace` 다. 탭 전환은 같은 화면 안의 시선 이동이지 새 자리로의 이동이 아니라,
 * 히스토리에 쌓으면 뒤로가기가 탭 사이를 오가느라 화면을 못 떠난다 — 드릴다운(공장·베이)
 * 이 `push` 인 것과 정확히 반대 이유다.
 *
 * 방향성은 그대로다: URL 이 원본이고 화면은 그것을 읽는다. 화면 안 state 사본을 두지
 * 않으므로 둘이 어긋날 자리가 없다.
 */

export interface WorkspaceTabApi<T extends string> {
  /** 지금 축 — URL 이 말하는 값, 없거나 모르는 값이면 기본 탭 */
  tab: T
  /** 축을 옮긴다 — 주소에 replace 로 적는다(다른 쿼리는 그대로) */
  setTab: (next: T) => void
}

export function useWorkspaceTab<T extends string>(
  allowed: readonly T[],
  fallback: T
): WorkspaceTabApi<T> {
  const [searchParams, setSearchParams] = useSearchParams()
  const raw = searchParams.get(WORKSPACE_TAB_PARAM)
  const tab = useMemo(() => workspaceTabOf(raw, allowed) ?? fallback, [raw, allowed, fallback])

  const setTab = useCallback(
    (next: T) => {
      setSearchParams(
        (previous) => {
          const params = new URLSearchParams(previous)
          /* 기본 탭은 키를 지운다 — 주소에 기본값을 굳이 적어 두지 않는다 */
          if (next === fallback) params.delete(WORKSPACE_TAB_PARAM)
          else params.set(WORKSPACE_TAB_PARAM, next)
          return params
        },
        { replace: true }
      )
    },
    [setSearchParams, fallback]
  )

  return { tab, setTab }
}

/**
 * 화면 안 이동에 **지금 축을 실어 주는** 함수 (R30).
 *
 * 축 목록을 모르는 부품(공용 `LocationTabs` — 어느 공정의 탭인지도 모른다)도 승계에
 * 참여해야 하므로, 판정 없이 URL 의 원값을 그대로 나른다. 판정은 도착 화면의 몫이다
 * (`useWorkspaceTab`). 기본 탭에 서 있으면 주소에 키가 없으므로 승계할 것도 없다 —
 * 그대로 기본 탭에 내려앉는 것이 맞다.
 */
export function useWorkspaceTabCarry(): (path: string) => string {
  const [searchParams] = useSearchParams()
  const raw = searchParams.get(WORKSPACE_TAB_PARAM)
  return useCallback((path: string) => carryWorkspaceTab(path, raw), [raw])
}
