import { createRef } from 'react'
import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../lib/testing/renderWithProviders'
import { MapHoverCard } from '../ui/MapHoverCard'

/*
 * 왼쪽 카드를 접어 둔 동안 지도의 공장·베이 hover 카드.
 */
describe('MapHoverCard', () => {
  const boxRef = createRef<HTMLElement>()

  it('공장 — 공정 · 이름 · 작업 상태별 블록 수 · 점검 필요 (베이 수는 없다)', () => {
    renderWithProviders(
      <MapHoverCard
        info={{
          kind: 'factory',
          name: 'PBS',
          process: '조립',
          groups: { inProgress: 12, notStarted: 5, done: 3 },
          faultBays: 2,
        }}
        boxRef={boxRef}
        initial={{ x: 100, y: 100 }}
      />
    )
    const card = screen.getByRole('tooltip')
    expect(card).toHaveTextContent('조립')
    expect(card).toHaveTextContent('PBS')
    expect(card).toHaveTextContent(/12\s*작업 중\s*5\s*작업 전\s*3\s*작업 완료\s*2\s*점검 필요/)
    expect(card).not.toHaveTextContent('베이')
  })

  it('공장 — 작업 상태를 아직 모르면 수를 – 로', () => {
    renderWithProviders(
      <MapHoverCard
        info={{ kind: 'factory', name: 'CAS', process: '가공', faultBays: 0 }}
        boxRef={boxRef}
        initial={{ x: 100, y: 100 }}
      />
    )
    expect(screen.getByRole('tooltip')).toHaveTextContent(/–\s*작업 중/)
  })

  it('베이 — 작업 상태별 블록 수와 점검이 필요한 장비 (작업 종류는 없다)', () => {
    renderWithProviders(
      <MapHoverCard
        info={{
          kind: 'bay',
          factory: 'PBS',
          label: '5BAY',
          process: '조립',
          groups: { inProgress: 2, notStarted: 0, done: 1 },
          fault: {
            bayId: 'PBS#5BAY',
            factory: 'PBS',
            label: '5BAY',
            process: '조립',
            lotCodes: [],
            equipment: [{ id: 'LD-01', typeId: 'lidar', typeName: '라이다', link: 'offline' }],
          },
        }}
        boxRef={boxRef}
        initial={{ x: 100, y: 100 }}
      />
    )
    const card = screen.getByRole('tooltip')
    expect(card).toHaveTextContent('5BAY')
    /* 공장 카드와 같은 네 칸 — 수 위, 이름 아래 */
    expect(card).toHaveTextContent(/2\s*작업 중\s*0\s*작업 전\s*1\s*작업 완료\s*1\s*점검 필요/)
    /* 작업 종류는 적지 않는다 */
    expect(card).not.toHaveTextContent('소조')
    expect(card).toHaveTextContent(/라이다.*LD-01.*오프라인/)
  })

  it('작업이 없으면 네 칸이 모두 0, 커서를 모르면 그리지 않는다', () => {
    const { rerender } = renderWithProviders(
      <MapHoverCard
        info={{ kind: 'bay', factory: 'PBS', label: '1BAY', process: '조립', groups: { inProgress: 0, notStarted: 0, done: 0 }, fault: null }}
        boxRef={boxRef}
        initial={{ x: 10, y: 10 }}
      />
    )
    expect(screen.getByRole('tooltip')).toHaveTextContent(/0\s*작업 중\s*0\s*작업 전\s*0\s*작업 완료\s*0\s*점검 필요/)
    rerender(
      <MapHoverCard
        key="other"
        info={{ kind: 'bay', factory: 'PBS', label: '1BAY', process: '조립', groups: { inProgress: 0, notStarted: 0, done: 0 }, fault: null }}
        boxRef={boxRef}
        initial={null}
      />
    )
    expect(screen.queryByRole('tooltip')).toBeNull()
  })
})
