import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '../../../lib/testing/renderWithProviders'
import { EquipmentBirdview } from '../ui/EquipmentBirdview'
import type { BirdviewBay, BirdviewPoint } from '../model/types'

/*
 * 버드뷰가 **무엇을 그리는가**의 계약 (R41).
 *
 * 주인공은 베이 구획이다. 한때 모든 점을 감싸는 볼록 껍질을 '공장 외곽'으로 둘렀는데,
 * 그 선은 실제 건물 모양이 아니라 점들의 껍질이라 도면으로 읽는 순간 거짓말이 되고
 * 베이보다 굵게 서서 눈을 먼저 가져갔다. 사용자가 여러 번 뺄 것을 지시한 선이므로,
 * 눈으로 확인하는 대신 계약으로 못 박는다 — 다음 사람이 무심코 되살리지 않게.
 */

const HULL_A = [
  { lat: 34.87, lon: 128.69 },
  { lat: 34.8715, lon: 128.69 },
  { lat: 34.8715, lon: 128.6935 },
  { lat: 34.87, lon: 128.6935 },
]
const HULL_B = [
  { lat: 34.872, lon: 128.69 },
  { lat: 34.8735, lon: 128.69 },
  { lat: 34.8735, lon: 128.6935 },
  { lat: 34.872, lon: 128.6935 },
]

const BAYS: BirdviewBay[] = [
  { id: 'F#1', label: '1', groupKey: '1', hull: HULL_A },
  { id: 'F#2', label: '2', groupKey: '2', hull: HULL_B },
]

const POINTS: BirdviewPoint[] = [
  {
    id: 'LD-01',
    typeId: 'LIDAR',
    position: { lat: 34.8705, lon: 128.6905 },
    severity: 'done',
    tooltip: { title: 'LD-01 · 라이다', status: '온라인', freshness: '1 BAY' },
    bay: '1',
  },
  {
    id: 'LD-02',
    typeId: 'LIDAR',
    position: { lat: 34.8725, lon: 128.6925 },
    severity: 'done',
    tooltip: { title: 'LD-02 · 라이다', status: '온라인', freshness: '2 BAY' },
    bay: '2',
  },
]

function renderBirdview(bays: readonly BirdviewBay[] = BAYS) {
  return renderWithProviders(
    <EquipmentBirdview
      bays={bays}
      points={POINTS}
      selectedId={null}
      onSelectPoint={() => {}}
      hoveredId={null}
      onHoverPoint={() => {}}
      emptyLabel="표시할 설비 좌표가 없습니다"
    />
  )
}

/** 바닥에 깔린 도형 — 설비 심볼(글리프 안의 path)은 세지 않는다 */
function groundPaths(container: HTMLElement): SVGPathElement[] {
  const svg = container.querySelector('svg[role="img"]')!
  return [...svg.querySelectorAll('path')].filter((path) => !path.closest('[data-point]'))
}

describe('EquipmentBirdview — 베이만 그린다 (R41)', () => {
  it('공장 외곽 폴리곤을 그리지 않는다 — 바닥에 깔린 도형은 전부 베이다', () => {
    const { container } = renderBirdview()
    const paths = groundPaths(container)
    expect(paths).toHaveLength(BAYS.length)
    for (const path of paths) expect(path.getAttribute('data-bay')).not.toBeNull()
  })

  it('베이가 하나도 없으면 아무 구획도 그리지 않는다 (설비만 남는다)', () => {
    const { container } = renderBirdview([])
    expect(groundPaths(container)).toHaveLength(0)
    expect(container.querySelectorAll('[data-point]')).toHaveLength(POINTS.length)
  })

  it('베이 구획과 이름은 그대로 선다 — 뺀 것은 외곽선뿐이다', () => {
    const { container } = renderBirdview()
    expect(container.querySelector('[data-bay="1"]')).not.toBeNull()
    expect(container.querySelector('[data-bay="2"]')).not.toBeNull()
    const labels = [...container.querySelectorAll('svg text')].map((node) => node.textContent)
    expect(labels).toContain('1')
    expect(labels).toContain('2')
  })
})
