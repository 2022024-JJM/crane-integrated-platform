import { describe, expect, it } from 'vitest'
import { YARD_EQUIPMENT } from '../../../../shared/entities/equipment'
import { OUTFITTING_FACTORIES } from '../../api/outfittingFactoryFixture'
import { mockSensors } from '../../api/mockOutfittingData'
import { OUTFITTING_DEVICE_KINDS } from '../../model/equipment'
import {
  deviceSummaryOf,
  devicesByBay,
  mockDeviceStatus,
  mockHeartbeatAt,
  outfittingDevices,
  outfittingFactoryNames,
  toSensorRow,
} from '../equipmentStatus'

const KINDS = new Set<string>(OUTFITTING_DEVICE_KINDS)

/** 설비 엔티티가 이 공장의 설비를 이미 들고 있는가 (W6-1 도면 이관이 닿았는가) */
function entityCountOf(factory: string): number {
  return YARD_EQUIPMENT.filter((e) => e.factory === factory && KINDS.has(e.typeId)).length
}

describe('outfittingFactoryNames', () => {
  it('의장 공장 fixture 의 이름을 그대로 낸다', () => {
    expect(outfittingFactoryNames()).toEqual(OUTFITTING_FACTORIES.map((f) => f.name))
  })
})

describe('outfittingDevices', () => {
  it('설비 엔티티에 행이 있으면 그것만 쓰고, 없으면 목업 자리를 세운다', () => {
    for (const factory of outfittingFactoryNames()) {
      const devices = outfittingDevices(factory)
      const fromEntity = entityCountOf(factory)
      expect(devices.length).toBeGreaterThan(0)
      if (fromEntity > 0) {
        // 실데이터가 온 공장은 목업을 섞지 않는다 — 반쯤 진짜인 목록을 만들지 않는다
        expect(devices).toHaveLength(fromEntity)
        expect(devices.every((d) => !d.placeholder)).toBe(true)
      } else {
        expect(devices.every((d) => d.placeholder)).toBe(true)
      }
    }
  })

  it('목업 자리는 라이다·틸팅을 쌍으로 세우고 공장마다 Edge PC·판넬을 한 대씩 둔다', () => {
    const factory = OUTFITTING_FACTORIES[0].name
    if (entityCountOf(factory) > 0) return // 이관이 끝나면 이 모양은 도면이 정한다
    const devices = outfittingDevices(factory)
    const lidars = devices.filter((d) => d.kind === 'LIDAR')
    const tilts = devices.filter((d) => d.kind === 'TILT')
    expect(lidars.length).toBe(tilts.length)
    expect(lidars.length).toBeGreaterThan(0)
    expect(devices.filter((d) => d.kind === 'EDGE')).toHaveLength(1)
    expect(devices.filter((d) => d.kind === 'PNL')).toHaveLength(1)
  })

  it('목업 라이다는 공장 뷰의 센서 mock 과 같은 대수·같은 상태를 말한다', () => {
    for (const spec of OUTFITTING_FACTORIES) {
      if (entityCountOf(spec.name) > 0) continue
      const sensors = mockSensors.filter((sensor) => sensor.factoryId === spec.id)
      const lidars = outfittingDevices(spec.name).filter((d) => d.kind === 'LIDAR')
      expect(lidars.map((d) => d.id).sort()).toEqual(sensors.map((s) => s.name).sort())
      const statusOf = new Map(lidars.map((d) => [d.id, d.status]))
      for (const sensor of sensors) expect(statusOf.get(sensor.name)).toBe(sensor.status)
    }
  })

  it('결정론적이다 — 다시 불러도 같은 상태·같은 heartbeat', () => {
    const factory = OUTFITTING_FACTORIES[1].name
    expect(outfittingDevices(factory)).toEqual(outfittingDevices(factory))
  })

  it('관측 설비만 스캔 시각을 갖는다', () => {
    for (const device of outfittingDevices(OUTFITTING_FACTORIES[0].name)) {
      if (device.kind === 'LIDAR' || device.kind === 'TILT') {
        expect(device.lastScanAt).toMatch(/^\d{2}:\d{2}$/)
      } else {
        expect(device.lastScanAt).toBeUndefined()
      }
    }
  })
})

