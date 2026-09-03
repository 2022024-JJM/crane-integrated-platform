import { describe, expect, it } from 'vitest'
import type { PaintingEquipment } from '../../model/equipment'
import type { PaintingEquipmentStatus } from '../../model/equipmentStatus'
import {
  HAZE_SPAN_C,
  MIN_ACTIVE_INTENSITY,
  PARTICLES_TOTAL_MAX,
  STREAK_SPAN_RH,
  bayAirModeOf,
  bayAirStatesOf,
  fitParticleBudget,
  hazeIntensityOf,
  isMakingAir,
  particleCountOf,
  streakIntensityOf,
} from '../airEffect'

/**
 * **가동 뷰의 대기 규칙** (P5).
 *
 * 이 뷰가 SCADA 목록보다 더 말하는 것은 하나다 — **세기가 값을 따라간다.** 켜짐/꺼짐만
 * 그리면 옆의 목록이 이미 한 말을 3D 로 되풀이하는 것이고, 그럴 거면 3D 를 세울 이유가 없다.
 * 그래서 잠그는 것도 그 연동이다: 목표에서 멀수록 진하고 강한가, 그리고 **고장난 설비가
 * 공기를 뿜지 않는가**(화면이 고장을 정상으로 덮지 않는가).
 *
 * 그림은 검증할 수 없지만 규칙은 검증할 수 있다 — 그래서 수식을 렌더 코드 밖에 두었다.
 */
function status(over: Partial<PaintingEquipmentStatus> = {}): PaintingEquipmentStatus {
  return {
    id: 'EQ001',
    operatingMode: true,
    setpoint: 30,
    actualValue: 30,
    runtimeMinutesToday: 120,
    modbusLink: 'OK',
    faultCode: 0,
    receivedAt: 1_756_000_000_000,
    ...over,
  }
}

function equip(over: Partial<PaintingEquipment> = {}): PaintingEquipment {
  return {
    id: 'EQ001',
    kind: '가스히터',
    factory: '1DOCK 도장공장',
    bay: 'B1',
    lat: 34.87,
    lon: 128.7,
    x: 100,
    y: 200,
    ...over,
  }
}

describe('공기를 만들고 있는가 — 가동 플래그만 보지 않는다', () => {
  it('가동 + 통신 정상 + fault 없음이라야 만든다', () => {
    expect(isMakingAir(status())).toBe(true)
  })

  it('정지면 아니다', () => {
    expect(isMakingAir(status({ operatingMode: false }))).toBe(false)
  })

  it('통신이 끊겼으면 아니다 — 그 가동은 마지막으로 받은 말이지 지금의 사실이 아니다', () => {
    expect(isMakingAir(status({ modbusLink: 'TIMEOUT' }))).toBe(false)
    expect(isMakingAir(status({ modbusLink: 'CRC_ERROR' }))).toBe(false)
  })

  it('fault 가 떴으면 아니다 — 고장을 정상으로 덮지 않는다', () => {
    expect(isMakingAir(status({ faultCode: 12 }))).toBe(false)
  })

  it('상태가 아예 없으면 아니다', () => {
    expect(isMakingAir(undefined)).toBe(false)
  })
})

describe('열 헤이즈 — 목표에 못 미칠수록 진하다', () => {
  it('정지·고장이면 0 이다', () => {
    expect(hazeIntensityOf(status({ operatingMode: false }))).toBe(0)
    expect(hazeIntensityOf(status({ faultCode: 3 }))).toBe(0)
  })

  it('목표에 닿아 있어도 0 이 아니다 — 가동 중인 히터가 사라지면 안 된다', () => {
    expect(hazeIntensityOf(status({ setpoint: 30, actualValue: 30 }))).toBe(MIN_ACTIVE_INTENSITY)
  })

  it('목표를 넘어섰으면 최소 세기 — 더 데울 것이 없다', () => {
    expect(hazeIntensityOf(status({ setpoint: 30, actualValue: 35 }))).toBe(MIN_ACTIVE_INTENSITY)
  })

  it('차이가 벌어질수록 단조 증가한다', () => {
    const rates = [0, 1, 2, 4, 6, 10].map((gap) =>
      hazeIntensityOf(status({ setpoint: 30, actualValue: 30 - gap }))
    )
    expect(rates).toEqual([...rates].sort((a, b) => a - b))
  })

  it(`차이가 척도(${HAZE_SPAN_C}°C)를 넘으면 최대치에서 멈춘다`, () => {
    expect(hazeIntensityOf(status({ setpoint: 30, actualValue: 30 - HAZE_SPAN_C }))).toBe(1)
    expect(hazeIntensityOf(status({ setpoint: 30, actualValue: 0 }))).toBe(1)
  })
})

describe('제습 기류 — 습도가 목표를 넘을수록 강하다 (부호가 온도와 반대)', () => {
  it('정지면 0 이다', () => {
    expect(streakIntensityOf(status({ operatingMode: false }))).toBe(0)
  })

  it('목표에 닿아 있으면 최소 세기', () => {
    expect(streakIntensityOf(status({ setpoint: 50, actualValue: 50 }))).toBe(MIN_ACTIVE_INTENSITY)
  })

  it('습도가 높을수록 강해진다 — 히터와 방향이 반대다', () => {
    const dry = streakIntensityOf(status({ setpoint: 50, actualValue: 45 }))
    const humid = streakIntensityOf(status({ setpoint: 50, actualValue: 58 }))
    expect(humid).toBeGreaterThan(dry)
    expect(dry).toBe(MIN_ACTIVE_INTENSITY)
  })

  it(`차이가 척도(${STREAK_SPAN_RH}%RH)를 넘으면 최대치`, () => {
    expect(streakIntensityOf(status({ setpoint: 50, actualValue: 50 + STREAK_SPAN_RH }))).toBe(1)
  })
})

