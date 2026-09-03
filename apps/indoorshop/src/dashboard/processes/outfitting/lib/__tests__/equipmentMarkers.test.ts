import { describe, expect, it } from 'vitest'
import {
  YARD_EQUIPMENT,
  buildFactoryStatusSnapshot,
  equipmentLinkOf,
} from '../../../../shared/entities/equipment'
import {
  deviceCountsByKind,
  devicesOfBay,
  isDeviceFailing,
  outfittingDevices,
  outfittingFactoryNames,
  tiltDetailOf,
  tiltModeCountsOf,
} from '../equipmentStatus'

/**
 * 의장 맵 진입의 **설비 마커**와 틸팅 상세.
 *
 * 지도가 목록과 다른 답을 하면 (같은 설비, 두 화면, 두 상태) 어느 쪽을 믿을지 알 수 없다.
 * 그래서 마커가 목록과 **같은 배열**에서 나오는지, 좌표가 실데이터인지, 종류 심볼이
 * 레지스트리에서 오는지를 지킨다.
 */
const NOW = 1_756_000_000_000
const FACTORIES = outfittingFactoryNames()
/* 틸팅 상세는 이제 상태 스냅샷에서 나온다 — 파생 계산이 원천을 직접 부르지 않는다 */
const snapOf = (factory: string) => buildFactoryStatusSnapshot(factory, NOW)

describe('의장 설비 목록 — 베이·종류별 집계', () => {
  it('베이 드릴다운은 그 베이의 설비만 낸다', () => {
    const factory = FACTORIES[0]
    const bay = outfittingDevices(factory).find((d) => d.bay && d.bay !== '-')!.bay
    const inBay = devicesOfBay(factory, bay)
    expect(inBay.length).toBeGreaterThan(0)
    expect(inBay.every((d) => d.bay === bay && d.factory === factory)).toBe(true)
  })

  it('종류별 대수 합이 공장 설비 총수와 같다', () => {
    for (const factory of FACTORIES) {
      const devices = outfittingDevices(factory)
      const counts = deviceCountsByKind(devices)
      expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(devices.length)
    }
  })
})

describe('의장 설비 상태의 출처', () => {
  it('설비 상태는 shared 의 링크 축 하나에서 나온다 — 조립 화면과 같은 답', () => {
    const byId = new Map(YARD_EQUIPMENT.map((e) => [e.id, e]))
    for (const factory of FACTORIES) {
      for (const device of outfittingDevices(factory)) {
        expect(device.status).toBe(equipmentLinkOf(byId.get(device.id)!))
      }
    }
  })
})

describe('틸팅 개별 상태', () => {
  it('틸팅만 상세를 갖는다 — 다른 종류에 각도를 지어내지 않는다', () => {
    for (const device of outfittingDevices(FACTORIES[0])) {
      const tilt = tiltDetailOf(device, snapOf(FACTORIES[0]))
      if (device.kind === 'TILT') {
        expect(tilt).not.toBeNull()
        expect(tilt!.id).toBe(device.id)
        expect(tilt!.pairedLidarId).toBe(`LD-${device.id.slice(3)}`)
      } else {
        expect(tilt).toBeNull()
      }
    }
  })

  it('틸팅 상세의 통신 축이 목록 줄의 상태와 같다 — 한 줄에 두 진실을 두지 않는다', () => {
    for (const device of outfittingDevices(FACTORIES[0])) {
      const tilt = tiltDetailOf(device, snapOf(FACTORIES[0]))
      if (tilt) expect(tilt.link).toBe(device.status)
    }
  })

  it('에러 모드는 통신이 살아 있어도 이상으로 센다', () => {
    const device = { status: 'online' as const }
    const asDevice = { ...device } as Parameters<typeof isDeviceFailing>[0]
    expect(isDeviceFailing(asDevice, null)).toBe(false)
    expect(
      isDeviceFailing(asDevice, { mode: 'error' } as Parameters<typeof isDeviceFailing>[1])
    ).toBe(true)
    expect(
      isDeviceFailing(asDevice, { mode: 'idle' } as Parameters<typeof isDeviceFailing>[1])
    ).toBe(false)
  })

  it('통신이 끊긴 설비는 틸팅이 아니어도 이상이다', () => {
    const offline = { status: 'offline' as const } as Parameters<typeof isDeviceFailing>[0]
    expect(isDeviceFailing(offline, null)).toBe(true)
  })

  it('모드별 대수 합이 그 공장 틸팅 대수와 같다', () => {
    for (const factory of FACTORIES) {
      const counts = tiltModeCountsOf(factory, snapOf(factory))
      const tilts = outfittingDevices(factory).filter((d) => d.kind === 'TILT').length
      expect(counts.idle + counts.tilting + counts.error).toBe(tilts)
    }
  })
})