describe('mock 상태·heartbeat', () => {
  it('상태는 세 값 중 하나이고 대부분 온라인이다', () => {
    const ids = Array.from({ length: 300 }, (_, i) => `LD-T${i}`)
    const statuses = ids.map(mockDeviceStatus)
    expect(new Set(statuses).size).toBeGreaterThan(1)
    for (const status of statuses) expect(['online', 'offline', 'error']).toContain(status)
    expect(statuses.filter((s) => s === 'online').length / ids.length).toBeGreaterThan(0.8)
  })

  it('heartbeat 는 13:00~15:59 의 HH:MM', () => {
    for (const id of ['LD-A1', 'PT-B2', 'EDGE-POS1']) {
      const at = mockHeartbeatAt(id)
      expect(at).toMatch(/^1[345]:[0-5]\d$/)
      expect(mockHeartbeatAt(id)).toBe(at)
    }
  })
})

describe('devicesByBay', () => {
  it('베이별로 묶고 베이는 번호순·설비는 ID 순으로 세운다', () => {
    const devices = outfittingDevices(OUTFITTING_FACTORIES[0].name)
    const bays = devicesByBay(devices)
    expect([...bays.values()].flat()).toHaveLength(devices.length)
    for (const [bay, list] of bays) {
      expect(list.every((d) => (d.bay || '-') === bay)).toBe(true)
      expect(list.map((d) => d.id)).toEqual([...list.map((d) => d.id)].sort())
    }
    const keys = [...bays.keys()]
    expect(keys).toEqual([...keys].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })))
  })

  it('빈 목록은 빈 묶음이다', () => {
    expect(devicesByBay([]).size).toBe(0)
  })
})

describe('deviceSummaryOf', () => {
  it('온라인 + 점검 필요가 곧 전체 대수이고 종류별 합도 같다', () => {
    for (const factory of outfittingFactoryNames()) {
      const summary = deviceSummaryOf(factory)
      expect(summary.online + summary.issues).toBe(summary.total)
      const byKindTotal = OUTFITTING_DEVICE_KINDS.reduce(
        (sum, kind) => sum + summary.byKind[kind].total,
        0
      )
      expect(byKindTotal).toBe(summary.total)
      const byKindOnline = OUTFITTING_DEVICE_KINDS.reduce(
        (sum, kind) => sum + summary.byKind[kind].online,
        0
      )
      expect(byKindOnline).toBe(summary.online)
    }
  })

  it('가장 늦은 heartbeat 를 낸다 (같은 날 안이면 사전순이 시간순)', () => {
    const factory = OUTFITTING_FACTORIES[0].name
    const summary = deviceSummaryOf(factory)
    const latest = outfittingDevices(factory)
      .map((d) => d.lastHeartbeatAt)
      .sort()
      .at(-1)
    expect(summary.lastHeartbeatAt).toBe(latest)
  })

  it('엔티티 행이 없는 공장은 placeholder 로 표시된다', () => {
    for (const factory of outfittingFactoryNames()) {
      expect(deviceSummaryOf(factory).placeholder).toBe(entityCountOf(factory) === 0)
    }
  })
})

describe('toSensorRow', () => {
  it('설비를 센서 목록 계약으로 옮긴다 — 복합키(공장#베이)를 지킨다', () => {
    const device = outfittingDevices(OUTFITTING_FACTORIES[0].name)[0]
    const row = toSensorRow(device)
    expect(row.id).toBe(device.id)
    expect(row.locationId).toBe(`${device.factory}#${device.bay}`)
    expect(row.status).toBe(device.status)
    expect(row.lastHeartbeatAt).toBe(device.lastHeartbeatAt)
  })
})
