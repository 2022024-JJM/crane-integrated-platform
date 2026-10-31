import { afterEach, describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../shared/lib/testing/renderWithProviders'
import { clearSelection, recallSelection } from '../../../../shared/entities/vessel'

const i18n = (await import('../../../../shared/lib/i18n/config')).default
const { fabricationKo } = await import('../../i18n/ko')
const { fabricationEn } = await import('../../i18n/en')
i18n.addResourceBundle('ko', 'inshop', fabricationKo, true, true)
i18n.addResourceBundle('en', 'inshop', fabricationEn, true, true)

const { FabricationPerformancePage } = await import('../pages/FabricationPerformancePage')

/*
 * 가공 진입(실적) — 통합실적의 조회 바로 가공 공정만 본다(사용자 확정, 다른 공정의 [실적] 과 같은 틀).
 * 조회 조건은 통합실적과 한 벌이라(직전 선택 공유) 검사마다 비운다.
 */
describe('FabricationPerformancePage', () => {
  afterEach(() => clearSelection())

  it('가공 화면은 실적 하나다 — 탭 줄 없이 호선·블록만 고르고, 공정 세그먼트도 없다', () => {
    renderWithProviders(<FabricationPerformancePage />, { route: '/indoorshop/zones/fabrication' })

    expect(screen.queryByRole('navigation', { name: '가공 화면' })).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /호선 번호/ })).toBeInTheDocument()
    expect(screen.queryByRole('radiogroup', { name: '공정 단계' })).not.toBeInTheDocument()
    expect(screen.getByText('호선 번호를 선택하세요')).toBeInTheDocument()
  })

  it('주소에 실린 호선·블록으로 곧바로 가공 절점 카드를 낸다 — 원천 확정 대기 절점은 판별 전', async () => {
    renderWithProviders(<FabricationPerformancePage />, {
      route: '/indoorshop/zones/fabrication?vessel=7004&block=222',
    })
    expect(await screen.findByRole('heading', { name: /가공권역 단계별 실적률/ })).toBeInTheDocument()
    /* 절점 카드는 이벤트 표보다 늦게 설 수 있다 — 카드가 설 때까지 기다린다 */
    await waitFor(() =>
      /* 원천 확정 대기는 서버(C2 pendingSource)가 정한다 — 명세대로 강재 입고(도착) · 1차 · 2차 선별 */
      expect(screen.getAllByText('원천 확정 대기')).toHaveLength(3)
    )
    expect(screen.getAllByText(/절단/).length).toBeGreaterThan(0)
  })

  it('시험 옵션(「테스트」 영역)은 두지 않는다 — 카드 옮기기 손잡이도 서지 않는다', async () => {
    renderWithProviders(<FabricationPerformancePage />, {
      route: '/indoorshop/zones/fabrication?vessel=7004&block=222',
    })
    await waitFor(() => expect(screen.getAllByText('원천 확정 대기')).toHaveLength(3))
    expect(screen.queryByRole('region', { name: '테스트' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^카드 옮기기/ })).not.toBeInTheDocument()
  })

  it('절점 카드를 누르면 그 절점의 세부 창이 뜨고, 닫기로 닫힌다', async () => {
    const user = userEvent.setup()
    renderWithProviders(<FabricationPerformancePage />, {
      route: '/indoorshop/zones/fabrication?vessel=7004&block=222',
    })
    await user.click(await screen.findByRole('button', { name: /^S7 절단/ }))
    const dialog = await screen.findByRole('dialog', { name: 'S7 절단' })
    expect(await within(dialog).findByRole('columnheader', { name: '도면번호' })).toBeInTheDocument()
    /* 계획일 최신순 — 본문 줄만(머리 줄 · 합계 줄은 뺀다) */
    const rows = within(dialog.querySelector('tbody')!).getAllByRole('row')
    const plans = rows.map((row) => within(row).getAllByRole('cell')[3].textContent!)
    expect([...plans].sort().reverse()).toEqual(plans)
    /* 떠 있는 동안 뒤 화면은 스크롤되지 않는다 */
    expect(document.body.style.overflow).toBe('hidden')
    await user.click(within(dialog).getByRole('button', { name: '닫기' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.body.style.overflow).toBe('')
  })

  it('수집 현황은 화면에 펼쳐 두지 않고, 절점 카드의 창에서 그 절점의 것만 본다', async () => {
    const user = userEvent.setup()
    renderWithProviders(<FabricationPerformancePage />, {
      route: '/indoorshop/zones/fabrication?vessel=7004&block=222',
    })
    await user.click(await screen.findByRole('button', { name: /^S1 강재 입고/ }))
    /* 화면에는 수집 현황 표가 없다 — 창 안에만 있다 */
    expect(screen.getByRole('dialog').parentElement!.contains(screen.queryAllByRole('table')[0] ?? null) || screen.queryAllByRole('table').length === 0).toBe(true)
    const dialog = await screen.findByRole('dialog', { name: 'S1 강재 입고' })
    await user.click(within(dialog).getByRole('tab', { name: '수집 현황' }))
    const rows = within(dialog).queryAllByRole('row').slice(1)
    /* 세부 데이터 표와 같은 모양 — 첫 칸은 관리번호(도면 DWG · 부재 PC) */
    for (const row of rows) expect(within(row).getAllByRole('cell')[0]).toHaveTextContent(/^(DWG|PC)/)
  })

  it('종합 카드는 종합 근거만, 레거시 정산 카드는 레거시 정산 근거만 띄운다 — 탭 없이', async () => {
    const user = userEvent.setup()
    renderWithProviders(<FabricationPerformancePage />, {
      route: '/indoorshop/zones/fabrication?vessel=7004&block=222',
    })
    await user.click(await screen.findByRole('button', { name: /^종합/ }))
    const auto = await screen.findByRole('dialog', { name: '판별 실적' })
    expect(within(auto).queryByRole('tab')).not.toBeInTheDocument()
    expect(await within(auto).findByRole('columnheader', { name: '대상 시수(MH)' })).toBeInTheDocument()
    expect(within(auto).queryByRole('columnheader', { name: '정산 진도율' })).not.toBeInTheDocument()
    await user.click(within(auto).getByRole('button', { name: '닫기' }))

    await user.click(screen.getByRole('button', { name: '레거시 정산' }))
    const legacy = await screen.findByRole('dialog', { name: '레거시 정산' })
    expect(within(legacy).queryByRole('tab')).not.toBeInTheDocument()
    expect(await within(legacy).findByRole('columnheader', { name: '정산 진도율' })).toBeInTheDocument()
    expect(within(legacy).queryByRole('columnheader', { name: '대상 시수(MH)' })).not.toBeInTheDocument()
  })

  it('절점 카드에 그 창의 세부 데이터 · 수집 현황 줄 수를 적고, 창의 줄 수와 같다', async () => {
    const user = userEvent.setup()
    renderWithProviders(<FabricationPerformancePage />, {
      route: '/indoorshop/zones/fabrication?vessel=7004&block=222',
    })
    const card = await screen.findByRole('button', { name: /^S6 전처리/ })
    await waitFor(() => expect(card).toHaveTextContent(/세부 \d+건 · 수집 \d+건/))
    const [, detail, events] = card.textContent!.match(/세부 (\d+)건 · 수집 (\d+)건/)!
    await user.click(card)
    const dialog = await screen.findByRole('dialog', { name: 'S6 전처리' })
    expect(await within(dialog).findByRole('radio', { name: new RegExp(`^전체 ${detail}$`) })).toBeInTheDocument()
    await user.click(within(dialog).getByRole('tab', { name: '수집 현황' }))
    expect(within(within(dialog).getByRole('navigation', { name: '수집 데이터가 있는 세부 데이터' })).getByRole('button', { name: /^전체/ })).toHaveTextContent(`${events}건`)
  })

  it('세부 줄마다 수집 현황 건수가 붙고, 누르면 그 도면의 사건만 본다', async () => {
    const user = userEvent.setup()
    renderWithProviders(<FabricationPerformancePage />, {
      route: '/indoorshop/zones/fabrication?vessel=7004&block=222&date=2026-10-29&span=30',
    })
    await user.click(await screen.findByRole('button', { name: /^S7 절단/ }))
    const dialog = await screen.findByRole('dialog', { name: 'S7 절단' })
    expect(await within(dialog).findByRole('columnheader', { name: '수집' })).toBeInTheDocument()
    const open = within(dialog).getAllByRole('button', { name: /수집 현황 \d+건 보기$/ })[0]
    const [, id, n] = open.getAttribute('aria-label')!.match(/^(\S+) 수집 현황 (\d+)건 보기$/)!
    await user.click(open)
    /* 수집 현황 탭 왼쪽 목록에서 그 도면이 골라져 있다 */
    const targets = within(dialog).getByRole('navigation', { name: '수집 데이터가 있는 세부 데이터' })
    expect(within(targets).getByRole('button', { pressed: true })).toHaveTextContent(id)
    /* 들어오자마자 첫 사건의 하위 데이터가 선다 — 행을 다시 누르지 않아도 된다 */
    expect(await within(dialog).findByText(/^관리 단위:/)).toBeInTheDocument()
    /* 첫 표가 수집 현황 — 오른쪽 하위 데이터 표는 빼고 센다 */
    const rows = within(within(dialog).getAllByRole('table')[0]).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(Number(n))
    for (const row of rows) expect(row).toHaveTextContent(id)
    /* 목록의 '전체' 로 돌아가면 그 절점의 사건 전부 */
    await user.click(within(targets).getByRole('button', { name: /^전체/ }))
    expect(within(targets).getByRole('button', { pressed: true })).toHaveTextContent('전체')
    /* 목록에는 수집 데이터가 있는 줄만 선다 */
    for (const b of within(targets).getAllByRole('button')) expect(b).not.toHaveTextContent(/^\S+0건$/)
  })

  it('S7 카드의 곡가공 보조 줄을 창의 곡가공 탭에서 부재 단위로 본다 — 숫자가 같다', async () => {
    const user = userEvent.setup()
    renderWithProviders(<FabricationPerformancePage />, {
      route: '/indoorshop/zones/fabrication?vessel=4392&block=139',
    })
    const card = await screen.findByRole('button', { name: /^S7 절단/ })
    const [, done, target] = card.textContent!.match(/곡가공 (\d+)\/(\d+)/)!
    await user.click(card)
    const dialog = await screen.findByRole('dialog', { name: 'S7 절단' })
    const tabs = (await within(dialog).findAllByRole('tab')).map((tab) => tab.textContent)
    expect(tabs).toEqual(['세부 데이터', '곡가공', '수집 현황'])
    await user.click(within(dialog).getByRole('tab', { name: '곡가공' }))
    expect(within(dialog).getByRole('columnheader', { name: '부재번호' })).toBeInTheDocument()
    /* 곡가공은 수집 현황에 세우지 않으므로 수집 열이 없다 */
    expect(within(dialog).queryByRole('columnheader', { name: '수집' })).not.toBeInTheDocument()
    expect(within(dialog).getByRole('radio', { name: new RegExp(`^완료 ${done}$`) })).toBeInTheDocument()
    expect(within(dialog).getByRole('radio', { name: /^전체 \d+$/ }).textContent).toMatch(new RegExp(`${Number(target)}$`))
  })

  it.each([
    ['S1 강재 입고', true],
    ['S6 전처리', false],
    ['S9 모둠선별', false],
  ] as const)('%s 창 세부 데이터 표의 합계가 카드 숫자와 같다', async (name, mat) => {
    const user = userEvent.setup()
    renderWithProviders(<FabricationPerformancePage />, {
      route: '/indoorshop/zones/fabrication?vessel=7012&block=233',
    })
    const card = await screen.findByRole('button', { name: new RegExp(`^${name}`) })
    const counts = card.textContent!.match(/(강판|도면|부재) (\d+)\/(\d+)(장|개)/)!
    await user.click(card)
    const dialog = await screen.findByRole('dialog', { name })
    /* 탭 바로 밑의 카드 요약 줄은 없다(사용자 확정) — 합계 줄이 카드 숫자를 말한다 */
    expect(within(dialog).queryByLabelText('카드 요약')).not.toBeInTheDocument()
    await waitFor(() => expect(dialog.querySelector('tfoot')).not.toBeNull())
    const foot = dialog.querySelector('tfoot')!
    expect(foot).toHaveTextContent('합계 (미대상 제외)')
    if (mat) {
      /* 강재: 표의 강판 합계가 카드의 강판 장수 — 거르기 숫자는 도면 수라고 밝힌다 */
      expect(foot).toHaveTextContent(`${counts[2]}/${counts[3]}`)
      expect(within(dialog).getByText(/거르기 숫자는 도면 수/)).toBeInTheDocument()
    }
    /* 양 합계(완료 / 대상)가 카드의 양과 같다 */
    const qty = card.textContent!.match(/([\d,.]+) \/ ([\d,.]+) (kg|MH)/)
    if (qty) expect(foot).toHaveTextContent(`${qty[1]} / ${qty[2]}`)
  })

  it('호선을 고르면 블록은 비어 있고, 블록을 누르면 조회한다', async () => {
    const user = userEvent.setup()
    renderWithProviders(<FabricationPerformancePage />, { route: '/indoorshop/zones/fabrication' })

    const select = screen.getByRole('combobox', { name: /호선 번호/ })
    await waitFor(() => expect(select.querySelectorAll('option').length).toBeGreaterThan(1))
    const vessel = [...select.querySelectorAll('option')].find((option) => option.value !== '')!
    await user.selectOptions(select, vessel.value)
    expect(await screen.findByText('블록을 선택하세요')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /블록 선택/ }))
    await user.click(within(screen.getByRole('list', { name: '블록' })).getAllByRole('checkbox')[0])
    await user.click(screen.getByRole('button', { name: '확인' }))
    expect(await screen.findByRole('heading', { name: /가공권역 단계별 실적률/ })).toBeInTheDocument()
    await waitFor(() => expect(recallSelection()?.blocks).toHaveLength(1))
  })
})
