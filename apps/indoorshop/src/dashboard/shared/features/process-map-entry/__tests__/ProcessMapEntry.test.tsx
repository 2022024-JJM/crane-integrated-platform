import { describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../lib/testing/renderWithProviders'
import type { BasemapLayer, MapTheme } from '../../yard-map'
import type { YardParcelLot, YardParcels } from '../../../entities/yard-parcels'
import { ProcessMapEntry } from '../ui/ProcessMapEntry'
import type { MapEntryLabels } from '../model/types'

/*
 * 맵 진입 프레임의 **오버레이 층** 본보기.
 *
 * 지도 자체(캔버스 렌더러)는 여기서 볼 것이 없으므로 통째로 갈음한다 — jsdom 에는
 * 레이아웃도 2D 컨텍스트도 없어서, 갈음하지 않으면 검증하려던 오버레이가 아니라
 * 렌더러 안쪽에서 실패한다. 프레임이 지도에 무엇을 넘기는지는 노드 테스트
 * (`members.test.ts`)가 이미 보고 있다.
 */
vi.mock('../../yard-map', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../yard-map')>()),
  YardMap: ({ className }: { className?: string }) => (
    <div data-testid="yard-map" className={className} />
  ),
}))

const lot = (over: Partial<YardParcelLot> & { lot: string }): YardParcelLot => ({
  factory: null,
  process: '',
  category: '공장(Shop)',
  label: `설명 ${over.lot}`,
  area: 1000,
  place: '옥내',
  polygon: [
    { lat: 34.87, lon: 128.7 },
    { lat: 34.871, lon: 128.701 },
  ],
  ...over,
})

function parcels(): YardParcels {
  return {
    lots: [
      lot({ lot: 'AL1', factory: '조립1공장', process: '조립' }),
      lot({ lot: 'AL2', factory: '조립2공장', process: '조립' }),
      /* 주인공 밖 — 무색 실루엣으로 강등되는 땅 */
      lot({ lot: 'DL1', factory: '도장5공장', process: '도장' }),
    ],
    factories: [
      { name: '조립1공장', process: '조립', lotCodes: ['AL1'], labelAnchor: { lat: 34.87, lon: 128.7 } },
      { name: '조립2공장', process: '조립', lotCodes: ['AL2'], labelAnchor: { lat: 34.87, lon: 128.7 } },
      { name: '도장5공장', process: '도장', lotCodes: ['DL1'], labelAnchor: { lat: 34.87, lon: 128.7 } },
    ],
    bays: [
      {
        bayKey: 'BAY001',
        factory: '조립1공장',
        bay: 'A',
        id: '조립1공장#A',
        label: 'A베이',
        process: '조립',
        lotCodes: ['AL1'],
        hull: [],
      },
    ],
    categoryColor: () => '#3987e5',
  }
}

const BASEMAP: Record<MapTheme, BasemapLayer[]> = { dark: [], light: [] }

const labels: MapEntryLabels = {
  panelTitle: '조립 공장',
  viewAll: '전체 보기',
  viewAllHint: '야드 전체를 봅니다',
  expand: '펴기',
  collapse: '접기',
  viewOnMap: '지도에서 보기',
  breadcrumbLabel: '현재 위치',
  breadcrumbYard: '야드',
  breadcrumbProcess: '조립',
}

function renderEntry(
  over: Partial<Parameters<typeof ProcessMapEntry>[0]> = {},
  route = '/zones/assembly?factory=%EC%A1%B0%EB%A6%BD1%EA%B3%B5%EC%9E%A5',
) {
  return renderWithProviders(
    <div style={{ width: 1280, height: 720 }}>
      <ProcessMapEntry
        parcels={parcels()}
        factoryNames={['조립1공장', '조립2공장']}
        basemapLayers={BASEMAP}
        selectedFactory="조립1공장"
        onSelectFactory={() => {}}
        labels={labels}
        {...over}
      />
    </div>,
    { route },
  )
}

/** 우측 공장 목록 패널 — 제목으로 찾는다 */
function panel() {
  return screen.getByRole('heading', { name: '조립 공장' }).closest('section') as HTMLElement
}

