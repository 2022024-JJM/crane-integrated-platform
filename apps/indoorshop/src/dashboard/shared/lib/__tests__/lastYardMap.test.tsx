import { afterEach, describe, expect, it } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { clearLastYardMap, lastYardMapSearch, rememberYardMapSearch, useYardMapHref } from '../lastYardMap'

/*
 * 야드 맵의 마지막 자리 — 다른 화면에서 '야드 맵' 을 누르면 마지막 상태(주소 쿼리)로 간다.
 */
function Href() {
  return <output data-testid="href">{useYardMapHref()}</output>
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Href />
    </MemoryRouter>
  )
}

describe('lastYardMap', () => {
  afterEach(clearLastYardMap)

  it('다른 화면에서는 마지막 야드 맵 쿼리로 간다', () => {
    rememberYardMapSearch('?process=조립&factory=asm-pbs&bay=5')
    renderAt('/indoorshop/zones/assembly')
    expect(screen.getByTestId('href')).toHaveTextContent('/indoorshop?process=조립&factory=asm-pbs&bay=5')
  })

  it('야드 맵 위에서는 / 그대로 — 누르면 대문으로', () => {
    rememberYardMapSearch('?factory=asm-pbs')
    renderAt('/indoorshop?factory=asm-pbs')
    expect(screen.getByTestId('href')).toHaveTextContent(/^\/indoorshop$/)
  })

  it('기억이 바뀌면 링크도 따라 바뀐다 · 빈 쿼리는 /', () => {
    renderAt('/indoorshop/zones/painting')
    expect(screen.getByTestId('href')).toHaveTextContent(/^\/indoorshop$/)
    act(() => rememberYardMapSearch('?process=도장'))
    expect(screen.getByTestId('href')).toHaveTextContent('/indoorshop?process=도장')
    expect(lastYardMapSearch()).toBe('?process=도장')
  })
})
