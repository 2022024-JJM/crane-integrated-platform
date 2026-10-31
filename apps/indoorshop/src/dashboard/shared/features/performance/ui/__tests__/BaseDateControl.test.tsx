import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../lib/testing/renderWithProviders'
import { defaultSelection, MAX_SPAN_DAYS, selectionOfDate, selectionOfPreset, selectionOfRange } from '../../lib/baseDate'
import { BaseDateControl } from '../BaseDateControl'

/**
 * 기준일 컨트롤의 계약 (W7-2).
 *
 * 시간축 UI 는 이 컨트롤 하나뿐이라(별도 화면을 두지 않기로 했다), 여기서 못 하는 것은
 * 화면 전체에서 못 한다. 그래서 **할 수 있어야 하는 것**과 **할 수 없어야 하는 것**을
 * 나란히 잠근다 — 세 프리셋과 달력으로 옮길 수 있을 것, 미래로는 못 갈 것.
 */
const TODAY = '2026-09-03'

function setup(selection = defaultSelection(TODAY)) {
  const onChange = vi.fn()
  renderWithProviders(
    <BaseDateControl selection={selection} onChange={onChange} today={TODAY} />
  )
  return { onChange }
}

describe('세 프리셋', () => {
  it('오늘·어제·지난 7일이 나란히 선다', () => {
    setup()
    const group = screen.getByRole('group', { name: '기준일' })
    expect(group).toBeInTheDocument()
    for (const label of ['오늘', '어제', '지난 7일']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
  })

  it("'어제' 를 누르면 기준일이 하루 뒤로 옮겨진다 (창을 넓히는 게 아니다)", async () => {
    const { onChange } = setup()
    await userEvent.click(screen.getByRole('button', { name: '어제' }))
    expect(onChange).toHaveBeenCalledWith(selectionOfPreset('yesterday', TODAY))
    expect(onChange.mock.calls[0][0].date).toBe('2026-09-02')
    expect(onChange.mock.calls[0][0].spanDays).toBe(1)
  })

  it("'지난 7일' 은 기준일을 그대로 두고 창을 넓힌다", async () => {
    const { onChange } = setup()
    await userEvent.click(screen.getByRole('button', { name: '지난 7일' }))
    expect(onChange.mock.calls[0][0]).toEqual({ date: TODAY, spanDays: 7, preset: 'last7' })
  })

  it('지금 고른 프리셋만 눌린 것으로 선다', () => {
    setup(selectionOfPreset('last7', TODAY))
    expect(screen.getByRole('button', { name: '지난 7일' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.getByRole('button', { name: '오늘' })).toHaveAttribute('aria-pressed', 'false')
  })
})

describe('기간 달력 — 시작일 ~ 종료일', () => {
  it('지금 창을 두 칸으로 보여 준다 — 하루 창이면 두 칸이 같은 날', () => {
    setup(selectionOfDate('2026-08-20', TODAY))
    expect(screen.getByLabelText('시작일')).toHaveValue('2026-08-20')
    expect(screen.getByLabelText('종료일')).toHaveValue('2026-08-20')
  })

  it('미래를 고를 수 없다 — 두 칸 모두 오늘이 상한이다', () => {
    setup()
    expect(screen.getByLabelText('시작일')).toHaveAttribute('max', TODAY)
    expect(screen.getByLabelText('종료일')).toHaveAttribute('max', TODAY)
  })

  /* 날짜 입력은 한 글자씩 치는 물건이 아니다(달력 위젯이 값을 통째로 바꾼다) —
     userEvent.type 은 jsdom 의 date 입력에서 값을 만들지 못하므로 change 로 준다 */
  it('시작일을 앞당기면 종료일까지의 기간이 된다', () => {
    const { onChange } = setup(selectionOfDate('2026-08-20', TODAY))
    fireEvent.change(screen.getByLabelText('시작일'), { target: { value: '2026-08-11' } })
    expect(onChange.mock.calls[0][0]).toEqual({ date: '2026-08-20', spanDays: 10, preset: 'custom' })
  })

  it('종료일을 시작일보다 앞으로 옮기면 시작일도 따라온다 — 하루 창', () => {
    const { onChange } = setup(selectionOfRange('2026-08-11', '2026-08-20', TODAY))
    fireEvent.change(screen.getByLabelText('종료일'), { target: { value: '2026-08-05' } })
    expect(onChange.mock.calls[0][0]).toEqual({ date: '2026-08-05', spanDays: 1, preset: 'custom' })
  })

  it('시작일을 종료일 뒤로 옮기면 종료일이 따라간다', () => {
    const { onChange } = setup(selectionOfDate('2026-08-20', TODAY))
    fireEvent.change(screen.getByLabelText('시작일'), { target: { value: '2026-08-25' } })
    expect(onChange.mock.calls[0][0]).toEqual({ date: '2026-08-25', spanDays: 1, preset: 'custom' })
  })

  it('미래를 억지로 밀어 넣어도 오늘로 접힌다 — 모델이 한 번 더 막는다', () => {
    const { onChange } = setup()
    fireEvent.change(screen.getByLabelText('종료일'), { target: { value: '2099-01-01' } })
    expect(onChange.mock.calls[0][0].date).toBe(TODAY)
  })

  it('오늘까지 7일을 고르면 지난 7일 버튼이 눌린 것으로 선다', () => {
    setup(selectionOfRange('2026-08-28', TODAY, TODAY))
    expect(screen.getByRole('button', { name: '지난 7일' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('달력으로 어제를 고르면 어제 버튼이 눌린 것으로 선다 — 같은 상태를 두 이름으로 부르지 않는다', () => {
    setup(selectionOfDate('2026-09-02', TODAY))
    expect(screen.getByRole('button', { name: '어제' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('그 밖의 날은 어느 버튼도 눌리지 않는다', () => {
    setup(selectionOfDate('2026-08-20', TODAY))
    for (const label of ['오늘', '어제', '지난 7일']) {
      expect(screen.getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'false')
    }
  })

  it('기간이면 며칠인지 적는다 — 7일치를 보면서 하루치로 읽지 않게', () => {
    setup(selectionOfPreset('last7', TODAY))
    expect(screen.getByText('7일')).toBeInTheDocument()
  })

  it('너무 긴 기간은 석 달로 자른다(종료일 기준)', () => {
    expect(selectionOfRange('2025-01-01', '2026-08-20', TODAY).spanDays).toBe(MAX_SPAN_DAYS)
  })
})
