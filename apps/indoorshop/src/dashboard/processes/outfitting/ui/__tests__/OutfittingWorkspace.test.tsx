import { describe, expect, it, vi } from 'vitest'
import { Link, Route, Routes } from 'react-router-dom'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLocation } from 'react-router-dom'
import { renderWithProviders } from '../../../../shared/lib/testing/renderWithProviders'
import { pcdHrefOfOutfittingBlock } from '../../../../shared/entities/vessel'
import { WORKSPACE_TAB_PARAM } from '../../../../shared/lib/workspaceTabUrl'
import type {
  BlockModelManifest,
  LoadedBlockModel,
} from '../../../../shared/features/bay-viewer/model/blockModel'

/* 3D 뷰어는 WebGL 이 필요하다 — jsdom 에서는 골격만 세운다(여기서 보는 것은 워크스페이스 구조다) */
vi.mock('../../../../shared/features/bay-viewer/ui/LidarPointCloudViewer', async (importOriginal) => {
  const original = await importOriginal<object>()
  return {
    ...original,
    LidarPointCloudViewer: (props: {
      mode: string
      bays: { location: { id: string } }[]
      onOpenBay?: (locationId: string) => void
    }) => (
      <div data-testid="viewer" data-mode={props.mode} data-bays={props.bays.length}>
        {/* 3D 라벨을 눌러 베이로 들어가는 신호 — 캔버스가 없는 곳에서는 버튼이 그 자리다 */}
        {props.bays.map((bay) => (
          <button key={bay.location.id} type="button" onClick={() => props.onOpenBay?.(bay.location.id)}>
            {`드릴 ${bay.location.id}`}
          </button>
        ))}
      </div>
    ),
  }
})
vi.mock('../../../../shared/features/bay-viewer/api/loadBlockModel', () => ({
  loadBlockModel: vi.fn(async (projNo: string, blkNo: string): Promise<LoadedBlockModel> => {
    const manifest: BlockModelManifest = {
      projNo,
      blkNo,
      wstgCode: 'AA11',
      source: 'test',
      size: [10, 4, 20],
      restQuat: [0, 0, 0, 1],
      restBboxMin: [-5, 0, -10],
      restBboxMax: [5, 4, 10],
      assemblies: [],
    }
    return { manifest, positions: new Float32Array(0) }
  }),
}))

/* 모듈 i18n 조각은 앱 bootstrap 이 등록한다 — 테스트에서는 손으로 등록한다 */
const i18n = (await import('../../../../shared/lib/i18n/config')).default
const { outfittingKo } = await import('../../i18n/ko')
const { outfittingEn } = await import('../../i18n/en')
i18n.addResourceBundle('ko', 'inshop', outfittingKo, true, true)
i18n.addResourceBundle('en', 'inshop', outfittingEn, true, true)

const { OutfittingWorkspace } = await import('../pages/OutfittingWorkspace')

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
        <Route path="/indoorshop/zones/outfitting" element={<OutfittingWorkspace />} />
        <Route path="/indoorshop/zones/outfitting/:factoryId" element={<OutfittingWorkspace />} />
        <Route path="/indoorshop/zones/outfitting/:factoryId/:locationId" element={<OutfittingWorkspace />} />
        <Route path="/indoorshop/performance" element={<div data-testid="performance-page" />} />
      </Routes>
      {/* 밖에서 들어오는 링크의 대역 — 글로벌 검색·로스터가 다른 공장의 3D 를 가리킬 때 */}
      <Link to="/indoorshop/zones/outfitting/ofit-bos1?tab=viewer">다른 공장 3D</Link>
      <Here />
    </>,
    { route: path }
  )
}

const here = () => screen.getByTestId('here').textContent ?? ''
const tabOf = (url: string) =>
  new URLSearchParams(url.split('?')[1] ?? '').get(WORKSPACE_TAB_PARAM)

