import { describe, expect, it } from 'vitest'
import type { AirUnit } from '../airEffect'
import { stationsOf, WALL_INSET_M } from '../bayStations'

/**
 * 베이 안 **설비 자리 규칙** (R38).
 *
 * 규칙을 렌더 밖에 둔 이유가 이 파일이다 — three.js 안에서 좌표를 계산하면 WebGL 이 없는
 * 곳에서는 한 줄도 실행되지 않아 검증할 방법이 없다.
 *
 * 잠그는 것은 넷이다:
 *  ① 히터는 **긴 벽면**에 선다 (가운데 흩어지지 않는다 — 사용자 지적의 핵심)
 *  ② 벽 위에서 **등간격**이다
 *  ③ 제습기는 **코너**를 먼저 차지한다 (덕트 라인의 관례 자리)
 *  ④ 모든 자리가 **발자국 안**이고, 입력 순서가 뒤섞여도 같은 자리다
 */

const SIZE: [number, number] = [40, 60]

function unit(id: string, kind: AirUnit['kind']): AirUnit {
  return { id, kind, x: 0, y: 0, running: true, intensity: 0.5, value: 20, setpoint: 24 }
}

describe('가스히터 — 긴 벽면 하부에 등간격', () => {
  it('좌우 긴 벽에 나눠 선다 — 베이 한가운데 뜨지 않는다', () => {
    const stations = stationsOf(
      ['GH1', 'GH2', 'GH3', 'GH4'].map((id) => unit(id, '가스히터')),
      SIZE
    )
    const wallX = SIZE[0] / 2 - WALL_INSET_M
    for (const station of stations) expect(Math.abs(station.x)).toBeCloseTo(wallX, 6)
    expect(stations.filter((s) => s.x < 0)).toHaveLength(2)
    expect(stations.filter((s) => s.x > 0)).toHaveLength(2)
  })

  it('같은 벽 위에서 간격이 같다', () => {
    const stations = stationsOf(
      ['GH1', 'GH2', 'GH3', 'GH4', 'GH5', 'GH6'].map((id) => unit(id, '가스히터')),
      SIZE
    )
    const left = stations.filter((s) => s.x < 0).map((s) => s.z).sort((a, b) => a - b)
    expect(left).toHaveLength(3)
    const gaps = left.slice(1).map((z, i) => z - left[i])
    for (const gap of gaps) expect(gap).toBeCloseTo(gaps[0], 6)
  })

  it('한 대뿐이면 벽 한가운데 — 치우치지 않는다', () => {
    const [station] = stationsOf([unit('GH1', '가스히터')], SIZE)
    expect(station.z).toBeCloseTo(0, 6)
  })

  it('토출구가 베이 안쪽을 본다 — 벽을 보고 부는 히터는 거짓말이다', () => {
    const stations = stationsOf(
      ['GH1', 'GH2'].map((id) => unit(id, '가스히터')),
      SIZE
    )
    for (const station of stations) {
      /* yaw 는 정면(+z)을 돌리는 각 — 돌린 정면의 x 부호가 벽 반대쪽이어야 한다 */
      const facingX = Math.sin(station.yaw)
      expect(Math.sign(facingX)).toBe(-Math.sign(station.x))
    }
  })
})

describe('제습기 — 코너 먼저, 그다음 덕트 라인', () => {
  it('넷까지는 네 코너를 하나씩 차지한다', () => {
    const stations = stationsOf(
      ['DH1', 'DH2', 'DH3', 'DH4'].map((id) => unit(id, '제습기')),
      SIZE
    )
    const cornerX = SIZE[0] / 2 - WALL_INSET_M
    const cornerZ = SIZE[1] / 2 - WALL_INSET_M
    const seen = new Set(stations.map((s) => `${Math.sign(s.x)}${Math.sign(s.z)}`))
    expect(seen.size).toBe(4)
    for (const station of stations) {
      expect(Math.abs(station.x)).toBeCloseTo(cornerX, 6)
      expect(Math.abs(station.z)).toBeCloseTo(cornerZ, 6)
    }
  })

  it('넘치면 짧은 벽(덕트 라인)에 등간격으로 선다', () => {
    const stations = stationsOf(
      ['DH1', 'DH2', 'DH3', 'DH4', 'DH5', 'DH6', 'DH7', 'DH8'].map((id) => unit(id, '제습기')),
      SIZE
    )
    const ductZ = SIZE[1] / 2 - WALL_INSET_M
    const onFront = stations.filter((s) => Math.abs(s.z - -ductZ) < 1e-6)
    /* 코너 둘 + 덕트 라인 둘 */
    expect(onFront.length).toBeGreaterThanOrEqual(3)
  })
})

describe('자리는 언제나 발자국 안이고, 순서에 흔들리지 않는다', () => {
  const units = [
    unit('GH1', '가스히터'),
    unit('DH1', '제습기'),
    unit('GH2', '가스히터'),
    unit('DH2', '제습기'),
    unit('GH3', '가스히터'),
  ]

  it('모든 자리가 베이 안이다', () => {
    for (const size of [[40, 60], [12, 12], [120, 30]] as [number, number][]) {
      for (const station of stationsOf(units, size)) {
        expect(Math.abs(station.x)).toBeLessThanOrEqual(size[0] / 2)
        expect(Math.abs(station.z)).toBeLessThanOrEqual(size[1] / 2)
      }
    }
  })

  it('입력 순서를 뒤집어도 같은 자리다 — 폴링마다 설비가 이사 다니지 않는다', () => {
    const forward = stationsOf(units, SIZE)
    const backward = stationsOf([...units].reverse(), SIZE)
    expect(backward).toEqual(forward)
  })

  it('설비 하나가 자리 하나 — 겹쳐 세우지 않는다', () => {
    const stations = stationsOf(units, SIZE)
    expect(stations).toHaveLength(units.length)
    const places = new Set(stations.map((s) => `${s.x.toFixed(3)}:${s.z.toFixed(3)}`))
    expect(places.size).toBe(units.length)
  })
})
