import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../lib/testing/renderWithProviders'
import { Sparkline } from '../Sparkline'

/**
 * 미니 추이 그림의 계약 (W7-2).
 *
 * jsdom 에는 레이아웃이 없으므로 **픽셀을 세지 않는다.** 검사하는 것은 이 그림이 지키기로
 * 한 약속들이다 — 점이 모자라면 아무것도 그리지 않을 것, 그림이 말한 값을 글자로도
 * 낼 것(스크린리더·색각 이상), 그리고 척도를 준 그림은 척도를 지킬 것.
 */
const points = [
  { label: '2026-09-01', value: 40 },
  { label: '2026-09-02', value: 55 },
  { label: '2026-09-03', value: 62 },
]

describe('점이 모자라면 그리지 않는다', () => {
  it('빈 배열이면 아무것도 나오지 않는다', () => {
    const { container } = renderWithProviders(<Sparkline points={[]} ariaLabel="추이" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('한 점짜리 추이는 추이가 아니다 — 선을 긋지 않는다', () => {
    const { container } = renderWithProviders(
      <Sparkline points={[points[0]]} ariaLabel="추이" />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('두 점부터 그린다', () => {
    renderWithProviders(<Sparkline points={points.slice(0, 2)} ariaLabel="추이" />)
    expect(screen.getByRole('img', { name: '추이' })).toBeInTheDocument()
  })
})

describe('그림이 말한 것을 글자로도 낸다', () => {
  it('접근성 이름으로 무엇의 추이인지 말한다', () => {
    renderWithProviders(<Sparkline points={points} ariaLabel="일일공정률 추이" />)
    expect(screen.getByRole('img', { name: '일일공정률 추이' })).toBeInTheDocument()
  })

  it('점마다 날짜와 값을 읽을 수 있다 — SVG 는 보조기술에 아무 말도 하지 않는다', () => {
    renderWithProviders(<Sparkline points={points} ariaLabel="추이" unit="%" />)
    expect(screen.getByText('2026-09-01 40%')).toBeInTheDocument()
    expect(screen.getByText('2026-09-02 55%')).toBeInTheDocument()
    expect(screen.getByText('2026-09-03 62%')).toBeInTheDocument()
  })

  it('단위를 주지 않으면 값만 낸다', () => {
    renderWithProviders(<Sparkline points={points} ariaLabel="추이" />)
    expect(screen.getByText('2026-09-03 62')).toBeInTheDocument()
  })

  it('값 목록의 순서가 점의 순서와 같다 — 글자로 읽어도 오름/내림이 보인다', () => {
    renderWithProviders(<Sparkline points={points} ariaLabel="추이" unit="%" />)
    const items = screen.getAllByRole('listitem').map((li) => li.textContent)
    expect(items).toEqual(['2026-09-01 40%', '2026-09-02 55%', '2026-09-03 62%'])
  })
})

describe('막대 모양 — 0 인 날이 보여야 한다', () => {
  const days = [
    { label: '2026-09-01', value: 3 },
    { label: '2026-09-02', value: 0 },
    { label: '2026-09-03', value: 5 },
  ]

  it('날 수만큼 막대가 선다 — 빈 날을 건너뛰지 않는다', () => {
    const { container } = renderWithProviders(
      <Sparkline variant="bars" points={days} ariaLabel="일자별 판별" />
    )
    expect(container.querySelectorAll('rect')).toHaveLength(3)
  })

  it('0 인 날도 자리를 지키고, 값이 0 임을 글자로 말한다', () => {
    renderWithProviders(<Sparkline variant="bars" points={days} ariaLabel="일자별 판별" unit="건" />)
    expect(screen.getByText('2026-09-02 0건')).toBeInTheDocument()
  })
})

describe('척도', () => {
  it('max 를 준 그림은 그 척도를 쓴다 — 최대값에 맞춰 늘이지 않는다', () => {
    const { container: scaled } = renderWithProviders(
      <Sparkline points={points} max={100} ariaLabel="추이" />
    )
    const { container: stretched } = renderWithProviders(
      <Sparkline points={points} ariaLabel="추이" />
    )
    /* 같은 점인데 척도가 다르면 경로가 달라야 한다 — 같다면 max 가 무시된 것이다 */
    expect(scaled.querySelector('path')?.getAttribute('d')).not.toBe(
      stretched.querySelector('path')?.getAttribute('d')
    )
  })

  it('모든 값이 0 이어도 터지지 않는다 (0 으로 나누지 않는다)', () => {
    renderWithProviders(
      <Sparkline
        variant="bars"
        points={[
          { label: 'a', value: 0 },
          { label: 'b', value: 0 },
        ]}
        ariaLabel="추이"
      />
    )
    expect(screen.getByRole('img', { name: '추이' })).toBeInTheDocument()
  })
})