describe('베이 모드 — 가동 중인 설비의 종류가 정한다', () => {
  const unit = (kind: PaintingEquipment['kind'], running: boolean) => ({
    id: `${kind}-${running}`,
    kind,
    x: 0,
    y: 0,
    running,
    intensity: running ? 0.5 : 0,
  })

  it('히터만 돌면 heating', () => {
    expect(bayAirModeOf([unit('가스히터', true), unit('제습기', false)])).toBe('heating')
  })

  it('제습기만 돌면 drying', () => {
    expect(bayAirModeOf([unit('가스히터', false), unit('제습기', true)])).toBe('drying')
  })

  it('둘 다 돌면 mixed', () => {
    expect(bayAirModeOf([unit('가스히터', true), unit('제습기', true)])).toBe('mixed')
  })

  it('아무것도 안 돌면 idle — 설비가 있어도 정지면 공기를 안 만든다', () => {
    expect(bayAirModeOf([unit('가스히터', false), unit('제습기', false)])).toBe('idle')
    expect(bayAirModeOf([])).toBe('idle')
  })
})

describe('공장 → 베이별 대기', () => {
  const equipment = [
    equip({ id: 'H1', kind: '가스히터', bay: 'B2', x: 10, y: 10 }),
    equip({ id: 'H2', kind: '가스히터', bay: 'B2', x: 30, y: 40 }),
    equip({ id: 'D1', kind: '제습기', bay: 'B2', x: 20, y: 25 }),
    equip({ id: 'D2', kind: '제습기', bay: 'B10', x: 5, y: 5 }),
  ]

  it('베이 이름 순이다 — 렌더마다 자리가 바뀌지 않게 (숫자 섞임 고려)', () => {
    const states = bayAirStatesOf(equipment, new Map())
    expect(states.map((s) => s.bay)).toEqual(['B2', 'B10'])
  })

  it('설비가 차지하는 범위를 낸다 — 베이 볼륨의 바닥', () => {
    const [b2] = bayAirStatesOf(equipment, new Map())
    expect(b2.bounds).toEqual({ minX: 10, maxX: 30, minY: 10, maxY: 40 })
  })

  it('상태를 모르면 전부 정지로 본다 — 없는 가동을 지어내지 않는다', () => {
    const states = bayAirStatesOf(equipment, new Map())
    for (const state of states) {
      expect(state.mode).toBe('idle')
      expect(state.hazeIntensity).toBe(0)
      expect(state.streakIntensity).toBe(0)
    }
  })

  it('세기는 가동 중인 것들의 평균이다 — 정지한 설비가 평균을 끌어내리지 않는다', () => {
    const statusById = new Map([
      ['H1', status({ id: 'H1', setpoint: 30, actualValue: 30 })], // 최소 세기
      ['H2', status({ id: 'H2', operatingMode: false })], // 정지 — 평균에서 빠진다
      ['D1', status({ id: 'D1', setpoint: 50, actualValue: 50 })],
    ])
    const [b2] = bayAirStatesOf(equipment, statusById)
    expect(b2.hazeIntensity).toBe(MIN_ACTIVE_INTENSITY)
    expect(b2.mode).toBe('mixed')
  })

  it('가동/정지가 이펙트 상태로 그대로 이어진다', () => {
    const statusById = new Map([
      ['H1', status({ id: 'H1' })],
      ['D1', status({ id: 'D1', operatingMode: false })],
    ])
    const [b2] = bayAirStatesOf(equipment, statusById)
    const byId = new Map(b2.units.map((u) => [u.id, u]))
    expect(byId.get('H1')!.running).toBe(true)
    expect(byId.get('H1')!.intensity).toBeGreaterThan(0)
    expect(byId.get('D1')!.running).toBe(false)
    expect(byId.get('D1')!.intensity).toBe(0)
  })

  it('정지 설비도 목록에는 남는다 — 있다는 사실은 자리로 보여야 한다', () => {
    const [b2] = bayAirStatesOf(equipment, new Map())
    expect(b2.units).toHaveLength(3)
  })
})

describe('파티클 예산 — 세기는 개수가 아니라 밝기로 말한다', () => {
  it('세기가 0 이면 뿌리지 않는다', () => {
    expect(particleCountOf(0)).toBe(0)
  })

  it('세기에 비례하되 상한을 넘지 않는다', () => {
    expect(particleCountOf(1, 24)).toBe(24)
    expect(particleCountOf(0.5, 24)).toBe(12)
    expect(particleCountOf(2, 24)).toBe(24)
  })

  it('아주 옅어도 최소 몇 개는 보인다 — 켜져 있는데 안 보이면 안 된다', () => {
    expect(particleCountOf(0.01, 24)).toBe(4)
  })

  it('공장 전체 예산을 넘으면 비례해서 줄인다', () => {
    const counts = [24, 24, 24, 24, 24, 24, 24, 24, 24]
    const fitted = fitParticleBudget(counts, PARTICLES_TOTAL_MAX)
    expect(fitted.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(PARTICLES_TOTAL_MAX)
    expect(fitted.every((count) => count >= 2)).toBe(true)
  })

  it('예산 안이면 그대로 둔다', () => {
    expect(fitParticleBudget([4, 8], PARTICLES_TOTAL_MAX)).toEqual([4, 8])
  })

  it('0 은 0 으로 남는다 — 안 켜진 베이에 억지로 뿌리지 않는다', () => {
    const fitted = fitParticleBudget([0, 200, 200], 100)
    expect(fitted[0]).toBe(0)
  })
})
