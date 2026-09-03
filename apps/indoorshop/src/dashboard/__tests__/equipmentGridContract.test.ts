import { describe, expect, it } from 'vitest'
import { YARD_EQUIPMENT, buildEquipmentStatusSnapshot } from '../shared/entities/equipment'
import { countCells, isIssueCell, sortCellsByStatus } from '../shared/features/equipment-grid'
import { lidarPairCell } from '../processes/assembly/lib/equipmentCells'
import { lidarsByBay } from '../processes/assembly/lib/mapEntry'
import { outfittingCells } from '../processes/outfitting/lib/equipmentCells'
import { outfittingDevices, tiltDetailOf } from '../processes/outfitting/lib/equipmentStatus'
import { paintingCells } from '../processes/painting/lib/equipmentCells'
import { mockEquipmentStatus } from '../processes/painting/lib/equipmentStatusMock'
import { equipmentOfTypes } from '../shared/entities/equipment'
import type { PaintingEquipment } from '../processes/painting/model/equipment'

/**
 * **세 공정이 같은 셀 문법을 쓴다** — R13 · `.work/설비관제_레퍼런스.md` §3.4.
 *
 * 그리드 자체의 규칙(정렬·감쇄·필터)은 그 feature 의 테스트가 지킨다. 여기서 지키는 것은
 * **공정이 셀을 만드는 방식**이다 — 특히 "라이다+틸팅 = 한 칸". 이 규칙이 깨지면 337칸이
 * 674칸이 되어 그리드로 옮긴 이유가 사라진다.
 */
const NOW = 1_756_000_000_000

function snapshotOf(factory: string) {
  const ids = YARD_EQUIPMENT.filter((e) => e.factory === factory).map((e) => e.id)
  return buildEquipmentStatusSnapshot(ids, NOW)
}

describe('조립 — 라이다+틸팅은 한 칸', () => {
  const FACTORY = 'PBS'

  it('셀 수 = 라이다 대수 (틸팅이 칸을 더 만들지 않는다)', () => {
    const snapshot = snapshotOf(FACTORY)
    const cells = [...lidarsByBay(FACTORY).values()]
      .flat()
      .map((lidar) => lidarPairCell(lidar, snapshot, { freshText: '방금' }))
    const lidarCount = YARD_EQUIPMENT.filter(
      (e) => e.typeId === 'LIDAR' && e.factory === FACTORY
    ).length
    const tiltCount = YARD_EQUIPMENT.filter(
      (e) => e.typeId === 'TILT' && e.factory === FACTORY
    ).length
    expect(cells).toHaveLength(lidarCount)
    expect(cells.length).toBeLessThan(lidarCount + tiltCount)
  })

  it('페어 셀의 램프는 [링크 / 틸팅 / 이상] 셋이다 — 틸팅은 둘째 램프가 말한다', () => {
    const snapshot = snapshotOf(FACTORY)
    const lidar = [...lidarsByBay(FACTORY).values()].flat()[0]
    const cell = lidarPairCell(lidar, snapshot, { freshText: '방금' })
    expect(cell.lamps.map((lamp) => lamp.label)).toEqual(['링크', '틸팅', '이상'])
    expect(cell.typeId).toBe('LIDAR')
    expect(cell.label).toBe(lidar.id)
  })

  it('셀 판정은 램프 중 가장 나쁜 것을 접는다 — 정렬이 그 값을 쓴다', () => {
    const snapshot = snapshotOf(FACTORY)
    for (const lidar of [...lidarsByBay(FACTORY).values()].flat()) {
      const cell = lidarPairCell(lidar, snapshot, { freshText: '방금' })
      const hasError = cell.lamps.some((lamp) => lamp.meaning === 'error')
      expect(cell.severity === 'error').toBe(hasError)
    }
  })
})

