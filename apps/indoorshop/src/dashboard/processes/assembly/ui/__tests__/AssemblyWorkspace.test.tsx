import { describe, expect, it, vi } from 'vitest'
import { Link, Route, Routes } from 'react-router-dom'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLocation } from 'react-router-dom'
import { renderWithProviders } from '../../../../shared/lib/testing/renderWithProviders'
import { pcdHrefOfAssy } from '../../../../shared/entities/vessel'
import { WORKSPACE_TAB_PARAM } from '../../../../shared/lib/workspaceTabUrl'

/* 3D 뷰어는 WebGL 이 필요하다 — jsdom 에서는 골격만 세운다(여기서 보는 것은 축 탭이다) */
vi.mock('../../../../shared/features/bay-viewer/ui/LidarPointCloudViewer', async (importOriginal) => {
  const original = await importOriginal<object>()
  return {
    ...original,
    LidarPointCloudViewer: (props: {
      mode: string
      selectedBlockId: string | null
      bays?: { location: { id: string } }[]
      onOpenBay?: (locationId: string) => void
    }) => (
      <div data-testid="viewer" data-mode={props.mode} data-selected={props.selectedBlockId ?? ''}>
        {/* 3D 라벨을 눌러 정반으로 들어가는 신호 — 캔버스가 없는 곳에서는 버튼이 그 자리다 */}
        {props.bays?.map((bay) => (
          <button key={bay.location.id} type="button" onClick={() => props.onOpenBay?.(bay.location.id)}>
            {`드릴 ${bay.location.id}`}
          </button>
        ))}
      </div>
    ),
  }
})
vi.mock('../viewer/RealScanViewer', () => ({
  RealScanViewer: () => <div data-testid="real-viewer" />,
}))
/* CAD 정반의 블록 형상은 fetch 자산이다 — 노드에는 없으므로 빈 모델로 세운다
   (여기서 보는 것은 형상이 아니라 어느 탭에 내려서는가다) */
vi.mock('../../../../shared/features/bay-viewer/api/loadBlockModel', () => ({
  loadBlockManifest: vi.fn(async (projNo: string, blkNo: string) => ({
    projNo,
    blkNo,
    wstgCode: 'AA11',
    source: 'test',
    size: [10, 4, 20],
    restQuat: [0, 0, 0, 1],
    restBboxMin: [-5, 0, -10],
    restBboxMax: [5, 4, 10],
    assemblies: [],
  })),
  loadBlockModel: vi.fn(async (projNo: string, blkNo: string) => ({
    manifest: {
      projNo,
      blkNo,
      wstgCode: 'AA11',
      source: 'test',
      size: [10, 4, 20],
      restQuat: [0, 0, 0, 1],
      restBboxMin: [-5, 0, -10],
      restBboxMax: [5, 4, 10],
      assemblies: [],
    },
    positions: new Float32Array(0),
  })),
}))

const i18n = (await import('../../../../shared/lib/i18n/config')).default
const { assemblyKo } = await import('../../i18n/ko')
const { assemblyEn } = await import('../../i18n/en')
i18n.addResourceBundle('ko', 'inshop', assemblyKo, true, true)
i18n.addResourceBundle('en', 'inshop', assemblyEn, true, true)

const { AssemblyWorkspace } = await import('../pages/AssemblyWorkspace')

/** 지금 주소 — 화면 안 이동이 무엇을 싣고 갔는지 단언할 수 있게 밖으로 낸다 */
function Here() {
  const { pathname, search } = useLocation()
  return <output data-testid="here">{`${pathname}${search}`}</output>
}

function renderWorkspace(path: string) {
  return renderWithProviders(
    <>
      <Routes>
        {/* 공장 없는 대문(R22) — 이 길로 들어오면 워크스페이스가 첫 공장을 편다 */}
        <Route path="/indoorshop/zones/assembly" element={<AssemblyWorkspace />} />
        <Route path="/indoorshop/zones/assembly/:factoryId" element={<AssemblyWorkspace />} />
        <Route path="/indoorshop/zones/assembly/:factoryId/:locationId" element={<AssemblyWorkspace />} />
      </Routes>
      {/* 밖에서 들어오는 링크의 대역 — 글로벌 검색·로스터가 다른 공장의 3D 를 가리킬 때
          그 이동이 워크스페이스를 새로 세우지 않는다는 사실까지 그대로 재현한다 */}
      <Link to="/indoorshop/zones/assembly/asm-gbs?tab=viewer">다른 공장 3D</Link>
      <Here />
    </>,
    { route: path }
  )
}

const here = () => screen.getByTestId('here').textContent ?? ''
const tabOf = (url: string) =>
  new URLSearchParams(url.split('?')[1] ?? '').get(WORKSPACE_TAB_PARAM)

/**
 * 조립 워크스페이스의 축 탭 (P4) — **세 공정이 같은 세 칸**을 쓴다.
 * 순서가 공정마다 다르면 화면을 옮겨 다닐 때 눈이 매번 다시 적응해야 한다.
 */
