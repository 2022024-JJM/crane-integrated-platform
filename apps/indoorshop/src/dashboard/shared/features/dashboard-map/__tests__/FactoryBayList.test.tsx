import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../lib/testing/renderWithProviders'
import { FactoryBayList } from '../ui/FactoryBayList'
import { BayOccupantList } from '../ui/BayOccupantList'
import type { BayOccupancy, BayOccupant } from '../lib/bayOccupancy'
import { occupantProgressKey, type OccupantProgress } from '../lib/occupantProgress'

/*
 * 공장 상세의 베이 목록 (P1 ①) — 행은 그 베이의 **재실 요약**이고, 클릭은 드릴인이다.
 * 기준정보(면적·옥내외)는 이 자리에 없다.
 */
const occupant = (over: Partial<BayOccupant> = {}): BayOccupant => ({
  key: '2540-281',
  projNo: '2540',
  blockNo: '281',
  zone: 'assembly',
  assys: [],
  justArrived: false,
  path: '/indoorshop/zones/assembly/asm-pbs/asm-pbs-b8',
  ...over,
})

const bay = (over: Partial<BayOccupancy> = {}): BayOccupancy => {
  const occupants = over.occupants ?? [occupant()]
  return {
    bayId: 'PBS#8',
    label: '8BAY',
    occupants,
    blockCount: occupants.length,
    assyCount: occupants.reduce((n, o) => n + o.assys.length, 0),
    ...over,
  }
}

