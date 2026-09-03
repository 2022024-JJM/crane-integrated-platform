import type { PaintingEquipment } from '../model/equipment'
import { linkState, type PaintingEquipmentStatus } from '../model/equipmentStatus'

/*
 * **가동 뷰의 대기(大氣)** — 설비가 만드는 공기를 무엇으로 그릴지 정하는 규칙 (P5).
 *
 * 도장 베이에는 그릴 형상이 없다. 조립·의장은 점군이 있어 "무엇이 놓여 있나"를 보여 줄
 * 수 있지만, 도장에서 실제로 일어나는 일은 **공기를 만드는 것**이다 — 히터가 데우고
 * 제습기가 말린다. 그래서 이 뷰가 그리는 것은 물체가 아니라 그 공기다.
 *
 * 이 파일은 **그림이 아니라 규칙**이다. 세 가지를 정한다:
 *  ① 베이가 지금 무엇을 하고 있는가(`BayAirMode`) — 데우는가·말리는가·둘 다인가·쉬는가
 *  ② 열 헤이즈가 얼마나 진한가 — **목표 온도에 못 미칠수록 진하다**(더 데우고 있다)
 *  ③ 제습 기류가 얼마나 강한가 — **습도가 목표를 넘을수록 강하다**(더 빨아들이고 있다)
 *
 * ②③ 을 값에 연동하는 이유는 이 화면의 존재 이유다 — 켜짐/꺼짐만 그리면 SCADA 목록이
 * 이미 하는 말을 3D 로 되풀이하는 것이고, 세기가 값을 따라가야 **데이터가 보이는 대기**가
 * 된다.
 *
 * 세기를 화면(three.js)에서 계산하지 않고 여기 두는 이유: 렌더 코드 안의 수식은 검증할
 * 수 없다. 그림은 못 봐도 규칙은 잠글 수 있다.
 */

/** 이 베이가 지금 하고 있는 일 */
export type BayAirMode = 'heating' | 'drying' | 'mixed' | 'idle'

/** 대기 세기의 척도 — 이 폭만큼 벗어나면 최대 세기다 */
export const HAZE_SPAN_C = 6
export const STREAK_SPAN_RH = 12

/** 가동 중이면 최소한 이만큼은 보인다 — 목표에 닿아도 '켜져 있음' 이 사라지면 안 된다 */
export const MIN_ACTIVE_INTENSITY = 0.15

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

/**
 * 이 설비가 **지금 공기를 만들고 있는가.**
 *
 * 가동 플래그만 보지 않는다 — 통신이 끊겼거나 fault 가 뜬 설비의 '가동 중' 은 마지막으로
 * 받은 말이지 지금의 사실이 아니다. 그런 설비까지 공기를 뿜게 그리면, 화면이 고장을
 * 정상으로 덮는다.
 */
export function isMakingAir(status: PaintingEquipmentStatus | undefined): boolean {
  if (!status) return false
  if (linkState(status.modbusLink) !== 'online') return false
  if (status.faultCode !== 0) return false
  return status.operatingMode
}

/**
 * 열 헤이즈 세기(0~1) — **목표에 못 미칠수록 진하다.**
 *
 * 실측이 설정값보다 낮다 = 아직 데우는 중이다. 목표에 닿았거나 넘었으면 최소 세기로
 * 내려가되 0 이 되지는 않는다(가동 중인 히터가 화면에서 사라지면 안 된다).
 */
export function hazeIntensityOf(status: PaintingEquipmentStatus | undefined): number {
  if (!isMakingAir(status)) return 0
  const gap = status!.setpoint - status!.actualValue
  return MIN_ACTIVE_INTENSITY + (1 - MIN_ACTIVE_INTENSITY) * clamp01(gap / HAZE_SPAN_C)
}

/**
 * 제습 기류 세기(0~1) — **습도가 목표를 넘을수록 강하다.**
 *
 * 실측이 설정값보다 높다 = 아직 말리는 중이다. 온도와 부호가 반대인 것은 두 설비가
 * 값을 반대 방향으로 몰기 때문이다(히터는 올리고 제습기는 내린다).
 */
export function streakIntensityOf(status: PaintingEquipmentStatus | undefined): number {
  if (!isMakingAir(status)) return 0
  const gap = status!.actualValue - status!.setpoint
  return MIN_ACTIVE_INTENSITY + (1 - MIN_ACTIVE_INTENSITY) * clamp01(gap / STREAK_SPAN_RH)
}

/** 대기 안에 서 있는 설비 한 대 — 뷰어가 자리와 세기를 함께 읽는다 */
export interface AirUnit {
  id: string
  kind: PaintingEquipment['kind']
  /** 원본 EPSG:5187 좌표 — 베이 안의 상대 위치를 재는 데 쓴다 */
  x: number
  y: number
  running: boolean
  /** 이 설비 몫의 세기(0~1) — 히터는 헤이즈, 제습기는 기류 */
  intensity: number
}

