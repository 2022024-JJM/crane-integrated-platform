import { describe, expect, it } from 'vitest'
import {
  YARD_EQUIPMENT,
  buildEquipmentStatusSnapshot,
  edgePcStatusIn,
  panelStatusIn,
  tiltStatusIn,
  pairIdOf,
} from '../shared/entities/equipment'
import { birdviewPointsOf } from '../shared/features/equipment-birdview'
import { edgePcCell, lidarPairCell, panelCell } from '../processes/assembly/lib/equipmentCells'
import { lidarsByBay } from '../processes/assembly/lib/mapEntry'
import { outfittingCells } from '../processes/outfitting/lib/equipmentCells'
import { outfittingDevices } from '../processes/outfitting/lib/equipmentStatus'
import { paintingCells } from '../processes/painting/lib/equipmentCells'
import { mockEquipmentStatus } from '../processes/painting/lib/equipmentStatusMock'
import { fetchEquipmentByFactory } from '../processes/painting/api/paintingRepository'

/**
 * **현황 탭의 두 층이 같은 설비를 가리킨다** (P4 ⓓ).
 *
 * 버드뷰의 점과 그리드의 셀은 `id` 하나로 이어져 있다. 그 열쇠가 어긋나면 심볼을 눌러도
 * 따라올 셀이 없고, 두 층을 나란히 둔 이유가 사라진다 — 그래서 세 공정 모두에서
 * "점의 id 는 셀에 실재한다"를 못 박는다. 화면이 아니라 **어댑터 계약**을 본다.
 */
const NOW = 1_756_000_000_000

function snapshotOf(factory: string) {
  const ids = YARD_EQUIPMENT.filter((e) => e.factory === factory).map((e) => e.id)
  return buildEquipmentStatusSnapshot(ids, NOW)
}

/** 그 공장의 버드뷰 점 id (상태·툴팁은 이 계약과 무관하므로 고정값을 준다) */
function pointIdsOf(factory: string): string[] {
  return birdviewPointsOf(factory, {
    severityOf: () => 'done',
    tooltipOf: (equipment) => ({ title: equipment.id, status: '-', freshness: '-' }),
  }).map((point) => point.id)
}

describe('버드뷰 ↔ 그리드 — 페어는 한 점', () => {
  const FACTORIES = ['PBS', 'POS 1공장', '1DOCK 도장공장']

  it.each(FACTORIES)('%s — 짝 있는 틸팅은 제 점을 만들지 않는다', (factory) => {
    const ids = new Set(pointIdsOf(factory))
    const paired = YARD_EQUIPMENT.filter((e) => {
      if (e.typeId !== 'TILT' || e.factory !== factory) return false
      const mate = pairIdOf(e)
      return Boolean(mate && ids.has(mate))
    })
    for (const tilt of paired) expect(ids.has(tilt.id)).toBe(false)
  })

  it('PBS — 점 수 = (전 설비 − 짝 있는 틸팅)', () => {
    const all = YARD_EQUIPMENT.filter((e) => e.factory === 'PBS')
    const lidarIds = new Set(all.filter((e) => e.typeId === 'LIDAR').map((e) => e.id))
    const folded = all.filter((e) => e.typeId === 'TILT' && lidarIds.has(pairIdOf(e) ?? ''))
    expect(pointIdsOf('PBS')).toHaveLength(all.length - folded.length)
  })
})

describe('조립 — 점의 id 는 셀에 실재한다', () => {
  const FACTORY = 'PBS'

  it('버드뷰 점이 모두 그리드 셀로 선다', () => {
    const snapshot = snapshotOf(FACTORY)
    const cellIds = new Set<string>()
    for (const equipment of YARD_EQUIPMENT.filter((e) => e.factory === FACTORY)) {
      if (equipment.typeId === 'LIDAR') {
        cellIds.add(lidarPairCell(equipment, snapshot, { freshText: '방금' }).id)
      } else if (equipment.typeId === 'EDGE') {
        const status = edgePcStatusIn(snapshot, equipment.id)
        if (status) cellIds.add(edgePcCell(equipment, status, { freshText: '방금' }).id)
      } else if (equipment.typeId === 'PNL') {
        const status = panelStatusIn(snapshot, equipment.id)
        if (status)
          cellIds.add(
            panelCell({
              id: equipment.id,
              typeId: equipment.typeId,
              powered: status.powered,
              uplink: status.uplink,
              memberOnline: status.memberOnline,
              memberTotal: status.memberTotal,
              lidarPairs: status.lidarPairs,
            }).id
          )
      }
    }
    for (const id of pointIdsOf(FACTORY)) expect(cellIds.has(id)).toBe(true)
  })

  it('그리드 구획 키(베이)와 버드뷰 베이 키가 같은 어휘다', () => {
    /* 그리드는 `equipment.bay` 로 묶고 버드뷰 베이는 `YardParcelBay.bay` 를 키로 쓴다.
       두 값이 같은 문자열이라야 '베이 클릭 → 그 구획으로 점프'가 성립한다. */
    const gridKeys = [...lidarsByBay(FACTORY).keys()]
    expect(gridKeys.length).toBeGreaterThan(0)
    for (const key of gridKeys) expect(key).not.toContain('#')
  })
})

