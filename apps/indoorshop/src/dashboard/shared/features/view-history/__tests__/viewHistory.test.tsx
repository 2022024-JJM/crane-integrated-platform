import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes, useLocation } from 'react-router-dom'
import { renderWithProviders } from '../../../lib/testing/renderWithProviders'
import { HistoryMenu } from '../../../widgets/history-menu/HistoryMenu'
import { HISTORY_LIMIT, hrefOfEntry, recordView, useViewHistory } from '..'

function Here() {
  const location = useLocation()
  return <output data-testid="here">{location.pathname + location.search}</output>
}

function Entries() {
  const entries = useViewHistory()
  return <output data-testid="count">{entries.length}</output>
}

describe('최근 본 화면 — 기록', () => {
  it('같은 화면의 같은 블록은 새로 쌓지 않고 맨 위로 올린다', () => {
    recordView('assembly', '7004', '222', 1)
    recordView('performance', '7004', '222', 2)
    recordView('assembly', '7004', '222', 3)
    renderWithProviders(<Entries />)
    expect(screen.getByTestId('count')).toHaveTextContent('2')
  })

  it(`${HISTORY_LIMIT}줄을 넘으면 오래된 것부터 버린다`, () => {
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) recordView('fabrication', '7004', String(100 + i), i)
    renderWithProviders(<Entries />)
    expect(screen.getByTestId('count')).toHaveTextContent(String(HISTORY_LIMIT))
  })

  it('줄의 주소는 그 화면의 그 블록이다', () => {
    expect(hrefOfEntry({ zone: 'performance', projNo: '7004', blockNo: '222' })).toBe('/indoorshop/performance?vessel=7004&block=222')
    expect(hrefOfEntry({ zone: 'assembly', projNo: '7004', blockNo: '222' })).toContain('/indoorshop/zones/assembly?')
    expect(hrefOfEntry({ zone: 'fabrication', projNo: '7004', blockNo: '222' })).toBe('/indoorshop/zones/fabrication?vessel=7004&block=222')
  })
})

describe('헤더 히스토리 버튼', () => {
  it('비어 있으면 그렇게 말한다', async () => {
    renderWithProviders(<HistoryMenu />)
    await userEvent.click(screen.getByRole('button', { name: '최근 본 화면' }))
    expect(screen.getByText('아직 열어 본 블록이 없습니다')).toBeInTheDocument()
  })

  it('최근 연 것부터 화면·블록을 늘어놓고, 줄을 누르면 그 화면으로 간다', async () => {
    recordView('assembly', '7004', '222', 1)
    recordView('performance', '2540', '286', 2)
    renderWithProviders(
      <Routes>
        <Route path="*" element={<><HistoryMenu /><Here /></>} />
      </Routes>
    )
    await userEvent.click(screen.getByRole('button', { name: '최근 본 화면' }))
    const list = screen.getByRole('list', { name: '최근 본 화면' })
    /* 줄마다 이동 버튼 + 즐겨찾기 ☆ — 이동 버튼만 고른다 */
    const rows = within(list).getAllByRole('button').filter((b) => !b.hasAttribute('aria-pressed'))
    expect(rows.map((r) => r.textContent)).toEqual([expect.stringContaining('2540-286'), expect.stringContaining('7004-222')])
    expect(rows[0]).toHaveTextContent('통합실적')
    expect(rows[1]).toHaveTextContent('조립')
    await userEvent.click(rows[1])
    expect(screen.getByTestId('here').textContent).toContain('/indoorshop/zones/assembly')
  })
})

describe('헤더 히스토리 — 지금 보고 있는 것', () => {
  it('지금 보고 있는 화면 · 블록은 목록에서 빠지고, 다른 블록으로 옮기면 다시 선다', async () => {
    const { setCurrentView } = await import('../model/viewHistory')
    const { act } = await import('@testing-library/react')
    recordView('assembly', '7004', '222', 1)
    recordView('assembly', '7004', '310', 2)
    setCurrentView({ zone: 'assembly', projNo: '7004', blockNo: '310' })
    renderWithProviders(<HistoryMenu />)
    await userEvent.click(screen.getByRole('button', { name: '최근 본 화면' }))
    const list = screen.getByRole('list', { name: '최근 본 화면' })
    expect(list).not.toHaveTextContent('7004-310')
    expect(list).toHaveTextContent('7004-222')
    act(() => setCurrentView({ zone: 'assembly', projNo: '7004', blockNo: '222' }))
    expect(list).toHaveTextContent('7004-310')
    expect(list).not.toHaveTextContent('7004-222')
    act(() => setCurrentView(null))
  })
})

describe('헤더 히스토리 — 화면 이름 꼬리표', () => {
  it('화면마다 야드 맵 공정 색으로 칠해 서로 다른 색이다', async () => {
    recordView('performance', '7004', '100', 1)
    recordView('fabrication', '7004', '101', 2)
    recordView('assembly', '7004', '102', 3)
    recordView('outfitting', '7004', '103', 4)
    recordView('painting', '7004', '104', 5)
    renderWithProviders(<HistoryMenu />)
    await userEvent.click(screen.getByRole('button', { name: '최근 본 화면' }))
    const colors = [...document.querySelectorAll<HTMLElement>('[data-zone]')].map((el) => el.style.getPropertyValue('--zone'))
    expect(colors).toHaveLength(5)
    expect(new Set(colors).size).toBe(5)
  })
})
