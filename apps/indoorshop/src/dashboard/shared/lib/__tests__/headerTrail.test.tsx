import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../testing/renderWithProviders'
import { usePublishHeaderTrail, useHeaderTrail, type HeaderTrail } from '../headerTrail'

/*
 * 헤더 뎁스 통로 — 화면이 게시하면 헤더가 읽고, 화면이 사라지면 거둔다.
 */
function Publisher({ trail }: { trail: HeaderTrail | null }) {
  usePublishHeaderTrail(trail)
  return null
}

function Reader() {
  const trail = useHeaderTrail()
  return <p data-testid="trail">{trail ? trail.steps.map((s) => s.label).join(' > ') : 'none'}</p>
}

const TRAIL: HeaderTrail = {
  rootHref: '/',
  steps: [
    { key: 'process', label: '조립', href: '/?process=assembly' },
    { key: 'factory', label: 'PBS', href: '/?factory=asm-pbs' },
    { key: 'bay', label: '5BAY', href: null },
  ],
}

describe('headerTrail', () => {
  it('게시한 뎁스를 읽는다', () => {
    renderWithProviders(
      <>
        <Publisher trail={TRAIL} />
        <Reader />
      </>,
    )
    expect(screen.getByTestId('trail')).toHaveTextContent('조립 > PBS > 5BAY')
  })

  it('게시한 화면이 사라지면 거둔다 — 다른 화면의 헤더에 남지 않게', () => {
    const { rerender } = renderWithProviders(
      <>
        <Publisher trail={TRAIL} />
        <Reader />
      </>,
    )
    rerender(<Reader />)
    expect(screen.getByTestId('trail')).toHaveTextContent('none')
  })
})
