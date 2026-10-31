import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes, useLocation } from 'react-router-dom'
import { renderWithProviders } from '../../../lib/testing/renderWithProviders'
import { recordView } from '../../view-history'
import { HistoryMenu } from '../../../widgets/history-menu/HistoryMenu'
import { FavoritesMenu } from '../../../widgets/favorites-menu/FavoritesMenu'
import { BlockTabs } from '../../performance/ui/BlockTabs'
import { FAVORITES_LIMIT, favorites, isFavorite, toggleFavorite } from '../model/favorites'

describe('즐겨찾기 — 저장소', () => {
  it('누르면 넣고 다시 누르면 뺀다 — 최근에 넣은 것이 위, 브라우저에 남는다', () => {
    expect(toggleFavorite('assembly', '7004', '222', 1)).toBe(true)
    expect(toggleFavorite('fabrication', '7004', '310', 2)).toBe(true)
    expect(favorites().map((e) => `${e.zone}:${e.blockNo}`)).toEqual(['fabrication:310', 'assembly:222'])
    expect(JSON.parse(localStorage.getItem('otd:favorites')!)).toHaveLength(2)
    expect(toggleFavorite('assembly', '7004', '222')).toBe(false)
    expect(isFavorite('assembly', '7004', '222')).toBe(false)
  })

  it('같은 블록이라도 화면이 다르면 따로 넣는다', () => {
    toggleFavorite('assembly', '7004', '222')
    toggleFavorite('painting', '7004', '222')
    expect(favorites()).toHaveLength(2)
  })

  it(`${FAVORITES_LIMIT}개가 차면 더 넣지 않는다`, () => {
    for (let i = 0; i < FAVORITES_LIMIT; i++) toggleFavorite('assembly', '7004', String(100 + i))
    expect(toggleFavorite('assembly', '7004', '999')).toBe(false)
    expect(favorites()).toHaveLength(FAVORITES_LIMIT)
  })

  it('다른 브라우저 탭에서 바꾼 것을 따라온다(storage 이벤트)', () => {
    localStorage.setItem('otd:favorites', JSON.stringify([{ zone: 'outfitting', projNo: '7012', blockNo: '233', at: 5 }]))
    window.dispatchEvent(new StorageEvent('storage', { key: 'otd:favorites' }))
    expect(isFavorite('outfitting', '7012', '233')).toBe(true)
  })
})

function Where() {
  const location = useLocation()
  return <p data-testid="where">{location.pathname + location.search}</p>
}

describe('즐겨찾기 — 화면', () => {
  it('블록 탭의 ☆ 로 넣으면 헤더 즐겨찾기에 서고, 줄을 누르면 그 화면으로 간다', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <>
        <FavoritesMenu />
        <BlockTabs projNo="7004" blocks={['222']} active="222" onSelect={() => {}} onClose={() => {}} favoriteZone="assembly" />
        <Routes>
          <Route path="*" element={<Where />} />
        </Routes>
      </>
    )
    await user.click(screen.getByRole('button', { name: '7004-222 즐겨찾기에 넣기' }))
    expect(screen.getByRole('button', { name: '7004-222 즐겨찾기에서 빼기' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: '즐겨찾기' }))
    const list = screen.getByRole('list', { name: '즐겨찾기' })
    await user.click(within(list).getByRole('button', { name: /^조립\s*7004-222$/ }))
    expect(screen.getByTestId('where')).toHaveTextContent('/indoorshop/zones/assembly')
    expect(screen.getByTestId('where')).toHaveTextContent('block=222')
  })

  it('최근 본 화면의 줄에서도 ☆ 로 넣는다 — 줄로 이동하지 않는다', async () => {
    const user = userEvent.setup()
    recordView('painting', '7004', '310')
    renderWithProviders(<HistoryMenu />)
    await user.click(screen.getByRole('button', { name: '최근 본 화면' }))
    await user.click(screen.getByRole('button', { name: '7004-310 즐겨찾기에 넣기' }))
    expect(isFavorite('painting', '7004', '310')).toBe(true)
    expect(screen.getByRole('dialog', { name: '최근 본 화면' })).toBeInTheDocument()
  })

  it('비어 있으면 넣는 방법을 알려 준다', async () => {
    const user = userEvent.setup()
    renderWithProviders(<FavoritesMenu />)
    await user.click(screen.getByRole('button', { name: '즐겨찾기' }))
    expect(screen.getByText(/즐겨찾기한 블록이 없습니다/)).toBeInTheDocument()
  })
})
