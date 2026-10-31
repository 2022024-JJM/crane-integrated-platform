import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../lib/testing/renderWithProviders'
import { shiftDate, todayString } from '../../features/performance/lib/baseDate'
import { PerformancePage } from '../PerformancePage'

/**
 * 통합실적 화면의 **기준일 전파** (W7-2).
 *
 * 시간축을 별도 화면으로 두지 않기로 했으므로(사용자 확정), 기준일이 제대로 흐르는지는
 * 이 화면 하나에서만 확인할 수 있다. 여기서 보는 것은 데이터 값이 아니라 **경로**다:
 *
 *   URL(`?date=`) → 컨트롤 → 조회(블록 요약 카드)
 *
 * 그리고 그 경로에서 가장 쉽게 깨지는 두 곳을 함께 잠근다 —
 *  · 기준일을 바꿔도 **사용자가 굳힌 조회 조건(호선·블록)이 살아남을 것**. 날짜는 조회
 *    조건 하나일 뿐이라, 그것을 옮겼다고 나머지 조건이 초기화되면 시간축이 쓸모없어진다.
 *  · 고른 기준일이 **컨트롤·URL 에 되비칠 것**. 딥링크로 조건을 넘길 수 있는데 날짜만
 *    못 실으면 링크를 받은 사람은 다른 날의 화면을 본다.
 *
 * 값 자체(그날 몇 건인가)는 노드 테스트(`baseDateSnapshot.test.ts`)가 본다.
 */
const TODAY = todayString()
const YESTERDAY = shiftDate(TODAY, -1)

/** 조회까지 끝난 화면 — 딥링크로 들어가면 조회 버튼을 누르지 않아도 결과가 선다 */
async function renderQueried(search = '') {
  const result = renderWithProviders(<PerformancePage />, {
    route: `/indoorshop/performance?vessel=7004&block=222${search}`,
  })
  /* 조회 결과 = 블록 요약 카드(제목이 호선-블록) */
  await screen.findAllByText('7004-222')
  return result
}

