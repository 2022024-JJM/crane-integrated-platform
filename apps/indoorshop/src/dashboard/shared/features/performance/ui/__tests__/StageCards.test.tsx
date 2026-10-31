import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../lib/testing/renderWithProviders'
import { toFabStageSummary } from '../../api/fabOtAdapter'
import { mockBlockCheckpoints } from '../../api/fabOtMock'
import type { FabStageId } from '../../model/types'
import { StageCards } from '../StageCards'

/**
 * 절점 카드 = 아래 수집 현황의 보기 고르기 — 절점 카드는 그 절점만, 종합 카드는 전체.
 * 기본은 종합(전체)이 눌린 상태다.
 */
const summary = toFabStageSummary(mockBlockCheckpoints('7004', '222', { asOf: '2026-10-29', includeHeld: true }))

function setup(activeStage: FabStageId | null) {
  const onSelectStage = vi.fn()
  renderWithProviders(
    <StageCards summary={summary} activeStage={activeStage} onSelectStage={onSelectStage} />
  )
  return onSelectStage
}

describe('StageCards — 수집 현황 보기 고르기', () => {
  it('기본(전체)은 종합 카드가 눌려 있다', () => {
    setup(null)
    expect(screen.getByRole('button', { name: /^종합/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /^S7 절단/ })).toHaveAttribute('aria-pressed', 'false')
  })

  it('절점 카드를 누르면 그 절점을, 종합 카드를 누르면 전체(null)를 고른다', async () => {
    const onSelectStage = setup('S7')
    expect(screen.getByRole('button', { name: /^S7 절단/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /^종합/ })).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(screen.getByRole('button', { name: /^S4 강재 불출/ }))
    expect(onSelectStage).toHaveBeenLastCalledWith('S4')
    await userEvent.click(screen.getByRole('button', { name: /^S7 절단/ }))
    expect(onSelectStage).toHaveBeenLastCalledWith('S7') // 같은 절점을 다시 눌러도 풀리지 않는다
    await userEvent.click(screen.getByRole('button', { name: /^종합/ }))
    expect(onSelectStage).toHaveBeenLastCalledWith(null)
  })
})

describe('StageCards — 절점마다 자기 단위', () => {
  it('실적률 옆에는 단위를 적지 않고 양 · 건수 줄이 단위를 말한다 — 강재 kg · 도면 MH · 부재 개, Hot DB 에 없는 S5 는 빈 카드로 선다', () => {
    setup(null)
    /* 실적% 바로 옆에 단위가 붙지 않는다 */
    expect(screen.getByRole('button', { name: /^S1 강재 입고/ })).not.toHaveTextContent(/%\s*kg/)
    expect(screen.getByRole('button', { name: /^S7 절단/ })).not.toHaveTextContent(/%\s*MH/)
    /* 오른쪽 아래는 「계획일 MM-DD」 */
    expect(screen.getByRole('button', { name: /^S7 절단/ })).toHaveTextContent(/계획일 \d{2}-\d{2}/)
    /* 도면 절점의 양은 시수 — 앞에 「시수」 */
    expect(screen.getByRole('button', { name: /^S7 절단/ })).toHaveTextContent(/시수\s*[\d,.]+ \/ [\d,.]+ MH/)
    /* 적치 절점의 중량은 강판 중량 — 앞에 「강판」 */
    expect(screen.getByRole('button', { name: /^S1 강재 입고/ })).toHaveTextContent(/강판\s*[\d,.]+ \/ [\d,.]+ kg/)
    expect(screen.getByRole('button', { name: /^S1 강재 입고/ })).not.toHaveTextContent('중량%')
    expect(screen.getByRole('button', { name: /^S1 강재 입고/ })).toHaveTextContent('원천 확정 대기')
    expect(screen.getByRole('button', { name: /^S6 전처리/ })).not.toHaveTextContent('원천 확정 대기')
    /* 건수는 세는 대상의 이름으로 — 강판 · 도면은 장, 부재는 개 */
    expect(screen.getByRole('button', { name: /^S1 강재 입고/ })).toHaveTextContent(/강판 \d+\/\d+장/)
    /* 진행중 · 미도래 수는 카드에 적지 않는다 */
    expect(screen.getByRole('button', { name: /^S1 강재 입고/ })).not.toHaveTextContent(/진행중|미도래/)
    expect(screen.getByRole('button', { name: /^S6 전처리/ })).toHaveTextContent(/도면 \d+\/\d+장/)
    expect(screen.getByRole('button', { name: /^S9 모둠선별/ })).toHaveTextContent(/부재 \d+\/\d+개/)
    expect(screen.getByRole('button', { name: /^S7 절단/ })).toHaveTextContent(/[\d,.]+ \/ [\d,.]+ MH/)
    expect(screen.getByRole('button', { name: /^S9 모둠선별/ })).toHaveTextContent(/부재 \d+\/\d+개/)
    expect(screen.getByRole('button', { name: /^S8 사상/ })).toHaveTextContent('보류')
    expect(screen.getByRole('button', { name: /^S5 가공 입고/ })).toHaveTextContent('Hot DB 절점 없음')
    /* 곡가공은 화면 절점이 아니라 S7 카드의 보조 줄이다 (명세 §9) */
    expect(screen.getByRole('button', { name: /^S7 절단/ })).toHaveTextContent(/곡가공 \d+\/\d+/)
  })
})