describe('의장 — 같은 셀 문법', () => {
  const FACTORY = 'POS 1공장'

  it('라이다+틸팅이 한 칸으로 접힌다', () => {
    const snapshot = snapshotOf(FACTORY)
    const devices = outfittingDevices(FACTORY)
    const cells = outfittingCells(devices, {
      freshTextOf: () => '방금',
      tiltOf: (device) => tiltDetailOf(device, snapshot),
    })
    const lidars = devices.filter((d) => d.kind === 'LIDAR').length
    const tilts = devices.filter((d) => d.kind === 'TILT').length
    const others = devices.length - lidars - tilts
    /* 라이다마다 짝이 있으므로 셀은 라이다 + 나머지다 */
    expect(cells).toHaveLength(lidars + others)
    expect(cells.filter((c) => c.typeId === 'TILT')).toHaveLength(0)
  })

  it('조립과 같은 램프 이름·같은 자리를 쓴다', () => {
    const snapshot = snapshotOf(FACTORY)
    const cells = outfittingCells(outfittingDevices(FACTORY), {
      freshTextOf: () => '방금',
      tiltOf: (device) => tiltDetailOf(device, snapshot),
    })
    const lidarCell = cells.find((c) => c.typeId === 'LIDAR')!
    expect(lidarCell.lamps.map((lamp) => lamp.label)).toEqual(['링크', '틸팅', '이상'])
  })

  it('짝 없는 틸팅만 오는 목록에서는 한 대로 선다 — 목록이 통째로 비지 않는다', () => {
    const devices = outfittingDevices(FACTORY).filter((d) => d.kind === 'TILT')
    const cells = outfittingCells(devices, { freshTextOf: () => '방금', tiltOf: () => null })
    expect(cells).toHaveLength(devices.length)
    expect(cells.every((c) => c.typeId === 'TILT')).toBe(true)
  })
})

describe('도장 — 같은 셀 문법', () => {
  const equipment = equipmentOfTypes(['DH', 'GH']).map(
    (e): PaintingEquipment => ({
      id: e.id,
      kind: e.typeId === 'GH' ? '가스히터' : '제습기',
      factory: e.factory,
      bay: e.bay,
      lat: e.lat,
      lon: e.lon,
      x: e.x,
      y: e.y,
    })
  )

  it('설비 한 대가 한 칸이고, 램프는 [전원 / 링크 / 이상] 셋이다', () => {
    const cells = paintingCells(equipment, {
      statusOf: (item) => mockEquipmentStatus(item, NOW),
      pendingText: '수신 대기',
    })
    expect(cells).toHaveLength(equipment.length)
    expect(cells[0].lamps.map((lamp) => lamp.label)).toEqual(['전원', '링크', '이상'])
  })

  it('핵심 수치는 PV 한 개다 — SP 는 셀에 서지 않는다(펼침으로 내렸다)', () => {
    const cells = paintingCells(equipment, {
      statusOf: (item) => mockEquipmentStatus(item, NOW),
      pendingText: '수신 대기',
    })
    const healthy = cells.find((c) => c.metric.meaning === 'done')!
    expect(healthy.metric.text).toMatch(/(%RH|°C)$/)
  })

  it('종류칩은 설비 레지스트리 종류ID 를 쓴다 — 조립·의장과 같은 심볼 체계', () => {
    const cells = paintingCells(equipment, {
      statusOf: (item) => mockEquipmentStatus(item, NOW),
      pendingText: '수신 대기',
    })
    expect(new Set(cells.map((c) => c.typeId))).toEqual(new Set(['DH', 'GH']))
  })
})

describe('세 공정 공통 — 요약과 본문이 같은 배열에서 나온다', () => {
  it('집계 합이 셀 수와 같다', () => {
    const snapshot = snapshotOf('PBS')
    const cells = [...lidarsByBay('PBS').values()]
      .flat()
      .map((lidar) => lidarPairCell(lidar, snapshot, { freshText: '방금' }))
    const counts = countCells(cells)
    expect(counts.total).toBe(cells.length)
    expect(counts.issues).toBe(cells.filter(isIssueCell).length)
    expect(counts.issues + counts.normal).toBe(counts.total)
  })

  it('정렬은 셀을 잃지도 더하지도 않는다', () => {
    const snapshot = snapshotOf('PBS')
    const cells = [...lidarsByBay('PBS').values()]
      .flat()
      .map((lidar) => lidarPairCell(lidar, snapshot, { freshText: '방금' }))
    const sorted = sortCellsByStatus(cells)
    expect(sorted).toHaveLength(cells.length)
    expect(new Set(sorted.map((c) => c.id))).toEqual(new Set(cells.map((c) => c.id)))
  })
})