describe('선행의장 — 점의 id 는 셀에 실재한다', () => {
  const FACTORY = 'POS 1공장'

  it('버드뷰 점이 모두 그리드 셀로 선다', () => {
    const snapshot = snapshotOf(FACTORY)
    const cellIds = new Set(
      outfittingCells(outfittingDevices(FACTORY), {
        freshTextOf: () => '방금',
        freshAtOf: () => snapshot.at,
        tiltOf: () => null,
      }).map((cell) => cell.id)
    )
    for (const id of pointIdsOf(FACTORY)) expect(cellIds.has(id)).toBe(true)
  })
})

describe('선행도장 — 점의 id 는 셀에 실재한다', () => {
  const FACTORY = '1DOCK 도장공장'

  it('버드뷰 점이 모두 그리드 셀로 선다', () => {
    const cellIds = new Set(
      paintingCells(fetchEquipmentByFactory(FACTORY), {
        statusOf: (item) => mockEquipmentStatus(item, NOW),
        pendingText: '수신 대기',
      }).map((cell) => cell.id)
    )
    for (const id of pointIdsOf(FACTORY)) expect(cellIds.has(id)).toBe(true)
  })
})

/**
 * **R19 — 종류마다 대표값이 클릭 없이 보인다.**
 *
 * 압축 셀의 세 요소(칩+ID / 램프 / 수치)만으로는 "지금 이 라이다가 어디를 보고 있나",
 * "이 Edge PC 가 뜨거운가"를 알 수 없다. 그 한 줄이 없으면 화면은 여전히 열어 봐야
 * 하는 화면이고, 열어 보게 만드는 순간 수백 칸을 한눈에 훑는다는 전제가 무너진다.
 */
describe('R19 — 종류별 대표값', () => {
  const snapshot = snapshotOf('PBS')

  it('라이다 — 대기 상태에서도 현재 각도가 셀에 적힌다', () => {
    const lidars = [...lidarsByBay('PBS').values()].flat()
    const idle = lidars.find((lidar) => {
      const mate = pairIdOf(lidar)
      const tilt = mate ? tiltStatusIn(snapshot, mate) : null
      return tilt?.mode === 'idle' && tilt.atTarget
    })
    expect(idle, '대기 중인 페어가 fixture 에 있어야 한다').toBeDefined()
    const cell = lidarPairCell(idle!, snapshot, { freshText: '방금' })
    expect(cell.note).toMatch(/-?\d+°\/-?\d+°/)
  })

  it('라이다 — 목표와 어긋나 있으면 목표가 함께 선다', () => {
    const lidars = [...lidarsByBay('PBS').values()].flat()
    const moving = lidars.find((lidar) => {
      const mate = pairIdOf(lidar)
      const tilt = mate ? tiltStatusIn(snapshot, mate) : null
      return tilt != null && !tilt.atTarget
    })
    if (!moving) return
    expect(lidarPairCell(moving, snapshot, { freshText: '방금' }).note).toContain('→')
  })

  it('Edge PC — 온도·CPU 는 임계 아래에서도 적는다', () => {
    const edge = YARD_EQUIPMENT.find((e) => e.typeId === 'EDGE' && e.factory === 'PBS')!
    const status = edgePcStatusIn(snapshot, edge.id)!
    const cell = edgePcCell(edge, status, { freshText: '방금' })
    expect(cell.note).toContain(`${status.temperatureC}°C`)
    expect(cell.note).toContain(`CPU ${status.cpuPercent}%`)
  })

  it('캐비닛 — 대표값은 업링크다 (판이 끊기면 아래가 통째로 눈이 먼다)', () => {
    const panelEquipment = YARD_EQUIPMENT.find((e) => e.typeId === 'PNL' && e.factory === 'PBS')!
    const status = panelStatusIn(snapshot, panelEquipment.id)!
    const cell = panelCell({
      id: panelEquipment.id,
      typeId: panelEquipment.typeId,
      powered: status.powered,
      uplink: status.uplink,
      memberOnline: status.memberOnline,
      memberTotal: status.memberTotal,
      lidarPairs: status.lidarPairs,
    })
    expect(['온라인', '오프라인', '통신 오류']).toContain(cell.metric.text)
    /* 대수는 사라지지 않고 아래 줄로 내려간다 */
    expect(cell.note).toContain(`소속 ${status.memberOnline}/${status.memberTotal}`)
  })

  it('셀의 핵심 수치는 마지막 수신 시각을 함께 싣는다 (경과가 스스로 흐르도록)', () => {
    const lidar = [...lidarsByBay('PBS').values()].flat()[0]
    expect(lidarPairCell(lidar, snapshot, { freshText: '방금', at: NOW }).metric.at).toBe(NOW)

    const edge = YARD_EQUIPMENT.find((e) => e.typeId === 'EDGE' && e.factory === 'PBS')!
    const status = edgePcStatusIn(snapshot, edge.id)!
    expect(edgePcCell(edge, status, { freshText: '방금' }).metric.at).toBe(status.lastHeartbeatAt)
  })
})