describe('StageCards — 값이 없는 절점', () => {
  it('실적률이 — 이어도 단위를 붙이지 않는다', () => {
    const empty = {
      ...summary,
      stages: summary.stages.map((s) => (s.stage === 'S1' ? { ...s, rate: null, targetQty: 0, doneQty: 0 } : s)),
    }
    renderWithProviders(<StageCards summary={empty} activeStage={null} onSelectStage={() => {}} />)
    const card = screen.getByRole('button', { name: /^S1 강재 입고/ })
    expect(card).toHaveTextContent('—')
    expect(card).not.toHaveTextContent(/—\s*kg/)
  })
})

describe('StageCards — 종합 카드의 구간 완료율', () => {
  it('적치(S1~S4) · 가공(S6 · S7) · 가공(S8~S10) 셋으로 나누고, 구간마다 완료 양 합 ÷ 대상 양 합을 적는다', () => {
    setup(null)
    /* 세 구간은 종합과 따로 선 카드에 있다 */
    const overall = screen.getByLabelText('구간별 완료율')
    const pctOf = (ids: string[]) => {
      const cards = summary.stages.filter((s) => ids.includes(s.stage) && s.code !== null)
      const target = cards.reduce((n, s) => n + s.targetQty, 0)
      const done = cards.reduce((n, s) => n + s.doneQty, 0)
      return Math.round((done / target) * 1000) / 10
    }
    expect(overall).toHaveTextContent(new RegExp(`적치\\s*S1~S4\\s*강판 중량\\s*${pctOf(['S1', 'S2', 'S3', 'S4'])}%`))
    expect(overall).toHaveTextContent(new RegExp(`가공\\s*S6 · S7\\s*도면 시수\\s*${pctOf(['S6', 'S7'])}%`))
    expect(overall).toHaveTextContent(new RegExp(`가공\\s*S8~S10\\s*부재 수\\s*${pctOf(['S8', 'S9', 'S10'])}%`))
  })
})

describe('StageCards — 레거시 정산 · 종합은 따로 선 카드', () => {
  it('레거시 정산 카드와 종합 카드가 각각 서고, 둘 다 누르면 종합 근거(null)를 알린다', async () => {
    const onSelectStage = setup(null)
    await userEvent.click(screen.getByRole('button', { name: '레거시 정산' }))
    expect(onSelectStage).toHaveBeenLastCalledWith(null)
    expect(screen.getByRole('button', { name: /^종합/ })).toHaveTextContent(/\d+(\.\d)?%/)
    expect(screen.getByRole('button', { name: /^종합/ })).not.toHaveTextContent('레거시 정산')
  })
})

describe('StageCards — 카드 배치 옮기기', () => {
  it('카드 이동이 꺼져 있으면(기본) 손잡이가 서지 않는다', () => {
    setup(null)
    expect(screen.queryByRole('button', { name: /^카드 옮기기/ })).not.toBeInTheDocument()
  })

  it('손잡이에 초점을 두고 화살표로 옮기면 배치가 바뀌고 남으며, 되돌리기로 기본 배치가 된다', async () => {
    const user = userEvent.setup()
    renderWithProviders(<StageCards summary={summary} activeStage={null} onSelectStage={() => {}} movable />)
    const order = () => [...document.querySelectorAll('[data-tile]')].map((el) => el.getAttribute('data-tile'))
    expect(order()).toEqual(['sections', 'legacy', 'overall', 'stack', 'fab'])
    expect(screen.queryByRole('button', { name: '카드 배치 되돌리기' })).not.toBeInTheDocument()

    const handle = () => screen.getByRole('button', { name: /^카드 옮기기 — 가공 단계/ })
    handle().focus()
    await user.keyboard('{ArrowUp}')
    expect(order()).toEqual(['sections', 'legacy', 'overall', 'fab', 'stack'])
    expect(JSON.parse(window.localStorage.getItem('otd:fabTileRows') ?? 'null')).toEqual([
      ['sections', 'legacy', 'overall'],
      ['fab'],
      ['stack'],
    ])
    /* 줄을 옮겨 다시 그려져도 초점은 그 손잡이에 남는다 */
    expect(handle()).toHaveFocus()

    await user.click(screen.getByRole('button', { name: '카드 배치 되돌리기' }))
    expect(order()).toEqual(['sections', 'legacy', 'overall', 'stack', 'fab'])
    expect(window.localStorage.getItem('otd:fabTileRows')).toBeNull()
  })
})

describe('StageCards — 구성에서 끈 카드는 숨는다', () => {
  it('끈 구간 · 칸만 빠지고, 구간 셋을 다 끄면 구간 칸째 숨는다', () => {
    const { unmount } = renderWithProviders(
      <StageCards summary={summary} activeStage={null} onSelectStage={() => {}} hidden={new Set(['sec-dwg', 'legacy', 'stack'])} />
    )
    const sections = screen.getByLabelText('구간별 완료율')
    expect(sections).toHaveTextContent(/S1~S4/)
    expect(sections).not.toHaveTextContent(/S6 · S7/)
    expect(sections).toHaveTextContent(/S8~S10/)
    expect(screen.queryByRole('button', { name: '레거시 정산' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^S1 강재 입고/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^S7 절단/ })).toBeInTheDocument()
    unmount()

    renderWithProviders(
      <StageCards summary={summary} activeStage={null} onSelectStage={() => {}} hidden={new Set(['sec-stack', 'sec-dwg', 'sec-part'])} />
    )
    expect(screen.queryByLabelText('구간별 완료율')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^종합/ })).toBeInTheDocument()
  })
})
