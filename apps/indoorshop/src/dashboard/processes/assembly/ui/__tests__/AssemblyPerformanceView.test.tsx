import { afterEach, describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../shared/lib/testing/renderWithProviders'
import {
  blockOptionsOfVessel,
  clearSelection,
  listVessels,
  recallSelection,
  rememberSelection,
} from '../../../../shared/entities/vessel'
import { recordView, viewHistory } from '../../../../shared/features/view-history/model/viewHistory'
import { HistoryMenu } from '../../../../shared/widgets/history-menu/HistoryMenu'
import { AssemblyPerformanceView } from '../AssemblyPerformanceView'

/*
 * 조립 화면의 [실적] 갈래 — 통합실적의 조회 바를 쓰되 조립만 찾는다(사용자 확정).
 */
describe('AssemblyPerformanceView', () => {
  it('공정 세그먼트 없이 호선 · 블록 · 초기화만 선다 — 조회 버튼은 없다', async () => {
    renderWithProviders(<AssemblyPerformanceView />)

    expect(screen.getByRole('combobox', { name: /호선 번호/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '조회' })).not.toBeInTheDocument()
    expect(screen.queryByRole('radiogroup', { name: '공정 단계' })).not.toBeInTheDocument()
    expect(screen.queryByText('가공')).not.toBeInTheDocument()
    expect(screen.getByText('호선 번호를 선택하세요')).toBeInTheDocument()
  })

  it('조회하면 조립 실적만 낸다 — 가공 절점 카드는 없다', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AssemblyPerformanceView />)

    const select = screen.getByRole('combobox', { name: /호선 번호/ })
    /* 호선 목록이 들어올 때까지 */
    await waitFor(() => expect(select.querySelectorAll('option').length).toBeGreaterThan(1))
    const first = [...select.querySelectorAll('option')].find((option) => option.value !== '')
    expect(first).toBeDefined()
    await user.selectOptions(select, first!.value)
    await user.click(screen.getByRole('button', { name: /블록 선택/ }))
    await user.click(within(screen.getByRole('list', { name: '블록' })).getAllByRole('checkbox')[0])
    await user.click(screen.getByRole('button', { name: '확인' }))

    expect(await screen.findByText('조립 — 블록·ASSY 실적')).toBeInTheDocument()
    expect(screen.queryByText('호선 번호를 선택하세요')).not.toBeInTheDocument()
  })
  it('블록은 「블록 선택」 창에서 체크하고 확인하면 탭이 된다', async () => {
    const user = userEvent.setup()
    /* 앞 검사가 남긴 직전 선택(통합실적과 공유)을 비우고 시작한다 */
    clearSelection()
    renderWithProviders(<AssemblyPerformanceView />)

    const vesselSelect = screen.getByRole('combobox', { name: /호선 번호/ })
    const picker = screen.getByRole('button', { name: /블록 선택/ })
    expect(picker).toBeDisabled()
    await waitFor(() => expect(vesselSelect.querySelectorAll('option').length).toBeGreaterThan(1))
    const vessel = listVessels().find((v) => blockOptionsOfVessel(v.projNo).length > 1)!
    await user.selectOptions(vesselSelect, vessel.projNo)

    /* 호선을 고르면 블록은 아무것도 골라져 있지 않다 — 조회도 아직 서지 않는다 */
    const blocks = blockOptionsOfVessel(vessel.projNo).map((b) => b.blockNo)
    expect(await screen.findByText('블록을 선택하세요')).toBeInTheDocument()
    expect(screen.queryByRole('tablist', { name: '블록 탭' })).not.toBeInTheDocument()
    expect(recallSelection()).toEqual({ projNo: vessel.projNo, blocks: [] })

    /* 체크박스로 둘을 고르고 확인을 누르면 그 둘이 탭이 된다 — 확인 전에는 탭이 서지 않는다 */
    await user.click(screen.getByRole('button', { name: /블록 선택/ }))
    await user.click(screen.getByRole('checkbox', { name: new RegExp(`^${blocks[0]}`) }))
    await user.click(screen.getByRole('checkbox', { name: new RegExp(`^${blocks[1]}`) }))
    expect(screen.queryByRole('tablist', { name: '블록 탭' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '확인' }))
    const tabs = await screen.findByRole('tablist', { name: '블록 탭' })
    expect(within(tabs).getAllByRole('tab')).toHaveLength(2)
    expect(within(tabs).getByRole('tab', { selected: true })).toHaveTextContent(blocks[0])
    expect(recallSelection()?.blocks).toEqual([blocks[0], blocks[1]])

    /* 탭을 누르면 그 블록만 보이고, 지금 탭이 다른 화면과 공유하는 자리에 남는다 */
    await user.click(within(tabs).getByRole('tab', { name: new RegExp(blocks[0]) }))
    /* 제목 옆 `호선-블록` 표기는 걷었다(제목이 블록 탭 밖 맨 위로 올라감) — 고른 탭이 그 블록을 말한다 */
    expect(within(tabs).getByRole('tab', { name: new RegExp(blocks[0]) })).toHaveAttribute('aria-selected', 'true')
    expect(recallSelection()?.active).toBe(blocks[0])
  })
  it('보던 탭의 체크를 풀고 확인하면 그 탭이 빠지고 남은 탭으로 선다', async () => {
    const user = userEvent.setup()
    const vessel = listVessels().find((v) => blockOptionsOfVessel(v.projNo).length > 1)!
    const blocks = blockOptionsOfVessel(vessel.projNo).map((b) => b.blockNo)
    rememberSelection({ projNo: vessel.projNo, blocks: [blocks[0], blocks[1]], active: blocks[1] })
    renderWithProviders(<AssemblyPerformanceView />)
    const tabs = await screen.findByRole('tablist', { name: '블록 탭' })

    await user.click(screen.getByRole('button', { name: /블록 선택/ }))
    await user.click(screen.getByRole('checkbox', { name: new RegExp(`^${blocks[1]}`) }))
    await user.click(screen.getByRole('button', { name: '확인' }))
    await waitFor(() => expect(within(tabs).getAllByRole('tab')).toHaveLength(1))
    expect(within(tabs).getByRole('tab', { selected: true })).toHaveTextContent(blocks[0])
    clearSelection()
  })

  it('조회 버튼을 누르지 않아도 호선을 고르는 즉시 조회된다', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AssemblyPerformanceView />)

    const select = screen.getByRole('combobox', { name: /호선 번호/ })
    await waitFor(() => expect(select.querySelectorAll('option').length).toBeGreaterThan(1))
    const first = [...select.querySelectorAll('option')].find((option) => option.value !== '')!
    await user.selectOptions(select, first.value)
    await user.click(screen.getByRole('button', { name: /블록 선택/ }))
    await user.click(within(screen.getByRole('list', { name: '블록' })).getAllByRole('checkbox')[0])
    await user.click(screen.getByRole('button', { name: '확인' }))

    /* 블록 선택 창의 확인이 곧 조회다 — 조회 버튼은 따로 없다 */
    expect(await screen.findByText('조립 — 블록·ASSY 실적')).toBeInTheDocument()
    await waitFor(() => expect(recallSelection()?.blocks).toHaveLength(1))
    expect(recallSelection()?.projNo).toBe(first.value)
  })
})