/** 3D 뷰어 탭을 연다 — P4 이후 기본 탭은 ① 현황이라 뷰어는 한 번 눌러야 선다 */
async function openViewer(user: ReturnType<typeof userEvent.setup>) {
  /* 데이터가 들어오기 전에는 탭줄 자체가 없다 — 탭이 설 때까지 기다렸다 누른다 */
  await user.click(await screen.findByRole('tab', { name: '3D 뷰어' }))
  return screen.findByTestId('viewer')
}

/**
 * 의장 공장 워크스페이스 (W7-10 → P4) — **조립과 같은 구조**의 화면 계약.
 * 축 탭 3개, 3D 공장 뷰(전 베이), 현황·블록 탭의 콘텐츠 이동을 지킨다.
 */
describe('OutfittingWorkspace', () => {
  it('축 탭 [현황|3D 뷰어|블록·실적] 이 서고, 기본은 현황이다 (P4)', async () => {
    const user = userEvent.setup()
    renderWorkspace('/indoorshop/zones/outfitting/ofit-pos1')

    const tablist = await screen.findByRole('tablist', { name: '화면 축 선택' })
    const tabs = [...tablist.querySelectorAll('[role="tab"]')].map((tab) => tab.textContent)
    expect(tabs).toEqual(['현황', '3D 뷰어', '블록·실적'])
    /* 처음 서는 것은 현황 — 3D 는 눌러서 들어간다 */
    expect(screen.getByRole('tab', { name: '현황' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByTestId('viewer')).not.toBeInTheDocument()

    /* 공장 전체 뷰 — POS 1공장 7베이 전부가 한 장면에 */
    const viewer = await openViewer(user)
    await waitFor(() => expect(viewer.dataset.mode).toBe('factory'))
    expect(viewer.dataset.bays).toBe('7')
  })

  it('공장 선택은 현황 탭의 공장 목록 하나뿐 — 공장 탭바는 없다 (P4)', async () => {
    const user = userEvent.setup()
    renderWorkspace('/indoorshop/zones/outfitting/ofit-pos1')

    /* 현황 탭 왼쪽 목록이 7공장을 다 세우고, 현재 공장을 눌린 채로 둔다 */
    const list = await screen.findByRole('list', { name: '공장 목록' })
    const current = await screen.findByRole('button', { name: /POS 1공장/ })
    expect(current).toHaveAttribute('aria-pressed', 'true')
    expect(list.textContent).toContain('두모 선행의장 2공장')
    expect(list.textContent).toContain('OFD조립의장 셸터')

    /* 3D 뷰어로 넘어가도 공장 탭바(LocationTabs 의 공장 몫)는 서지 않는다 */
    await openViewer(user)
    const navs = screen.queryAllByRole('navigation', { name: '공장 및 베이 전환' })
    for (const nav of navs) {
      expect(nav.textContent).not.toContain('두모 선행의장 2공장')
    }
  })

  it('현황 탭 — 베이마다 한 묶음씩, 라이다가 이름 그대로 선다', async () => {
    renderWorkspace('/indoorshop/zones/outfitting/ofit-pos1')

    /* 1BAY 의 이관 라이다가 이름 그대로 선다 */
    expect(await screen.findByText('LD-O101')).toBeInTheDocument()
    /*
     * 베이 묶음 제목은 **설비 관제 화면과 같은 문구**다(`outfitting.equipment.bayHeading`).
     * W8-5 에서 이 탭이 관제 화면과 같은 컴포넌트를 쓰게 되면서, 예전의 작업 위치 이름
     * ('1BAY')이 아니라 두 화면이 공유하는 '1 BAY' 로 선다 — 같은 베이를 두 화면이 다르게
     * 부르지 않게 하려는 것이 이 통합의 목적이다.
     */
    expect(screen.getByText('1 BAY')).toBeInTheDocument()
  })

  it("현황 탭에서 '전체 설비 관제로' 문이 그 공장으로 열린다 (W8-5 상호 링크)", async () => {
    renderWorkspace('/indoorshop/zones/outfitting/ofit-pos1')

    const link = await screen.findByRole('link', { name: '전체 설비 관제로' })
    /*
     * 역할 분리의 실 — 여기는 그 공장 요약이고 저쪽은 전 공장 관제다. 넘어갈 때 그 공장이
     * 열려 있어야 하므로 `?shop=` 을 싣는다(야드·지도와 같은 딥링크 열쇠).
     */
    expect(link.getAttribute('href')).toBe(
      `/indoorshop/zones/outfitting/equipment?shop=${encodeURIComponent('POS 1공장')}`
    )
  })

  it('블록·실적 탭 — 블록 줄이 통합실적 딥링크를 유지한다', async () => {
    const user = userEvent.setup()
    renderWorkspace('/indoorshop/zones/outfitting/ofit-pos1')

    await user.click(await screen.findByRole('tab', { name: '블록·실적' }))
    await screen.findByRole('heading', { name: /블록 현황/ })
    const links = [...document.querySelectorAll('a[href^="/indoorshop/performance?vessel="]')]
    expect(links.length).toBeGreaterThan(0)
    expect(links[0].getAttribute('href')).toMatch(/vessel=\d+&block=/)
  })

  it('선택 승계 (W8-3) — ?block= 로 도착하면 그 블록이 선택돼 있다', async () => {
    /* 7004-530 은 BOS1 구역(bay 1) 로스터 블록 — PCD 뷰 링크가 만드는 바로 그 URL */
    const user = userEvent.setup()
    renderWorkspace('/indoorshop/zones/outfitting/ofit-bos1/ofit-bos1-b1?block=7004-530')
    const viewer = await openViewer(user)
    await waitFor(() => expect(viewer.dataset.mode).toBe('bay'))
    /* 우상단 선택 칩 — formatDetectionId('BLK {blkNo}') + 전체 보기 되돌아가기 */
    const chip = await screen.findByRole('button', { name: /BLK 530/ })
    expect(chip).toBeInTheDocument()
  })

  it('베이 레벨 — /zones/outfitting/{공장}/{베이} 가 그 베이의 3D 뷰로 선다', async () => {
    const user = userEvent.setup()
    renderWorkspace('/indoorshop/zones/outfitting/ofit-pos1/ofit-pos1-b1')
    const viewer = await openViewer(user)
    await waitFor(() => expect(viewer.dataset.mode).toBe('bay'))
    expect(viewer.dataset.bays).toBe('1')
    /* 머리글이 베이 이름을 말한다 */
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('1BAY')
  })
})

/**
 * 통합실적 'PCD 뷰' 의 **착지** (R28) — 조립과 같은 계약이다.
 *
 * 축 탭 기본값이 [3D → 현황] 으로 바뀌자(P4) 3D 를 가리키는 이 문이 현황에 내려앉았다.
 * 이제 착지 탭을 **링크가 직접 말한다**(`&tab=viewer`) — 기본 탭을 또 바꿔도 이 문은
 * 3D 에 선다. 정하는 것이 기본값이 아니라 URL 이기 때문이다.
 */
describe('OutfittingWorkspace — PCD 뷰 착지', () => {
  /* 통합실적 카드가 실제로 내보내는 URL 그대로 (7004-530 = BOS1 1BAY 로스터 블록) */
  const href = pcdHrefOfOutfittingBlock('7004', '530')!

  it('링크가 만든 URL 로 들어가면 탭을 누르지 않아도 3D 뷰어에 그 블록이 선다', async () => {
    renderWorkspace(href)

    expect(await screen.findByRole('tab', { name: '3D 뷰어' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    const viewer = await screen.findByTestId('viewer')
    await waitFor(() => expect(viewer.dataset.mode).toBe('bay'))
    /* 우상단 선택 칩 — 승계(?block=)가 그대로 살아 있다 */
    expect(await screen.findByRole('button', { name: /BLK 530/ })).toBeInTheDocument()
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
 * **화면 안 이동은 보던 축을 유지한다** (R30) — 조립 워크스페이스와 같은 규칙.
 * 두 화면이 같은 프레임을 쓰기로 한 이상(W7-10), 승계도 한쪽에만 있으면 안 된다.
 */
describe('OutfittingWorkspace — 뷰어 안 드릴은 축을 승계한다 (R30)', () => {
  it('3D 에서 베이를 눌러 들어가도 3D 그대로다', async () => {
    const user = userEvent.setup()
    renderWorkspace('/indoorshop/zones/outfitting/ofit-pos1')
    await openViewer(user)

    const [drill] = await screen.findAllByRole('button', { name: /^드릴 / })
    await user.click(drill)

    await waitFor(() => expect(here()).toContain('/indoorshop/zones/outfitting/ofit-pos1/'))
    expect(tabOf(here())).toBe('viewer')
    expect(screen.getByRole('tab', { name: '3D 뷰어' })).toHaveAttribute('aria-selected', 'true')
  })

  it('베이 전환 줄(정반 알약·전체)도 같은 축으로 이어진다', async () => {
    const user = userEvent.setup()
    renderWorkspace('/indoorshop/zones/outfitting/ofit-pos1')
    await openViewer(user)

    const [drill] = await screen.findAllByRole('button', { name: /^드릴 / })
    await user.click(drill)
    await waitFor(() => expect(here()).toContain('/indoorshop/zones/outfitting/ofit-pos1/'))

    /* 베이 → 공장 복귀 ('전체') — 되돌아와도 보던 축에 선다 */
    await user.click(await screen.findByRole('link', { name: '전체' }))
    expect(here()).toBe(`/indoorshop/zones/outfitting/ofit-pos1?${WORKSPACE_TAB_PARAM}=viewer`)
  })
})

/**
 * 승계의 구멍 — **공장이 바뀌는 이동**에서도 축은 남아야 한다 (R30 재보고, 조립과 같은 규칙).
 *
 * 도착 화면에 "공장이 바뀌면 기본 탭으로" 라는 리셋 이펙트가 남아 있었다. 대문
 * (`/indoorshop/zones/outfitting`, 경로에 공장이 없다)에서 베이로 들어가면 공장이 `없음 → ofit-*`
 * 으로 바뀐 것이 되어, 실어 온 `?tab=viewer` 가 마운트 직후 status 로 덮였다.
 */
describe('OutfittingWorkspace — 공장이 바뀌어도 축은 남는다 (R30)', () => {
  it('대문(공장 없는 경로)의 3D 에서 베이로 들어가도 3D 그대로다', async () => {
    const user = userEvent.setup()
    renderWorkspace('/indoorshop/zones/outfitting')
    await openViewer(user)

    const [drill] = await screen.findAllByRole('button', { name: /^드릴 / })
    await user.click(drill)

    await waitFor(() => expect(here()).toMatch(/\/zones\/outfitting\/[^/]+\/[^?]+/))
    expect(tabOf(here())).toBe('viewer')
    expect(screen.getByRole('tab', { name: '3D 뷰어' })).toHaveAttribute('aria-selected', 'true')
  })

  it('다른 공장을 가리키는 링크(`?tab=viewer`)도 제 도착지에 선다', async () => {
    const user = userEvent.setup()
    renderWorkspace('/indoorshop/zones/outfitting/ofit-pos1')
    await screen.findByRole('tablist', { name: '화면 축 선택' })

    await user.click(screen.getByRole('link', { name: '다른 공장 3D' }))

    await waitFor(() => expect(here()).toContain('/indoorshop/zones/outfitting/ofit-bos1'))
    expect(await screen.findByRole('tab', { name: '3D 뷰어' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(tabOf(here())).toBe('viewer')
  })
})
