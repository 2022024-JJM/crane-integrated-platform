import { describe, expect, it } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { useFrozenOrder } from '../useFrozenOrder'

/*
 * 상호작용 중 순서 동결 (링크 스모크 ⑧) — 손이 얹힌 동안 표적이 도망가지 않는다.
 */
interface Row {
  id: string
  status: string
}

/** 밖에서 순서를 뒤집을 수 있는 목록 — 폴링 틱을 흉내 낸다 */
function List({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState(initial)
  const order = useFrozenOrder(rows, (row: Row) => row.id)
  return (
    <div>
      <button type="button" onClick={() => setRows((r) => [...r].reverse())}>
        틱
      </button>
      <ul aria-label="목록" {...order.handlers}>
        {order.items.map((row) => (
          <li key={row.id}>
            <button type="button">{`${row.id}:${row.status}`}</button>
          </li>
        ))}
      </ul>
      <span data-testid="frozen">{String(order.frozen)}</span>
    </div>
  )
}

const ROWS: Row[] = [
  { id: 'A', status: 'ok' },
  { id: 'B', status: 'ok' },
]
const labels = () => screen.getAllByRole('listitem').map((li) => li.textContent)

describe('useFrozenOrder', () => {
  it('손이 없으면 준 순서 그대로 따라간다', () => {
    render(<List initial={ROWS} />)
    expect(labels()).toEqual(['A:ok', 'B:ok'])
    act(() => screen.getByRole('button', { name: '틱' }).click())
    expect(labels()).toEqual(['B:ok', 'A:ok'])
  })

  it('손이 얹히면 자리가 언다 — 그동안 재정렬이 와도 행이 안 움직인다', () => {
    render(<List initial={ROWS} />)
    fireEvent.mouseEnter(screen.getByRole('list', { name: '목록' }))
    expect(screen.getByTestId('frozen').textContent).toBe('true')
    act(() => screen.getByRole('button', { name: '틱' }).click())
    expect(labels()).toEqual(['A:ok', 'B:ok'])
  })

  it('손을 떼면 녹아 최신 순서로 선다', () => {
    render(<List initial={ROWS} />)
    const list = screen.getByRole('list', { name: '목록' })
    fireEvent.mouseEnter(list)
    act(() => screen.getByRole('button', { name: '틱' }).click())
    fireEvent.mouseLeave(list)
    expect(labels()).toEqual(['B:ok', 'A:ok'])
  })

  it('키보드 포커스도 얼린다 — 줄 사이 이동으로는 녹지 않는다', () => {
    render(<List initial={ROWS} />)
    const list = screen.getByRole('list', { name: '목록' })
    const [first, second] = screen.getAllByRole('button', { name: /:/ })
    /* 실제로 줄 하나에 포커스를 준다 — 캡처 단계에서 목록이 그것을 받는다 */
    act(() => first.focus())
    expect(screen.getByTestId('frozen').textContent).toBe('true')
    /* 목록 안의 다른 줄로 옮겨 가는 blur 는 무시한다 */
    fireEvent.blur(list, { relatedTarget: second })
    expect(screen.getByTestId('frozen').textContent).toBe('true')
    /* 목록 밖으로 나가면 녹는다 */
    fireEvent.blur(list, { relatedTarget: document.body })
    expect(screen.getByTestId('frozen').textContent).toBe('false')
  })
})