describe('FactoryBayList — 베이별 재실', () => {
  it('행은 블록 이름 대신 작업 종류와 수를 적는다 — 면적·옥내외도 적지 않는다', () => {
    renderWithProviders(
      <FactoryBayList
        bays={[bay({ occupants: [occupant(), occupant({ key: '2540-282', zone: 'outfitting' })] })]}
        onOpenBay={() => {}}
      />,
    )
    const row = screen.getByRole('button', { name: /8BAY/ })
    expect(row).not.toHaveTextContent('2540-281')
    expect(row).toHaveTextContent('조립 블록1')
    expect(row).toHaveTextContent('의장 블록1')
    expect(row).not.toHaveTextContent('면적')
    expect(row).not.toHaveTextContent('옥내')
  })

  it('ASSY 가 올라온 자리는 급(대조·중조·소조)별로 센다', () => {
    const bays = [
      bay({
        occupants: [
          occupant({
            assys: [
              { assyNo: 'A1', tier: 'sub' },
              { assyNo: 'A2', tier: 'sub' },
              { assyNo: 'M1', tier: 'mid' },
            ],
          }),
        ],
      }),
    ]
    renderWithProviders(<FactoryBayList bays={bays} onOpenBay={() => {}} />)
    const row = screen.getByRole('button', { name: /8BAY/ })
    expect(row).toHaveTextContent('중조1')
    expect(row).toHaveTextContent('소조2')
    expect(row).not.toHaveTextContent('A1')
  })

  it('맨 위에 공장 전체의 작업 합계를 낸다', () => {
    renderWithProviders(
      <FactoryBayList
        bays={[
          bay({ occupants: [occupant({ assys: [{ assyNo: 'A1', tier: 'sub' }] })] }),
          bay({
            bayId: 'PBS#9',
            label: '9BAY',
            occupants: [occupant({ key: '2540-290', assys: [{ assyNo: 'B1', tier: 'sub' }] })],
          }),
        ]}
        onOpenBay={() => {}}
      />,
    )
    const summary = screen.getByRole('region', { name: '진행 작업' })
    expect(summary).toHaveTextContent('2소조')
  })

  it('작업이 없는 베이도 행을 남기고 "작업 없음" 이라고 말한다 — 갓 반입도 작업으로 세지 않는다', () => {
    renderWithProviders(
      <FactoryBayList
        bays={[
          bay(),
          bay({ bayId: 'PBS#9', label: '9BAY', occupants: [], blockCount: 0, assyCount: 0 }),
          bay({ bayId: 'PBS#10', label: '10BAY', occupants: [occupant({ justArrived: true })] }),
        ]}
        onOpenBay={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: /8BAY/ })).toHaveTextContent('조립 블록1')
    expect(screen.getByRole('button', { name: /^9BAY/ })).toHaveTextContent('작업 없음')
    expect(screen.getByRole('button', { name: /10BAY/ })).toHaveTextContent('작업 없음')
  })

  it('공장 전체에 진행 중인 작업이 없으면 합계 자리에 그렇다고 말한다 — 베이 행은 남는다', () => {
    renderWithProviders(
      <FactoryBayList bays={[bay({ occupants: [], blockCount: 0, assyCount: 0 })]} onOpenBay={() => {}} />,
    )
    expect(screen.getByRole('region', { name: '진행 작업' })).toHaveTextContent('작업 없음')
    expect(screen.getByRole('button', { name: /8BAY/ })).toHaveTextContent('작업 없음')
  })

  it('점검 필요 베이도 지도 순서 그대로 서고, 그 행 오른쪽에만 점검 필요 칩이 선다', () => {
    renderWithProviders(
      <FactoryBayList
        bays={[
          bay(),
          bay({ bayId: 'PBS#9', label: '9BAY', occupants: [], blockCount: 0, assyCount: 0 }),
        ]}
        equipmentFaults={new Map([['PBS#9', 2]])}
        onOpenBay={() => {}}
      />,
    )
    const rows = screen.getAllByRole('button')
    expect(rows[0]).toHaveAccessibleName(/8BAY/)
    expect(rows[1]).toHaveAccessibleName(/9BAY/)
    expect(screen.getByLabelText('점검 필요 2')).toBeInTheDocument()
    expect(rows[1]).toContainElement(screen.getByLabelText('점검 필요 2'))
    expect(rows[0].querySelector('[aria-label^="점검 필요"]')).toBeNull()
  })

  it('행 클릭 = 그 베이로 드릴인', async () => {
    const onOpenBay = vi.fn()
    renderWithProviders(<FactoryBayList bays={[bay()]} onOpenBay={onOpenBay} />)
    await userEvent.setup().click(screen.getByRole('button', { name: /8BAY/ }))
    expect(onOpenBay).toHaveBeenCalledWith('PBS#8')
  })

  it('베이가 없는 공장(매핑 없음)은 목록 자체를 만들지 않는다', () => {
    const { container } = renderWithProviders(<FactoryBayList bays={[]} onOpenBay={() => {}} />)
    expect(container.firstElementChild).toBeNull()
  })
})

