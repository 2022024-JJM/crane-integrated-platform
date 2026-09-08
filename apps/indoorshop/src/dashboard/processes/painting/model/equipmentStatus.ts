/*
 * 선행도장 설비 운전 상태 도메인 — 화면이 소비하는 상태 타입.
 *
 * 근거: 도장 PLC 태그 6종(§3-도장 · `가공_필드데이터_메시지설계_분석.md`).
 *   operating_mode / setpoint / actual_value / runtime_minutes_today / modbus_link / fault_code
 *
 * 아직 실데이터가 없어 값 자체는 화면(B2)이 mock 으로 채운다(`lib/equipmentStatusMock`).
 * 여기서는 **타입 계약만** 둔다 — 실연동 시 mock 만 실제 Modbus/Provider 조회로 바꾸면
 * 화면은 손대지 않는다.
 *
 * 조립의 `LidarSensor`(online/offline/error) 와 성격이 닮았지만 **억지로 통합하지 않는다**
 * (§4.4 · zone 모듈 간 직접 참조 금지 원칙과도 일치). modbus_link 는 3종 enum, operating_mode
 * 는 bool 로 조립 타입과 값 자체가 다르다.
 */
import type { PaintingEquipmentKind } from './equipment'

/** Modbus 통신 상태 — 온라인/오프라인 배지의 근거 (§1.3 `modbus_link`) */
export type ModbusLink = 'OK' | 'TIMEOUT' | 'CRC_ERROR'

/**
 * 설비 한 대의 현재 운전 상태 스냅샷.
 *
 * setpoint/actualValue 의 **단위는 값에 실려 있지 않다** — 설비 종류로 정한다
 * (제습기 = %RH, 히터 = °C · §1.3). 그래서 화면 컴포넌트는 상태값과 함께 종류를 늘
 * 들고 있어야 단위를 붙일 수 있다(§4.4). 단위 결정은 `statusUnit()` 한 곳에서만 한다.
 */
export interface PaintingEquipmentStatus {
  /** 설비 ID — `PaintingEquipment.id` 와 짝 */
  id: string
  /** 가동/정지 (§1.3 operating_mode) */
  operatingMode: boolean
  /** 설정값 (단위는 종류 종속) */
  setpoint: number
  /** 실측값 (게이지/차트의 주 지표) */
  actualValue: number
  /** 당일 누적 가동 시간(분) — mock 은 계산값이다(PLC 직접 제공 여부 미확정, §5.1) */
  runtimeMinutesToday: number
  /** 통신 상태 */
  modbusLink: ModbusLink
  /** 장비 fault 코드 (0 = 정상). 코드→문구 매핑은 문서에 없음(§5.1) */
  faultCode: number
  /** 이 값을 마지막으로 받은 시각(epoch ms) — 신선도(fresh/stale) 판정에 쓴다 */
  receivedAt: number
}

/** 설정·실측값의 단위 — 설비 종류가 정한다 (§1.3 · §4.4) */
export function statusUnit(kind: PaintingEquipmentKind): '%RH' | '°C' {
  return kind === '제습기' ? '%RH' : '°C'
}

/** 통신 상태 → 온라인/오프라인/오류 3분류 (조립 LidarSensor 패턴과 대응, 타입은 별개) */
export function linkState(link: ModbusLink): 'online' | 'offline' | 'error' {
  if (link === 'OK') return 'online'
  if (link === 'TIMEOUT') return 'offline'
  return 'error'
}

/**
 * 값의 신선도 — 마지막 수신이 이 시간(ms)을 넘기면 stale.
 * 폴링 주기(6초)의 약 3배 — 한두 번 건너뛴 것과 끊긴 것을 가른다.
 */
export const STALE_AFTER_MS = 18_000

/** 지금 기준 stale 인가 */
export function isStale(status: PaintingEquipmentStatus, now: number): boolean {
  return now - status.receivedAt > STALE_AFTER_MS
}
