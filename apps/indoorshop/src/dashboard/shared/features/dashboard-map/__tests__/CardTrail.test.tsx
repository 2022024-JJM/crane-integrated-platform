import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../lib/testing/renderWithProviders'
import { CardTrail } from '../ui/CardTrail'

/*
 * 카드 머리의 뎁스 경로 — 주소가 있는 조각은 링크, 없는 조각(공정 문맥)은 글자.
 */
describe('CardTrail', () => {
  it('조각을 순서대로 잇고, 주소가 있는 조각만 링크다', () => {
    renderWithProviders(
      <CardTrail
        steps={[
          { key: 'list', label: '공장 목록', href: '/' },
          { key: 'process', label: '조립', href: null, dot: '#4f8cff' },
          { key: 'factory', label: 'PBS', href: '/?factory=asm-pbs' },
        ]}
      />
    )
    const nav = screen.getByRole('navigation', { name: '카드 경로' })
    expect(nav).toHaveTextContent(/공장 목록.*조립.*PBS/)
    expect(screen.getByRole('link', { name: '공장 목록' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'PBS' })).toHaveAttribute('href', '/?factory=asm-pbs')
    expect(screen.queryByRole('link', { name: '조립' })).toBeNull()
  })
})