describe('ProcessMapEntry 오버레이', () => {
  it('우측 패널에 주인공 공장만 세운다 — 주인공 밖 공장은 목록에 없다', () => {
    renderEntry()
    expect(within(panel()).getByText('조립1공장')).toBeInTheDocument()
    expect(within(panel()).getByText('조립2공장')).toBeInTheDocument()
    expect(within(panel()).queryByText('도장5공장')).toBeNull()
  })

  it('공장 카드를 누르면 그 공장이 선택된다', async () => {
    const onSelectFactory = vi.fn()
    renderEntry({ onSelectFactory })
    await userEvent.setup().click(within(panel()).getByText('조립2공장'))
    expect(onSelectFactory).toHaveBeenCalledWith('조립2공장')
  })

  it('펴기 버튼이 그 공장의 본문(공정 몫)을 연다', async () => {
    renderEntry({ factoryBody: (factory) => <p>{factory} 설비 3대</p> })
    /* 고른 공장은 처음부터 펴져 있고(지금 이야기), 나머지는 접혀 있다 */
    expect(screen.getByText(/조립1공장\s*설비 3대/)).toBeInTheDocument()
    expect(screen.queryByText(/조립2공장\s*설비 3대/)).toBeNull()

    await userEvent.setup().click(within(panel()).getByRole('button', { name: '펴기' }))
    expect(screen.getByText(/조립2공장\s*설비 3대/)).toBeInTheDocument()
  })

  it('슬롯(범례·상세·패널 머리)에 넘긴 것을 제자리에 낸다', () => {
    renderEntry({
      legend: <span>범례 내용</span>,
      detailOverlay: <section>상세 카드</section>,
      panelHeaderExtra: <span>①센서 ②수집</span>,
    })
    expect(screen.getByText('범례 내용')).toBeInTheDocument()
    expect(screen.getByText('상세 카드')).toBeInTheDocument()
    expect(screen.getByText('①센서 ②수집')).toBeInTheDocument()
  })

  it('오버레이 카드는 전부 잡아 옮길 수 있다 — 상세·공장 패널·범례·미니맵', () => {
    const { container } = renderEntry({
      legend: <span>범례 내용</span>,
      detailOverlay: <section>상세 카드</section>,
    })
    const keys = [...container.querySelectorAll('[data-draggable-card]')].map(
      (el) => (el as HTMLElement).dataset.draggableCard,
    )
    expect(keys).toEqual(expect.arrayContaining(['detail', 'factory-panel', 'legend', 'minimap']))
  })

  it('공장 패널의 손잡이는 제목 줄 — 아래 목록은 스크롤이 제 일이라 잡히지 않는다', () => {
    renderEntry()
    const handle = panel().querySelector('[data-drag-handle]')
    expect(handle).toContainElement(screen.getByRole('heading', { name: '조립 공장' }))
  })
})

describe('ProcessMapEntry 브레드크럼 — URL 의 표현', () => {
  const crumb = () => screen.getByRole('navigation', { name: '현재 위치' })

  it('공장 단계 — `야드 › 조립 › 공장`, 현재(공장)만 링크가 아니다', () => {
    renderEntry()
    const nav = crumb()
    expect(within(nav).getByRole('link', { name: '야드' })).toHaveAttribute('href', '/')
    expect(within(nav).getByRole('link', { name: '조립' })).toHaveAttribute(
      'href',
      '/zones/assembly',
    )
    const current = within(nav).getByText('조립1공장')
    expect(current).toHaveAttribute('aria-current', 'page')
    expect(current.closest('a')).toBeNull()
  })

  it('전체 보기(공장 없음) — 공정 조각이 현재라 링크가 아니다', () => {
    renderEntry({ initialOverview: true }, '/zones/assembly')
    const nav = crumb()
    expect(within(nav).getByRole('link', { name: '야드' })).toBeInTheDocument()
    expect(within(nav).getByText('조립')).toHaveAttribute('aria-current', 'page')
    expect(within(nav).queryByText('조립1공장')).toBeNull()
  })

  it('베이 단계 — 네 조각, 공장 조각이 그 단계 URL 로 돌아가는 링크가 된다', () => {
    renderEntry(
      {},
      '/zones/assembly?factory=%EC%A1%B0%EB%A6%BD1%EA%B3%B5%EC%9E%A5&bay=%EC%A1%B0%EB%A6%BD1%EA%B3%B5%EC%9E%A5%23A',
    )
    const nav = crumb()
    expect(within(nav).getByRole('link', { name: '조립1공장' })).toHaveAttribute(
      'href',
      '/zones/assembly?factory=%EC%A1%B0%EB%A6%BD1%EA%B3%B5%EC%9E%A5',
    )
    expect(within(nav).getByText('A베이')).toHaveAttribute('aria-current', 'page')
  })
})