/** 베이 하나의 대기 */
export interface BayAirState {
  /** 베이 이름 — 공장 안에서만 유일하다 */
  bay: string
  mode: BayAirMode
  /** 베이의 열 헤이즈 세기 — 가동 중인 히터들의 평균 */
  hazeIntensity: number
  /** 베이의 제습 기류 세기 — 가동 중인 제습기들의 평균 */
  streakIntensity: number
  units: AirUnit[]
  /** 설비가 차지하는 범위(EPSG:5187) — 베이 볼륨의 바닥 */
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
}

/** 가동 중인 것들의 평균 — 하나도 없으면 0 */
function meanOfRunning(units: readonly AirUnit[]): number {
  const running = units.filter((unit) => unit.running)
  if (running.length === 0) return 0
  return running.reduce((sum, unit) => sum + unit.intensity, 0) / running.length
}

/**
 * 이 베이의 모드 — **가동 중인 설비의 종류가 정한다.**
 * 정지한 설비는 공기를 만들지 않으므로 모드 판정에 끼지 않는다(있다는 사실은 자리로 남는다).
 */
export function bayAirModeOf(units: readonly AirUnit[]): BayAirMode {
  const heating = units.some((unit) => unit.running && unit.kind === '가스히터')
  const drying = units.some((unit) => unit.running && unit.kind === '제습기')
  if (heating && drying) return 'mixed'
  if (heating) return 'heating'
  if (drying) return 'drying'
  return 'idle'
}

/**
 * 공장 하나의 베이별 대기 — 뷰어가 받는 전부.
 *
 * 베이 이름 순으로 낸다(숫자 섞임 고려) — 렌더마다 베이 순서가 바뀌면 카메라를 맞춰 둔
 * 사람이 매번 다른 자리를 보게 된다.
 */
export function bayAirStatesOf(
  equipment: readonly PaintingEquipment[],
  statusById: ReadonlyMap<string, PaintingEquipmentStatus>
): BayAirState[] {
  const byBay = new Map<string, PaintingEquipment[]>()
  for (const item of equipment) {
    const bucket = byBay.get(item.bay)
    if (bucket) bucket.push(item)
    else byBay.set(item.bay, [item])
  }

  return [...byBay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
    .map(([bay, items]) => {
      const units: AirUnit[] = items.map((item) => {
        const status = statusById.get(item.id)
        const running = isMakingAir(status)
        return {
          id: item.id,
          kind: item.kind,
          x: item.x,
          y: item.y,
          running,
          intensity:
            item.kind === '가스히터' ? hazeIntensityOf(status) : streakIntensityOf(status),
        }
      })
      const heaters = units.filter((unit) => unit.kind === '가스히터')
      const dehumidifiers = units.filter((unit) => unit.kind === '제습기')
      return {
        bay,
        mode: bayAirModeOf(units),
        hazeIntensity: meanOfRunning(heaters),
        streakIntensity: meanOfRunning(dehumidifiers),
        units,
        bounds: {
          minX: Math.min(...items.map((i) => i.x)),
          maxX: Math.max(...items.map((i) => i.x)),
          minY: Math.min(...items.map((i) => i.y)),
          maxY: Math.max(...items.map((i) => i.y)),
        },
      }
    })
}

/*
 * ── 파티클 예산 ──────────────────────────────────────────────
 *
 * 세기가 높다고 파티클을 무한정 늘리지 않는다. 도장 5개 공장 중 가장 큰 곳이 베이 9개인데,
 * 베이마다 수백 개를 뿌리면 노는 화면에서도 GPU 가 돈다(그리기 루프가 유휴에 멈추는
 * 규칙과 정면으로 어긋난다). 세기는 **개수가 아니라 밝기·속도**로 표현하고, 개수는
 * 여기 상한 안에서만 움직인다.
 */
export const PARTICLES_PER_BAY_MAX = 24
export const PARTICLES_TOTAL_MAX = 180

/** 이 베이에 뿌릴 파티클 수 — 세기에 비례하되 상한을 넘지 않는다 */
export function particleCountOf(intensity: number, max = PARTICLES_PER_BAY_MAX): number {
  if (intensity <= 0) return 0
  return Math.max(4, Math.round(clamp01(intensity) * max))
}

/** 공장 전체 예산에 맞춰 베이별 개수를 줄인다 — 총량이 상한을 넘지 않게 */
export function fitParticleBudget(
  counts: readonly number[],
  total = PARTICLES_TOTAL_MAX
): number[] {
  const sum = counts.reduce((acc, count) => acc + count, 0)
  if (sum <= total) return [...counts]
  const scale = total / sum
  return counts.map((count) => (count === 0 ? 0 : Math.max(2, Math.floor(count * scale))))
}
