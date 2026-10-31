import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLocation } from 'react-router-dom'
import { renderWithProviders } from '../../../lib/testing/renderWithProviders'
import { ScreenPreviewDialog } from '../ui/ScreenPreviewDialog'
import { withEmbed, withoutEmbed } from '../../../lib/embedMode'

/*
 * 야드 맵의 화면 창 — 화면을 떠나지 않고 3D·실적·현황을 본다. 같은 앱을 임베드 모드로 연다.
 */
describe('ScreenPreviewDialog', () => {
  const preview = { href: '/indoorshop/performance?vessel=5510&block=553', title: '5510-553 · 통합실적' }

  it('제목과 함께 그 화면을 임베드 모드로 연다', () => {
    renderWithProviders(<ScreenPreviewDialog preview={preview} onClose={() => {}} />)
    expect(screen.getByRole('dialog', { name: preview.title })).toBeInTheDocument()
    expect(screen.getByTitle(preview.title).getAttribute('src')).toBe(
      '/indoorshop/performance?vessel=5510&block=553&embed=1',
    )
  })

  it('× 와 ESC 로 닫는다', async () => {
    const onClose = vi.fn()
    renderWithProviders(<ScreenPreviewDialog preview={preview} onClose={onClose} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '닫기' }))
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})

describe('ScreenPreviewDialog 확장', () => {
  /* 지금 라우터 주소를 화면에 적는다 — 이동했는지 본다 */
  function Where() {
    const location = useLocation()
    return <output data-testid="where">{location.pathname + location.search}</output>
  }

  it('× 왼쪽의 확장 버튼이 창을 닫고 그 페이지로 이동한다', async () => {
    const onClose = vi.fn()
    renderWithProviders(
      <>
        <ScreenPreviewDialog preview={{ href: '/indoorshop/performance?vessel=5510', title: '실적' }} onClose={onClose} />
        <Where />
      </>
    )
    const buttons = screen.getAllByRole('button')
    const expand = screen.getByRole('button', { name: '페이지로 열기' })
    /* 순서 — 확장이 닫기 바로 왼쪽 */
    expect(buttons.indexOf(expand)).toBe(buttons.indexOf(screen.getByRole('button', { name: '닫기' })) - 1)
    await userEvent.setup().click(expand)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('where')).toHaveTextContent('/indoorshop/performance?vessel=5510')
  })
})

describe('withEmbed', () => {
  it('쿼리가 있든 없든 embed=1 을 잇는다', () => {
    expect(withEmbed('/indoorshop/zones/painting')).toBe('/indoorshop/zones/painting?embed=1')
    expect(withEmbed('/indoorshop/zones/painting?factory=x')).toBe('/indoorshop/zones/painting?factory=x&embed=1')
  })
})

describe('withoutEmbed', () => {
  it('embed 쿼리만 떼고 나머지는 남긴다', () => {
    expect(withoutEmbed('/indoorshop/zones/painting?embed=1')).toBe('/indoorshop/zones/painting')
    expect(withoutEmbed('/indoorshop/zones/painting?factory=x&embed=1&bay=3')).toBe('/indoorshop/zones/painting?factory=x&bay=3')
    expect(withoutEmbed('/indoorshop/performance')).toBe('/indoorshop/performance')
  })
})
