import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useWorkspaceTab, useWorkspaceTabCarry } from '../useWorkspaceTab'
import { WORKSPACE_TAB_PARAM } from '../workspaceTabUrl'

/*
 * 축 탭 ↔ URL (링크 스모크 ⑦).
 *
 * 착지는 이미 `?tab=` 을 읽었는데(R28) 화면에서 탭을 바꿔도 주소는 그대로였다 —
 * 3D 를 보다 새로고침하면 현황으로 돌아왔다. 방향성은 그대로(URL 이 도착지를 정한다)
 * 두고, **지금 자리도 주소가 말하게** 한다.
 */
const TABS = ['status', 'viewer', 'blocks'] as const

function wrapperAt(url: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
  }
}
const useHarness = () => ({ ...useWorkspaceTab(TABS, 'status'), location: useLocation() })

describe('useWorkspaceTab', () => {
  it('URL 이 착지 탭을 정한다 (R28 그대로)', () => {
    const { result } = renderHook(useHarness, { wrapper: wrapperAt('/z?tab=viewer') })
    expect(result.current.tab).toBe('viewer')
  })

  it('모르는 값·빈 값이면 기본 탭 — 빈 칸으로 서지 않는다', () => {
    for (const url of ['/z', '/z?tab=nope']) {
      const { result } = renderHook(useHarness, { wrapper: wrapperAt(url) })
      expect(result.current.tab).toBe('status')
    }
  })

  it('탭을 바꾸면 주소에 실린다 — 새로고침·공유가 그 자리를 지킨다', () => {
    const { result } = renderHook(useHarness, { wrapper: wrapperAt('/z') })
    act(() => result.current.setTab('viewer'))
    expect(new URLSearchParams(result.current.location.search).get(WORKSPACE_TAB_PARAM)).toBe(
      'viewer'
    )
    expect(result.current.tab).toBe('viewer')
  })

  it('기본 탭으로 돌아오면 키를 지운다 — 주소에 기본값을 적어 두지 않는다', () => {
    const { result } = renderHook(useHarness, { wrapper: wrapperAt('/z?tab=viewer') })
    act(() => result.current.setTab('status'))
    expect(result.current.location.search).toBe('')
  })

  it('다른 쿼리는 그대로 실려 간다 (drilldown·date 와 공존)', () => {
    const { result } = renderHook(useHarness, { wrapper: wrapperAt('/z?factory=asm-gbs&date=2026-09-03') })
    act(() => result.current.setTab('blocks'))
    const params = new URLSearchParams(result.current.location.search)
    expect(params.get('factory')).toBe('asm-gbs')
    expect(params.get('date')).toBe('2026-09-03')
    expect(params.get(WORKSPACE_TAB_PARAM)).toBe('blocks')
  })

  it('탭 전환은 히스토리를 쌓지 않는다(replace) — 뒤로가기가 탭 사이를 오가지 않게', () => {
    /* 앞선 자리가 하나 있는 히스토리에서 탭을 두 번 바꾼 뒤 뒤로 간다.
       쌓였다면 탭 이력으로 되돌아가고, 갈아 끼웠다면(replace) 앞선 자리로 나간다. */
    function Wrapper({ children }: { children: ReactNode }) {
      return <MemoryRouter initialEntries={['/before', '/z']}>{children}</MemoryRouter>
    }
    const useBackHarness = () => ({ ...useHarness(), navigate: useNavigate() })
    const { result } = renderHook(useBackHarness, { wrapper: Wrapper })

    act(() => result.current.setTab('viewer'))
    act(() => result.current.setTab('blocks'))
    expect(result.current.tab).toBe('blocks')

    act(() => void result.current.navigate(-1))
    expect(result.current.location.pathname).toBe('/before')
  })
})

/*
 * 승계 (R30) — 화면 안 이동이 보던 축을 그대로 실어 간다.
 *
 * 축 목록을 모르는 공용 부품(`LocationTabs`)도 승계에 참여해야 하므로, 이 훅은 판정 없이
 * URL 의 원값을 나른다. 판정은 도착 화면(`useWorkspaceTab`)의 몫이다.
 */
describe('useWorkspaceTabCarry', () => {
  it('지금 URL 이 실은 축을 다음 경로에 얹는다', () => {
    const { result } = renderHook(useWorkspaceTabCarry, { wrapper: wrapperAt('/z?tab=viewer') })
    expect(result.current('/indoorshop/zones/assembly/asm-pbs/pbs-5bay')).toBe(
      `/indoorshop/zones/assembly/asm-pbs/pbs-5bay?${WORKSPACE_TAB_PARAM}=viewer`
    )
  })

  it('기본 탭(주소에 키가 없다)에서는 경로를 그대로 둔다 — 기본 탭에 내려앉는 게 맞다', () => {
    const { result } = renderHook(useWorkspaceTabCarry, { wrapper: wrapperAt('/z') })
    expect(result.current('/indoorshop/zones/assembly/asm-pbs')).toBe('/indoorshop/zones/assembly/asm-pbs')
  })

  it('탭을 바꾸면 그 다음 이동부터 새 축을 싣는다 — 주소가 원본이다', () => {
    const { result } = renderHook(
      () => ({ ...useWorkspaceTab(TABS, 'status'), carry: useWorkspaceTabCarry() }),
      { wrapper: wrapperAt('/z') }
    )
    expect(result.current.carry('/next')).toBe('/next')
    act(() => result.current.setTab('viewer'))
    expect(result.current.carry('/next')).toBe(`/next?${WORKSPACE_TAB_PARAM}=viewer`)
  })
})