describe('AssemblyWorkspace — 축 탭', () => {
  it('[현황 | 3D 뷰어 | 블록·실적] 이 서고 기본은 현황이다', async () => {
    renderWorkspace('/indoorshop/zones/assembly/asm-pbs')

    const tablist = await screen.findByRole('tablist', { name: '화면 축 선택' })
    const tabs = [...tablist.querySelectorAll('[role="tab"]')].map((tab) => tab.textContent)
    expect(tabs).toEqual(['현황', '3D 뷰어', '블록·실적'])
    expect(screen.getByRole('tab', { name: '현황' })).toHaveAttribute('aria-selected', 'true')
  })

  it('현황 탭은 3D 장면을 기다리지 않는다 — 공장 목록과 설비가 먼저 선다', async () => {
    renderWorkspace('/indoorshop/zones/assembly/asm-pbs')

    const list = await screen.findByRole('list', { name: '공장 목록' })
    expect(list.textContent).toContain('PBS')
    /* 이관 라이다가 이름 그대로 선다 (설비 fixture 의 실 ID) */
    expect((await screen.findAllByRole('button', { name: /^LD-/ })).length).toBeGreaterThan(0)
    /* 3D 는 아직 서지 않았다 */
    expect(screen.queryByTestId('viewer')).not.toBeInTheDocument()
  })

  it('공장을 고르는 자리는 현황 탭의 목록 하나뿐 — 공장 탭바는 없다', async () => {
    const user = userEvent.setup()
    renderWorkspace('/indoorshop/zones/assembly/asm-pbs')
    await screen.findByRole('tablist', { name: '화면 축 선택' })

    await user.click(screen.getByRole('tab', { name: '3D 뷰어' }))
    /* 3D 상자에 붙어 있던 공장 탭에는 다른 공장 이름이 있었다 — 이제 없다 */
    expect(screen.queryByRole('link', { name: /조립4공장-OFD1/ })).not.toBeInTheDocument()
  })

  it('3D 뷰어로 갈아타면 현황 보드가 물러난다 — 한 자리에 한 축만 선다', async () => {
    const user = userEvent.setup()
    renderWorkspace('/indoorshop/zones/assembly/asm-pbs')
    await screen.findByRole('list', { name: '공장 목록' })

    await user.click(screen.getByRole('tab', { name: '3D 뷰어' }))
    expect(screen.queryByRole('list', { name: '공장 목록' })).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '3D 뷰어' })).toHaveAttribute('aria-selected', 'true')
  })
})

/**
 * 통합실적 'PCD 뷰' 의 **착지** (R28).
 *
 * 이 문의 이름은 3D 를 가리키는데, 축 탭 기본값이 [3D → 현황] 으로 바뀌자(P4) 링크는
 * 그대로인 채 도착지만 현황으로 옮겨 갔다 — 누른 사람은 3D 를 못 보고 탭을 한 번 더
 * 눌러야 했다. 그래서 착지 탭을 **링크가 직접 말하게** 했다(`&tab=viewer`).
 *
 * 아래 두 검사가 그 계약이다: 링크가 만든 URL 은 3D 에 내려서고(선택 블록까지), 탭을
 * 말하지 않은 URL 은 화면의 기본 탭에 선다. 앞으로 기본 탭을 또 바꿔도 앞의 것은
 * 흔들리지 않는다 — 기본값이 아니라 URL 이 정하기 때문이다.
 */