describe('URL → 컨트롤', () => {
  it('아무것도 안 붙이면 오늘로 연다', async () => {
    await renderQueried()
    expect(screen.getByRole('button', { name: '오늘' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('종료일')).toHaveValue(TODAY)
  })

  it('`?date=` 로 들어온 날을 그대로 연다', async () => {
    await renderQueried(`&date=${YESTERDAY}`)
    expect(screen.getByLabelText('종료일')).toHaveValue(YESTERDAY)
    expect(screen.getByRole('button', { name: '어제' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('`?span=7` 로 들어오면 지난 7일 창으로 연다', async () => {
    await renderQueried('&span=7')
    expect(screen.getByRole('button', { name: '지난 7일' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    /* 범위는 기간 달력이 말한다(시작일 ~ 종료일) */
    expect(screen.getByLabelText('시작일')).toHaveValue(shiftDate(TODAY, -6))
    expect(screen.getByLabelText('종료일')).toHaveValue(TODAY)
  })

  it('미래 날짜 링크는 오늘로 접혀 열린다 — 남의 링크로 화면이 서지 못하면 안 된다', async () => {
    await renderQueried('&date=2099-01-01')
    expect(screen.getByLabelText('종료일')).toHaveValue(TODAY)
  })
})

describe('컨트롤 → 조회', () => {
  it('기준일을 바꿔도 조회 결과가 그대로 서 있다', async () => {
    await renderQueried()
    /* 조회 결과가 서 있다는 증거 — 섹션 제목 옆의 호선-블록 */
    expect(screen.getAllByText('7004-222').length).toBeGreaterThan(0)

    await userEvent.click(screen.getByRole('button', { name: '어제' }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: '어제' })).toHaveAttribute('aria-pressed', 'true')
    )
    expect(screen.getAllByText('7004-222').length).toBeGreaterThan(0)
    expect(
      screen.queryByText('먼저 호선을 선택하고 조회를 눌러 주세요.')
    ).not.toBeInTheDocument()
  })

  /**
   * 딥링크로 들어온 조건과 **다른** 조건을 굳힌 뒤 날짜를 옮긴다.
   *
   * 딥링크와 같은 조건으로만 검사하면, 조회가 진입 당시 조건으로 되돌아가도 결과가 같아
   * 티가 나지 않는다. 블록을 다른 것으로 바꿔 두면 되돌아간 순간 그 블록이 사라진다.
   */
  it('사용자가 새로 굳힌 조건이 기준일 변경에도 살아남는다', async () => {
    await renderQueried()

    /* 블록 선택 창에서 310 을 체크하고 확인하면 탭이 더해진다 */
    await userEvent.click(screen.getByRole('button', { name: /블록 선택/ }))
    await userEvent.click(screen.getByRole('checkbox', { name: /^310/ }))
    await userEvent.click(screen.getByRole('button', { name: '확인' }))
    await userEvent.click(screen.getByRole('tab', { name: /310/ }))
    await waitFor(() => expect(screen.getAllByText(/7004-310/).length).toBeGreaterThan(0))

    await userEvent.click(screen.getByRole('button', { name: '어제' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '어제' })).toHaveAttribute('aria-pressed', 'true')
    )

    /* 310 이 사라졌다면 조회가 진입 당시 조건으로 되돌아간 것이다 */
    expect(screen.getAllByText(/7004-310/).length).toBeGreaterThan(0)
  })
})

describe('컨트롤 → URL (딥링크 왕복)', () => {
  it('기본값(오늘)에서는 주소에 날짜를 싣지 않는다 — 오늘이 박힌 링크는 내일 거짓이 된다', async () => {
    await renderQueried()
    expect(window.location.search).not.toContain('date=')
  })

  it('고른 기준일이 주소에 되비친다', async () => {
    await renderQueried()
    await userEvent.click(screen.getByRole('button', { name: '어제' }))
    await waitFor(() => expect(screen.getByLabelText('종료일')).toHaveValue(YESTERDAY))
    /* MemoryRouter 는 window.location 을 건드리지 않으므로, 되비침은 컨트롤이 읽는
       상태로 확인한다 — 파라미터 직렬화 자체는 baseDate.test.ts 가 왕복으로 잠근다 */
    expect(screen.getByRole('button', { name: '어제' })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('초기화', () => {
  it("'초기화' 는 시간축도 오늘로 되돌린다 — 지난주를 보면서 초기화라 하면 거짓말이다", async () => {
    await renderQueried(`&date=${YESTERDAY}`)
    expect(screen.getByLabelText('종료일')).toHaveValue(YESTERDAY)

    await userEvent.click(screen.getByRole('button', { name: '초기화' }))

    await waitFor(() => expect(screen.getByLabelText('종료일')).toHaveValue(TODAY))
    expect(screen.getByRole('button', { name: '오늘' })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('통합실적 — 블록 요약만 (사용자 확정)', () => {
  it('공정별 섹션·수집 현황·하위 데이터·권역 탭 없이 블록 요약 카드만 선다', async () => {
    await renderQueried()
    expect(screen.getByText('계획%', { exact: false })).toBeInTheDocument()
    expect(screen.queryByText('가공권역 단계별 실적률')).not.toBeInTheDocument()
    expect(screen.queryByText('조립 — 블록·ASSY 실적')).not.toBeInTheDocument()
    expect(screen.queryByText('수집 현황')).not.toBeInTheDocument()
    expect(screen.queryByText('하위 데이터')).not.toBeInTheDocument()
    /* 블록 선택 옆 권역 탭도 없다 */
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  })
})

describe('블록 카드 공정 줄 → 공정 화면', () => {
  it('가공·조립·의장·도장 줄을 누르면 같은 호선·블록으로 그 공정 화면에 간다', async () => {
    await renderQueried()
    const paths = { 가공: '/indoorshop/zones/fabrication', 조립: '/indoorshop/zones/assembly', 의장: '/indoorshop/zones/outfitting', 도장: '/indoorshop/zones/painting' }
    for (const [name, path] of Object.entries(paths)) {
      const href = screen.getByRole('link', { name: `${name} 화면에서 보기` }).getAttribute('href') ?? ''
      expect(href.startsWith(path)).toBe(true)
      const params = new URLSearchParams(href.split('?')[1])
      expect(params.get('vessel')).toBe('7004')
      expect(params.get('block')).toBe('222')
    }
  })
})

describe('블록 탭 — 고른 블록마다 탭, 화면은 지금 탭의 블록만', () => {
  it('여러 블록으로 들어오면 탭이 서고, 탭을 누르면 그 블록의 요약만 선다', async () => {
    renderWithProviders(<PerformancePage />, { route: '/indoorshop/performance?vessel=7004&block=222,310' })
    const tabs = await screen.findByRole('tablist', { name: '블록 탭' })
    expect(within(tabs).getAllByRole('tab')).toHaveLength(2)
    await screen.findAllByText('7004-222')
    expect(screen.queryAllByText('7004-310')).toHaveLength(0)

    await userEvent.click(within(tabs).getByRole('tab', { name: /310/ }))
    await screen.findAllByText('7004-310')
    expect(screen.queryAllByText('7004-222')).toHaveLength(0)
  })

  it('공정 줄 링크는 고른 블록들과 지금 탭을 함께 싣는다 — 공정 화면이 같은 탭으로 선다', async () => {
    renderWithProviders(<PerformancePage />, { route: '/indoorshop/performance?vessel=7004&block=222,310&active=310' })
    await screen.findAllByText('7004-310')
    const href = screen.getByRole('link', { name: '조립 화면에서 보기' }).getAttribute('href') ?? ''
    const params = new URLSearchParams(href.split('?')[1])
    expect(params.get('block')).toBe('222,310')
    expect(params.get('active')).toBe('310')
  })

  it('탭의 × 로 그 블록을 닫는다 — 보던 탭이면 옆 탭으로, 마지막 탭이면 블록 선택이 빈다', async () => {
    renderWithProviders(<PerformancePage />, { route: '/indoorshop/performance?vessel=7004&block=222,310' })
    const tabs = await screen.findByRole('tablist', { name: '블록 탭' })
    await screen.findAllByText('7004-222')

    await userEvent.click(screen.getByRole('button', { name: '222 탭 닫기' }))
    expect(within(tabs).getAllByRole('tab')).toHaveLength(1)
    expect(within(tabs).getByRole('tab', { selected: true })).toHaveTextContent('310')
    await screen.findAllByText('7004-310')

    await userEvent.click(screen.getByRole('button', { name: '310 탭 닫기' }))
    expect(await screen.findByText('블록을 선택하세요')).toBeInTheDocument()
    expect(screen.queryByRole('tablist', { name: '블록 탭' })).not.toBeInTheDocument()
  })
})
