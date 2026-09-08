import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { createRef } from 'react'
import { renderWithProviders } from '../../../lib/testing/renderWithProviders'
import type { Viewport, YardView } from '../../yard-map'
import type { ProcessMapLocation } from '../../../model/processMapDrilldown'
import { BayJumpButton } from '../ui/BayJumpButton'
import { FactoryHudLabel, type FactoryHudLabelHandle } from '../ui/FactoryHudLabel'

/*
 * 베이까지 내려간 상태의 이름패와 그 밑에 붙는 문 — 지도에서 6BAY 를 누르면 그 자리에서
 * 곧장 그 베이로 들어갈 수 있어야 한다(카드까지 손이 가지 않게).
 */

const LOCATION: ProcessMapLocation = {
  id: 'asm-pbs-b5',
  parentFacilityKey: 'PBS',
  displayName: '5번 베이',
  detailPath: '/indoorshop/zones/assembly/asm-pbs/asm-pbs-b5',
}

const VIEWPORT: Viewport = { width: 1280, height: 720 }
const VIEW: YardView = {
  centerLat: 34.865,
  centerLon: 128.7066,
  scale: 400_000,
  pitch: 0,
  bearing: 0,
}

describe('BayJumpButton', () => {
  it('공정 모듈이 준 작업 위치 경로로 나간다 — 지도가 주소를 조합하지 않는다', () => {
    renderWithProviders(<BayJumpButton process="조립" location={LOCATION} />)
    expect(screen.getByRole('link', { name: /5번 베이/ })).toHaveAttribute(
      'href',
      '/indoorshop/zones/assembly/asm-pbs/asm-pbs-b5',
    )
  })
})

describe('베이 이름패 — 패와 문이 같은 층에 뜬다', () => {
  it('베이 이름이 뜨고 그 밑의 문만 클릭을 받는다', () => {
    const ref = createRef<FactoryHudLabelHandle>()
    const { container } = renderWithProviders(
      <FactoryHudLabel
        ref={ref}
        name="6BAY"
        anchor={{ lat: 34.865, lon: 128.7066 }}
        outline={[
          { lat: 34.8655, lon: 128.706 },
          { lat: 34.8645, lon: 128.7072 },
        ]}
        color="#3987e5"
        caption="PBS · 조립"
        initialCamera={{ view: VIEW, viewport: VIEWPORT }}
        action={<BayJumpButton process="조립" location={LOCATION} />}
      />,
    )
    expect(screen.getByText('6BAY')).toBeInTheDocument()
    expect(screen.getByText('PBS · 조립')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /5번 베이/ })
    expect(link.closest('.pointer-events-auto')).not.toBeNull()
    expect((container.firstElementChild as HTMLElement).className).toContain(
      'pointer-events-none',
    )
  })
})