describe('BayOccupantList — 베이 상세의 본문', () => {
  it('카드 자체를 누르면 실적 창이 뜬다 — 조립 자리는 조립 화면 [실적] 에서 그 블록과 이 자리의 ASSY 를 짚는다', async () => {
    const onPreview = vi.fn()
    renderWithProviders(
      <BayOccupantList
        onPreview={onPreview}
        occupants={[
          occupant({
            key: '9999-002',
            projNo: '9999',
            blockNo: '002',
            assys: [{ assyNo: '9999-002-M01', tier: 'mid' }],
          }),
        ]}
      />,
    )
    expect(screen.queryByRole('button', { name: '실적' })).toBeNull()
    await userEvent.setup().click(screen.getByRole('button', { name: /9999-002/ }))
    const [href, title] = onPreview.mock.calls[0]
    expect(href.startsWith('/indoorshop/zones/assembly/asm-pbs/asm-pbs-b8?')).toBe(true)
    const params = new URLSearchParams(href.split('?')[1])
    expect(params.get('view')).toBe('performance')
    expect(params.get('vessel')).toBe('9999')
    expect(params.getAll('block').join(',')).toContain('002')
    expect(params.getAll('assy').join(',')).toContain('9999-002-M01')
    expect(title).toContain('9999-002')
  })

  it('카드 안에는 3D·실적 버튼이 없다 — 카드 하나가 곧 문이다', () => {
    renderWithProviders(
      <BayOccupantList
        onPreview={() => {}}
        occupants={[occupant({ key: '9999-002', projNo: '9999', blockNo: '002' })]}
      />,
    )
    expect(screen.queryByText('3D')).toBeNull()
    expect(screen.queryByText('실적')).toBeNull()
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  it('상태(갓 반입·작업 전)를 내고, 하위 작업 종류가 없는 블록은 종류를 적지 않는다', () => {
    renderWithProviders(
      <BayOccupantList onPreview={() => {}}
        occupants={[
          occupant({ key: '9999-003', projNo: '9999', blockNo: '003', zone: 'painting', justArrived: true }),
        ]}
      />,
    )
    const card = screen.getByRole('button', { name: /9999-003/ })
    expect(card).toHaveTextContent('갓 반입 · 작업 전')
    expect(card).not.toHaveTextContent('도장 블록')
  })

  it('조립 ASSY 는 작업 종류(태그)로 한 줄에 — 소조 (S04) · 중조 (M03, M05)', () => {
    renderWithProviders(
      <BayOccupantList onPreview={() => {}}
        occupants={[
          occupant({
            key: '9999-004',
            projNo: '9999',
            blockNo: '004',
            assys: [
              { assyNo: '9999-004-M05', tier: 'mid' },
              { assyNo: '9999-004-S04', tier: 'sub' },
              { assyNo: '9999-004-M03', tier: 'mid' },
            ],
          }),
        ]}
      />,
    )
    const card = screen.getByRole('button', { name: /9999-004/ })
    expect(card).toHaveTextContent('소조(S04)')
    expect(card).toHaveTextContent('중조(M03, M05)')
  })

  it('작업 중 · 작업 전 · 작업 완료를 따로 묶어 그 순서로 보여 준다', () => {
    const a = occupant({ key: '9999-011', projNo: '9999', blockNo: '011' })
    const b = occupant({ key: '9999-012', projNo: '9999', blockNo: '012' })
    const c = occupant({ key: '9999-013', projNo: '9999', blockNo: '013' })
    const progress = new Map<string, OccupantProgress>([
      [occupantProgressKey(a), { state: 'done', pct: 100 }],
      [occupantProgressKey(b), { state: 'inProgress', pct: 40 }],
      [occupantProgressKey(c), { state: 'notStarted', pct: null }],
    ])
    renderWithProviders(<BayOccupantList onPreview={() => {}} occupants={[a, b, c]} progress={progress} />)
    const groups = screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'))
    expect(groups).toEqual(['작업 중', '작업 전', '작업 완료'])
    expect(screen.getByRole('region', { name: '작업 전' })).toHaveTextContent('9999-013')
    expect(screen.getByRole('region', { name: '작업 중' })).toHaveTextContent('9999-012')
    expect(screen.getByRole('region', { name: '작업 완료' })).toHaveTextContent('9999-011')
  })

  it('빈 묶음은 세우지 않는다', () => {
    const b = occupant({ key: '9999-021', projNo: '9999', blockNo: '021' })
    const progress = new Map<string, OccupantProgress>([[occupantProgressKey(b), { state: 'inProgress', pct: 10 }]])
    renderWithProviders(<BayOccupantList onPreview={() => {}} occupants={[b]} progress={progress} />)
    expect(screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'))).toEqual(['작업 중'])
  })

  it('재실이 없으면 비었다고 말한다', () => {
    renderWithProviders(<BayOccupantList onPreview={() => {}} occupants={[]} />)
    expect(screen.getByText('작업 목록')).toBeInTheDocument()
    expect(screen.getByText('이 베이에 놓인 작업이 없습니다')).toBeInTheDocument()
  })
})
