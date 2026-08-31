/*
 * 도장 설비 운전 상태 **모의(mock) 생성기** — 실 Modbus 데이터가 붙기 전까지의 채움.
 *
 * 설계 근거(`가공_필드데이터_메시지설계_분석.md` §4.3): 조립의 해시 기반 결정론적 가짜값
 * 기법을 재사용하되, **시간에 따라 값이 변하는** 폴링 성격을 흉내 낸다. 그래서 이 함수는
 *   (1) 설비 ID 해시로 설비마다 안정된 개성(설정값·기저 상태)을 주고,
 *   (2) `now`(epoch ms)를 함께 넣어 실측값·가동·통신 상태가 **주기적으로 흔들리게** 한다.
 * 화면이 이걸 몇 초마다 다시 부르면 값과 "최근 수신 시각"이 갱신되어, 실 폴링으로 바뀔 때
 * 로딩/신선도 로직이 이미 검증된 상태로 남는다.
 *
 * **순수 함수다** — `now` 를 인자로 받아 시계를 직접 읽지 않는다(테스트·재현 가능). 시계는
 * 호출부(repository/훅)가 주입한다.
 */
import type { PaintingEquipment, PaintingEquipmentKind } from '../model/equipment'
import type { ModbusLink, PaintingEquipmentStatus } from '../model/equipmentStatus'

/** 문자열 → 32bit 정수 해시 (FNV-1a). 설비 ID 로 안정된 시드를 만든다 */
function hashOf(text: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** 시드에서 0..1 실수 하나 뽑기 (해시를 한 번 더 섞어 축끼리 독립적이게) */
function unit(seed: number, salt: number): number {
  const mixed = Math.imul(seed ^ (salt * 0x9e3779b1), 0x85ebca6b) >>> 0
  return mixed / 0xffffffff
}

/** 종류별 설정값·진폭 규약 (§1.3 단위: 제습기=%RH, 히터=°C) */
function band(kind: PaintingEquipmentKind): { base: number; spread: number; swing: number } {
  // 제습기: 목표 50±10 %RH, 실측이 목표 근처에서 ±4 흔들림
  // 히터: 목표 30±8 °C, 실측이 ±3 흔들림
  return kind === '제습기'
    ? { base: 50, spread: 10, swing: 4 }
    : { base: 30, spread: 8, swing: 3 }
}

/**
 * 설비 한 대의 현재 상태를 만든다.
 *
 * @param now epoch ms — 이 값이 흐르면 실측값·상태가 서서히 바뀐다.
 */
export function mockEquipmentStatus(
  equipment: PaintingEquipment,
  now: number
): PaintingEquipmentStatus {
  const seed = hashOf(equipment.id)
  const { base, spread, swing } = band(equipment.kind)

  // 설정값: 설비마다 고정 (해시로 base±spread 안에서 한 번 정해짐)
  const setpoint = Math.round((base + (unit(seed, 1) - 0.5) * 2 * spread) * 10) / 10

  // 위상 오프셋 — 설비마다 다른 박자로 흔들리도록
  const phase = unit(seed, 2) * Math.PI * 2

  // 대부분 가동. 아주 느린 사인(주기 ~4분)으로 이따금 정지로 넘어간다.
  const dutyWave = Math.sin(now / 240_000 + phase)
  const operatingMode = dutyWave > -0.55

  // 실측값: 가동 중이면 설정값 근처에서 흔들리고(주기 ~8초), 정지면 상온/실내로 흘러내린다.
  const wobble = Math.sin(now / 8_000 + phase) * swing + (unit(seed, now % 997) - 0.5) * (swing * 0.4)
  const idle = equipment.kind === '제습기' ? 68 : 16 // 정지 시 자연 상태값
  const actualRaw = operatingMode ? setpoint + wobble : idle + wobble * 0.4
  const actualValue = Math.round(actualRaw * 10) / 10

  // 통신 상태: 대부분 OK. 30초 창마다 해시로 뽑힌 소수 설비만 TIMEOUT/CRC 로 흔들린다.
  const linkWindow = Math.floor(now / 30_000)
  const linkDraw = unit(seed ^ linkWindow, 7)
  let modbusLink: ModbusLink = 'OK'
  if (linkDraw > 0.94) modbusLink = 'TIMEOUT'
  else if (linkDraw > 0.9) modbusLink = 'CRC_ERROR'

  // fault: 대부분 0. 90초 창마다 극소수 설비만 코드가 뜬다.
  const faultWindow = Math.floor(now / 90_000)
  const faultDraw = unit(seed ^ (faultWindow * 31), 11)
  const faultCode = faultDraw > 0.95 ? 100 + (seed % 40) : 0

  // 당일 누적 가동시간(분): 자정부터 흐른 시간에 설비별 가동률을 곱한 계산값(≈).
  const minutesToday = ((now % 86_400_000) / 60_000) * (0.55 + unit(seed, 5) * 0.4)
  const runtimeMinutesToday = Math.round(operatingMode ? minutesToday : minutesToday * 0.8)

  // 수신 시각: 통신이 살아 있으면 방금(now), 끊겼으면 마지막 성공이 창 시작쯤이라
  // 신선도가 stale 로 넘어가 보인다.
  const receivedAt = modbusLink === 'OK' ? now : linkWindow * 30_000

  return {
    id: equipment.id,
    operatingMode,
    setpoint,
    actualValue,
    runtimeMinutesToday,
    modbusLink,
    faultCode,
    receivedAt,
  }
}