describe('AssemblyPerformanceView — 통합실적과 조회 조건 싱크', () => {
  afterEach(() => clearSelection())

  it('통합실적에서 굳힌 조건으로 들어와 곧바로 조회까지 선다', async () => {
    const [vessel] = listVessels()
    const [first] = blockOptionsOfVessel(vessel.projNo)
    rememberSelection({ projNo: vessel.projNo, blocks: [first.blockNo] })
    renderWithProviders(<AssemblyPerformanceView />)

    /* 호선 목록이 들어오면 그 호선이 골라져 있다 */
    await waitFor(() => expect(screen.getByRole('combobox', { name: /호선 번호/ })).toHaveValue(vessel.projNo))
    expect(await screen.findByText('조립 — 블록·ASSY 실적')).toBeInTheDocument()
    expect(await screen.findByRole('tab', { selected: true })).toHaveTextContent(first.blockNo)
  })

  it('호선만 골라 둔 채로 들어오면 호선만 서고 블록은 비어 있다', async () => {
    const [vessel] = listVessels()
    rememberSelection({ projNo: vessel.projNo, blocks: [] })
    renderWithProviders(<AssemblyPerformanceView />)

    await waitFor(() => expect(screen.getByRole('combobox', { name: /호선 번호/ })).toHaveValue(vessel.projNo))
    expect(await screen.findByText('블록을 선택하세요')).toBeInTheDocument()
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
  })

  it('다른 화면에서 보던 블록 탭으로 선다 — 권역 화면 간 탭 싱크', async () => {
    const vessel = listVessels().find((v) => blockOptionsOfVessel(v.projNo).length > 1)!
    const blocks = blockOptionsOfVessel(vessel.projNo).map((b) => b.blockNo)
    rememberSelection({ projNo: vessel.projNo, blocks, active: blocks[1] })
    renderWithProviders(<AssemblyPerformanceView />)

    const tabs = await screen.findByRole('tablist', { name: '블록 탭' })
    expect(within(tabs).getAllByRole('tab')).toHaveLength(blocks.length)
    expect(within(tabs).getByRole('tab', { selected: true })).toHaveTextContent(blocks[1])
  })

  it('여기서 조회하면 통합실적이 같은 조건을 되살리고, 초기화하면 함께 지운다', async () => {
    const user = userEvent.setup()
    const [vessel] = listVessels()
    renderWithProviders(<AssemblyPerformanceView />)

    const select = screen.getByRole('combobox', { name: /호선 번호/ })
    await waitFor(() => expect(select.querySelectorAll('option').length).toBeGreaterThan(1))
    await user.selectOptions(select, vessel.projNo)
    await user.click(screen.getByRole('button', { name: /블록 선택/ }))
    await user.click(within(screen.getByRole('list', { name: '블록' })).getAllByRole('checkbox')[0])
    await user.click(screen.getByRole('button', { name: '확인' }))
    await waitFor(() => expect(recallSelection()?.blocks).toHaveLength(1))
    expect(recallSelection()?.projNo).toBe(vessel.projNo)

    await user.click(screen.getByRole('button', { name: '초기화' }))
    expect(recallSelection()).toBeNull()
  })
})