describe('AssemblyWorkspace — PCD 뷰 착지', () => {
  /* 통합실적 카드가 실제로 내보내는 URL 그대로 — 테스트가 URL 을 손으로 짓지 않는다.
     4391-154 는 NPS 2정반(블록 단위 인식)이라 승계 키가 장면 detection 과 그대로 이어진다. */
  const href = pcdHrefOfAssy('4391-154-S01')!

  it('링크가 만든 URL 로 들어가면 탭을 누르지 않아도 3D 뷰어에 선다', async () => {
    renderWorkspace(href)

    expect(await screen.findByRole('tab', { name: '3D 뷰어' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    const viewer = await screen.findByTestId('viewer')
    await waitFor(() => expect(viewer.dataset.mode).toBe('bay'))
  })

  it('착지와 함께 그 블록이 선택돼 있다 — 승계(?block=)는 그대로 산다', async () => {
    renderWorkspace(href)

    const viewer = await screen.findByTestId('viewer')
    await waitFor(() => expect(viewer.dataset.selected).toBeTruthy())
  })

  it('탭을 말하지 않은 URL 은 기본 탭(현황)에 선다 — 착지 탭을 정하는 것은 URL 이다', async () => {
    renderWorkspace(href.split('&tab=')[0])

    expect(await screen.findByRole('tab', { name: '현황' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
  })
})

/**
 * **화면 안 이동은 보던 축을 유지한다** (R30).
 *
 * 착지 탭이 URL 로 올라간 뒤(R28)에도 뷰어 안의 이동은 경로만 갈아 끼우고 `?tab=` 을 두고
 * 갔다. 그래서 3D 에서 정반을 눌러 들어간 사람은 그 순간 현황 탭으로 튕겨 나왔다 —
 * 방금 한 조작의 결과를 못 보는 셈이라 몰입이 거기서 끊긴다.
 */
describe('AssemblyWorkspace — 뷰어 안 드릴은 축을 승계한다 (R30)', () => {
  it('3D 에서 정반을 눌러 들어가도 3D 그대로다', async () => {
    const user = userEvent.setup()
    renderWorkspace('/indoorshop/zones/assembly/asm-pbs')
    await screen.findByRole('tablist', { name: '화면 축 선택' })

    await user.click(screen.getByRole('tab', { name: '3D 뷰어' }))
    const [drill] = await screen.findAllByRole('button', { name: /^드릴 / })
    await user.click(drill)

    await waitFor(() => expect(here()).toContain('/indoorshop/zones/assembly/asm-pbs/'))
    expect(tabOf(here())).toBe('viewer')
    expect(screen.getByRole('tab', { name: '3D 뷰어' })).toHaveAttribute('aria-selected', 'true')
  })

  it('현황에서 출발하면 현황에 내려선다 — 승계는 한 규칙이다', async () => {
    const user = userEvent.setup()
    renderWorkspace('/indoorshop/zones/assembly/asm-pbs')
    await screen.findByRole('tablist', { name: '화면 축 선택' })

    /* 현황 탭에는 3D 가 없다 — 여기서 정반으로 들어가는 문은 정반 전환 줄(3D 뷰어 탭의
       유리 도구줄)뿐이라, 이 방향의 승계는 주소에 축 키가 없다는 사실로 확인한다 */
    expect(screen.getByRole('tab', { name: '현황' })).toHaveAttribute('aria-selected', 'true')
    expect(tabOf(here())).toBeNull()

    await user.click(screen.getByRole('tab', { name: '3D 뷰어' }))
    expect(tabOf(here())).toBe('viewer')
  })
})

/**
 * 승계의 구멍 — **공장이 바뀌는 이동**에서도 축은 남아야 한다 (R30 재보고).
 *
 * W11-A 의 승계는 `?tab=` 을 제대로 실어 보냈는데, 도착한 화면이 그것을 마운트 직후
 * 덮고 있었다: "공장이 바뀌면 기본 탭으로" 라는 리셋 이펙트가 남아 있었기 때문이다.
 * 대문(`/indoorshop/zones/assembly`, 경로에 공장이 없다)에서 정반으로 들어가면 공장이
 * `없음 → asm-*` 로 **바뀐 것**이 되어, 실어 온 `?tab=viewer` 가 그 자리에서 status 로
 * 되돌려졌다 — 사용자가 두 번 겪은 그 증상이다.
 *
 * 리셋 이펙트는 URL 이 원본이 되기 전 시대의 잔재다(`useWorkspaceTab`). 지금은 주소가
 * 지금 축을 말하고, 그 화면에 없는 축이 실려 와도 `allowed` 검사가 기본 탭으로 접는다 —
 * 화면 안 state 를 따로 되돌릴 이유가 없다.
 */
describe('AssemblyWorkspace — 공장이 바뀌어도 축은 남는다 (R30)', () => {
  it('대문(공장 없는 경로)의 3D 에서 정반으로 들어가도 3D 그대로다', async () => {
    const user = userEvent.setup()
    renderWorkspace('/indoorshop/zones/assembly')
    await screen.findByRole('tablist', { name: '화면 축 선택' })

    await user.click(screen.getByRole('tab', { name: '3D 뷰어' }))
    const [drill] = await screen.findAllByRole('button', { name: /^드릴 / })
    await user.click(drill)

    await waitFor(() => expect(here()).toMatch(/\/zones\/assembly\/[^/]+\/[^?]+/))
    expect(tabOf(here())).toBe('viewer')
    expect(screen.getByRole('tab', { name: '3D 뷰어' })).toHaveAttribute('aria-selected', 'true')
  })

  it('다른 공장을 가리키는 링크(`?tab=viewer`)도 제 도착지에 선다', async () => {
    /*
     * 글로벌 검색(⌘K)·로스터의 'PCD 뷰' 는 **지금 보고 있는 공장과 다른 공장**을 가리킬 수
     * 있다. 그 이동은 화면을 새로 세우지 않고 경로의 공장만 갈아 끼우므로, 리셋 이펙트가
     * 남아 있으면 링크가 말한 도착지(3D)가 도착 직후 현황으로 뒤집힌다 — R28 의 약속
     * ("링크가 제 도착지를 말한다")이 공장 전환을 겸하는 순간에만 깨지는 자리였다.
     */
    const user = userEvent.setup()
    renderWorkspace('/indoorshop/zones/assembly/asm-pbs')
    await screen.findByRole('tablist', { name: '화면 축 선택' })

    await user.click(screen.getByRole('link', { name: '다른 공장 3D' }))

    await waitFor(() => expect(here()).toContain('/indoorshop/zones/assembly/asm-gbs'))
    expect(await screen.findByRole('tab', { name: '3D 뷰어' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(tabOf(here())).toBe('viewer')
  })
})
