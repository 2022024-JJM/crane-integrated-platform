import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
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
 *   URL(`?date=`) → 컨트롤 → 조회(카드·그리드·추이)
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
  await screen.findByText('가공권역 단계별 실적률')
  return result
}

describe('URL → 컨트롤', () => {
  it('아무것도 안 붙이면 오늘로 연다', async () => {
    await renderQueried()
    expect(screen.getByRole('button', { name: '오늘' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('날짜')).toHaveValue(TODAY)
  })

  it('`?date=` 로 들어온 날을 그대로 연다', async () => {
    await renderQueried(`&date=${YESTERDAY}`)
    expect(screen.getByLabelText('날짜')).toHaveValue(YESTERDAY)
    expect(screen.getByRole('button', { name: '어제' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('`?span=7` 로 들어오면 지난 7일 창으로 연다', async () => {
    await renderQueried('&span=7')
    expect(screen.getByRole('button', { name: '지난 7일' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    /* 범위는 컨트롤과 그리드 머리 두 곳에서 같은 말로 선다 — 둘이 어긋나면 안 된다 */
    expect(screen.getAllByText(`${shiftDate(TODAY, -6)} ~ ${TODAY}`)).toHaveLength(2)
  })

  it('미래 날짜 링크는 오늘로 접혀 열린다 — 남의 링크로 화면이 서지 못하면 안 된다', async () => {
    await renderQueried('&date=2099-01-01')
    expect(screen.getByLabelText('날짜')).toHaveValue(TODAY)
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
   * 티가 나지 않는다. 블록을 하나 더 얹어 두면 되돌아간 순간 그 블록이 사라진다.
   */
  it('사용자가 새로 굳힌 조건이 기준일 변경에도 살아남는다', async () => {
    await renderQueried()

    /* 블록 하나를 더 얹고 조회로 굳힌다 */
    await userEvent.selectOptions(screen.getByLabelText('+ 블록 추가'), '310')
    await userEvent.click(screen.getByRole('button', { name: '조회' }))
    await waitFor(() => expect(screen.getAllByText(/7004-310/).length).toBeGreaterThan(0))

    await userEvent.click(screen.getByRole('button', { name: '어제' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '어제' })).toHaveAttribute('aria-pressed', 'true')
    )

    /* 310 이 사라졌다면 조회가 진입 당시 조건으로 되돌아간 것이다 */
    expect(screen.getAllByText(/7004-310/).length).toBeGreaterThan(0)
  })

  it('창을 넓히면 조립 추이가 그림으로 선다 — 하루 창에서는 막대 하나라 서지 않는다', async () => {
    await renderQueried()
    expect(screen.queryByRole('img', { name: '일자별 판별 건수 추이' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '지난 7일' }))

    await waitFor(() =>
      expect(screen.getByRole('img', { name: '일자별 판별 건수 추이' })).toBeInTheDocument()
    )
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
    await waitFor(() => expect(screen.getByLabelText('날짜')).toHaveValue(YESTERDAY))
    /* MemoryRouter 는 window.location 을 건드리지 않으므로, 되비침은 컨트롤이 읽는
       상태로 확인한다 — 파라미터 직렬화 자체는 baseDate.test.ts 가 왕복으로 잠근다 */
    expect(screen.getByRole('button', { name: '어제' })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('초기화', () => {
  it("'초기화' 는 시간축도 오늘로 되돌린다 — 지난주를 보면서 초기화라 하면 거짓말이다", async () => {
    await renderQueried(`&date=${YESTERDAY}`)
    expect(screen.getByLabelText('날짜')).toHaveValue(YESTERDAY)

    await userEvent.click(screen.getByRole('button', { name: '초기화' }))

    await waitFor(() => expect(screen.getByLabelText('날짜')).toHaveValue(TODAY))
    expect(screen.getByRole('button', { name: '오늘' })).toHaveAttribute('aria-pressed', 'true')
  })
})

/**
 * **생애주기 순서** — 가공 → 조립 → 의장 → 도장 (R32).
 *
 * 한 블록이 실제로 지나는 차례다. 이 화면은 공정을 세 번 나열한다(조회 조건 바의 세그먼트,
 * 절점 카드의 섹션, 그 위의 공정 레일) — 차례가 서로 다르면 읽는 사람은 그 차이를 뜻으로
 * 읽는다("왜 여기서는 도장이 의장보다 먼저지?"). 레일만 도장 → 의장 이었다.
 *
 * 셋을 한 검사에 묶는 이유가 그것이다: 한 곳만 고치면 나머지 둘과 다시 어긋난다.
 */
describe('공정 나열 — 생애주기 순서 (R32)', () => {
  const LIFECYCLE = ['가공', '조립', '의장', '도장']

  it('공정 레일이 가공 → 조립 → 의장 → 도장 으로 선다', async () => {
    await renderQueried()
    const rail = screen.getByRole('list', { name: /공정 진행 순서/ })
    expect(
      screen.getAllByRole('listitem').filter((chip) => rail.contains(chip)).map((chip) => chip.textContent)
    ).toEqual(LIFECYCLE)
  })

  it('조회 조건 바의 공정 세그먼트도 같은 차례다', async () => {
    await renderQueried()
    const options = screen
      .getAllByRole('radio')
      .map((option) => option.textContent)
      .filter((label): label is string => label !== null)
    expect(options).toEqual(['전체', ...LIFECYCLE])
  })

  it('절점 카드 섹션도 같은 차례로 내려간다', async () => {
    await renderQueried()
    const titles = [
      '가공권역 단계별 실적률',
      '조립 — 블록·ASSY 실적',
      '의장 — 블록 판별',
      '도장 — 스텝 절점',
    ]
    const positions = titles.map((title) => {
      const heading = screen.getByText(title)
      return [...document.querySelectorAll('h2, h3')].indexOf(heading.closest('h2, h3')!)
    })
    expect(positions.every((at) => at >= 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
  })
})