describe('AssemblyPerformanceView — 기준일', () => {
  afterEach(() => clearSelection())

  it('통합실적과 같은 날짜 조건이 선다 — 고르면 그 날짜로 눌린다', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AssemblyPerformanceView />)
    const yesterday = screen.getByRole('button', { name: '어제' })
    expect(screen.getByRole('button', { name: '오늘' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(yesterday)
    await waitFor(() => expect(screen.getByRole('button', { name: '어제' })).toHaveAttribute('aria-pressed', 'true'))
  })

  it('고른 날짜는 다른 탭이 이어받는다 — 주소에 날짜가 없는 이동(헤더 메뉴)이어도', async () => {
    const user = userEvent.setup()
    const first = renderWithProviders(<AssemblyPerformanceView />)
    await user.click(screen.getByRole('button', { name: '어제' }))
    first.unmount()
    /* 날짜 없는 주소로 다시 들어온다 — 다른 공정 화면에서 같은 축을 읽는 것과 같다 */
    renderWithProviders(<AssemblyPerformanceView />)
    expect(screen.getByRole('button', { name: '어제' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('기본은 오늘이다', () => {
    renderWithProviders(<AssemblyPerformanceView />)
    expect(screen.getByRole('button', { name: '오늘' })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('AssemblyPerformanceView — 최근 본 화면', () => {
  afterEach(() => clearSelection())

  it('블록을 열면 조립 화면의 그 블록이 히스토리에 남는다', async () => {
    const [vessel] = listVessels()
    const [first] = blockOptionsOfVessel(vessel.projNo)
    rememberSelection({ projNo: vessel.projNo, blocks: [first.blockNo] })
    renderWithProviders(<AssemblyPerformanceView />)
    await screen.findByRole('tab', { selected: true })
    await waitFor(() =>
      expect(viewHistory()[0]).toMatchObject({ zone: 'assembly', projNo: vessel.projNo, blockNo: first.blockNo })
    )
  })

  it('히스토리에서 고른 블록의 탭이 없으면 새로 열고 그 탭으로 선다 — 열린 탭은 그대로', async () => {
    const user = userEvent.setup()
    const vessel = listVessels().find((v) => blockOptionsOfVessel(v.projNo).length > 1)!
    const blocks = blockOptionsOfVessel(vessel.projNo).map((b) => b.blockNo)
    rememberSelection({ projNo: vessel.projNo, blocks: [blocks[0]] })
    renderWithProviders(
      <>
        <HistoryMenu />
        <AssemblyPerformanceView />
      </>,
      { route: '/indoorshop/zones/assembly?view=performance' }
    )
    const tabs = await screen.findByRole('tablist', { name: '블록 탭' })
    expect(within(tabs).getAllByRole('tab')).toHaveLength(1)

    recordView('assembly', vessel.projNo, blocks[1])
    await user.click(screen.getByRole('button', { name: '최근 본 화면' }))
    await user.click(within(screen.getByRole('list', { name: '최근 본 화면' })).getAllByRole('button')[0])
    await waitFor(() => expect(within(tabs).getAllByRole('tab')).toHaveLength(2))
    expect(within(tabs).getByRole('tab', { selected: true })).toHaveTextContent(blocks[1])
  })
})
