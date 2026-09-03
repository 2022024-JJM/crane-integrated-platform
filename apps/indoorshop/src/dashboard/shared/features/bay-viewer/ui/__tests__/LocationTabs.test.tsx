import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLocation } from 'react-router-dom'
import { renderWithProviders } from '../../../../lib/testing/renderWithProviders'
import type { Location as Bay } from '../../../../entities/location/model/types'
import { WORKSPACE_TAB_PARAM } from '../../../../lib/workspaceTabUrl'
import { LocationTabs, type LocationTabsRouting } from '../LocationTabs'

/**
 * **화면 안 이동은 보던 축을 유지한다** (R30) — 워크스페이스 안의 공장·정반 전환 줄.
 *
 * 착지 탭이 URL 로 올라간 뒤(R28)에도 이 줄의 링크는 경로만 갈아 끼우고 `?tab=` 을 두고
 * 갔다. 그래서 3D 뷰어를 보다 정반을 누르면 도착 화면이 기본 탭(현황)으로 서서, 방금 한
 * 조작의 결과를 못 보게 됐다 — 몰입이 끊기는 자리다.
 *
 * 여기서 잠그는 것은 **양방향 한 규칙**이다: 뷰어에서 출발하면 뷰어로, 현황에서
 * 출발하면 현황으로. 승계 규칙이 한쪽 탭에만 있으면 곧 두 규칙이 된다.
 */
const FACTORIES = [
  { id: 'asm-pbs', displayName: 'PBS' },
  { id: 'asm-gbs', displayName: 'GBS' },
]
const BAYS: Bay[] = [
  { id: 'pbs-4bay', factoryId: 'asm-pbs', name: '4BAY', status: 'occupied', workCntr: 'A4' },
  { id: 'pbs-5bay', factoryId: 'asm-pbs', name: '5BAY', status: 'empty', workCntr: 'A5' },
]
const ROUTING: LocationTabsRouting = {
  factoryHref: (factoryId) => `/indoorshop/zones/assembly/${factoryId}`,
  bayHref: (factoryId, bayId) => `/indoorshop/zones/assembly/${factoryId}/${bayId}`,
  navLabel: '공장·정반',
  allLabel: '전체',
  bayTitle: (name, code) => `${name} (${code})`,
}

/** 지금 주소를 화면에 내놓는다 — 링크를 눌렀을 때 어디로 갔는지를 단언할 수 있게 */
function Here() {
  const { pathname, search } = useLocation()
  return <output data-testid="here">{`${pathname}${search}`}</output>
}

function renderTabs(route: string, currentLocationId?: string) {
  return renderWithProviders(
    <>
      <LocationTabs
        factories={FACTORIES}
        locations={BAYS}
        routing={ROUTING}
        currentFactoryId="asm-pbs"
        currentLocationId={currentLocationId}
      />
      <Here />
    </>,
    { route }
  )
}

const here = () => screen.getByTestId('here').textContent
const tabOf = (url: string) => new URLSearchParams(url.split('?')[1] ?? '').get(WORKSPACE_TAB_PARAM)

describe('LocationTabs — 축 승계 (R30)', () => {
  it('3D 뷰어에서 정반을 눌러 들어가면 3D 그대로 내려선다', async () => {
    renderTabs('/indoorshop/zones/assembly/asm-pbs?tab=viewer')

    await userEvent.click(screen.getByRole('link', { name: /5BAY/ }))

    expect(here()).toContain('/indoorshop/zones/assembly/asm-pbs/pbs-5bay')
    expect(tabOf(here() ?? '')).toBe('viewer')
  })

  it('정반에서 정반으로 옮겨도 보던 축이 남는다', async () => {
    renderTabs('/indoorshop/zones/assembly/asm-pbs/pbs-5bay?tab=viewer', 'pbs-5bay')

    await userEvent.click(screen.getByRole('link', { name: /4BAY/ }))

    expect(here()).toContain('/indoorshop/zones/assembly/asm-pbs/pbs-4bay')
    expect(tabOf(here() ?? '')).toBe('viewer')
  })

  it("정반에서 공장으로 되돌아올 때도 마찬가지다 ('전체')", async () => {
    renderTabs('/indoorshop/zones/assembly/asm-pbs/pbs-5bay?tab=viewer', 'pbs-5bay')

    await userEvent.click(screen.getByRole('link', { name: '전체' }))

    expect(here()).toBe('/indoorshop/zones/assembly/asm-pbs?tab=viewer')
  })

  it('현황에서 출발하면 현황에 내려선다 — 승계는 한 규칙이다', async () => {
    /* 기본 탭에서는 주소에 키가 없다(useWorkspaceTab). 그래서 실을 것도 없고,
       도착 화면은 제 기본 탭인 현황에 그대로 선다 — 반대 방향도 같은 규칙이다. */
    renderTabs('/indoorshop/zones/assembly/asm-pbs')

    await userEvent.click(screen.getByRole('link', { name: /5BAY/ }))

    expect(here()).toBe('/indoorshop/zones/assembly/asm-pbs/pbs-5bay')
  })

  it('싣는 것은 축 하나뿐이다 — 이 줄의 경로는 공정(`routing`)이 만든다', async () => {
    /* 진입 링크가 실어 온 선택 승계(`?block=`)는 **그 진입의 것**이라 여기 링크에는
       따라붙지 않는다(이 줄이 태어날 때부터 그랬다 — 승계가 새로 버리는 것이 아니다).
       R30 이 더하는 키는 `tab` 하나뿐임을 못 박아, 승계가 조용히 넓어지지 않게 한다. */
    renderTabs('/indoorshop/zones/assembly/asm-pbs?tab=viewer&block=7004-222')

    await userEvent.click(screen.getByRole('link', { name: /5BAY/ }))

    expect(here()).toBe(`/indoorshop/zones/assembly/asm-pbs/pbs-5bay?${WORKSPACE_TAB_PARAM}=viewer`)
  })
})
