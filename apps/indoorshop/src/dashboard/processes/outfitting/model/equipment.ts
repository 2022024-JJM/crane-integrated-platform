import type { InshopKey } from '../../../shared/lib/i18n/keys'
import type { LidarSensorStatus } from '../../../shared/features/bay-viewer/model/lidarSensor'

/**
 * 선행의장 **설비 상태** 도메인 모델.
 *
 * 의장에서 보는 것은 조립처럼 LiDAR 한 종류가 아니다 — 도면(Network Panel 260903 Rev.)
 * 기준으로 의장 공장에도 라이다(LD-*)·틸팅모듈(PT-*)이 쌍으로 서고, 그 뒤에 Edge PC 와
 * 네트워크 판넬이 한 대씩 붙는다. 그래서 상태 화면의 단위는 '센서'가 아니라 **설비**다.
 *
 * 상태값 자체는 조립과 같은 낱말을 쓴다(`LidarSensorStatus` — ONLINE/OFFLINE/ERROR/
 * CALIBRATING, §7.1 계약). 의장만 다른 낱말을 만들면 두 공정의 '오프라인'이 같은
 * 뜻인지 매번 확인해야 한다.
 */

/** 의장 설비 상태 화면이 다루는 설비 종류 — 설비 엔티티 `typeId` 와 같은 값 */
export type OutfittingDeviceKind = 'LIDAR' | 'TILT' | 'EDGE' | 'PNL'

/** 화면에 세우는 순서 — 관측(라이다·틸팅) 먼저, 그 뒤 수집·네트워크 */
export const OUTFITTING_DEVICE_KINDS: readonly OutfittingDeviceKind[] = [
  'LIDAR',
  'TILT',
  'EDGE',
  'PNL',
]

/** 종류별 문구·색 — 라벨은 번역 키로만 들고 다닌다(사이드바 규칙과 같은 이유) */
export const OUTFITTING_DEVICE_META: Record<
  OutfittingDeviceKind,
  { labelKey: InshopKey; color: string }
> = {
  LIDAR: { labelKey: 'outfitting.equipment.kind.lidar', color: '#6a4fd0' },
  TILT: { labelKey: 'outfitting.equipment.kind.tilt', color: '#8a63d2' },
  EDGE: { labelKey: 'outfitting.equipment.kind.edge', color: '#5d6d7e' },
  PNL: { labelKey: 'outfitting.equipment.kind.panel', color: '#37474f' },
}

/**
 * 의장 설비 한 대.
 *
 * `bay` 는 **공장 안에서만 유일**하다(설비 엔티티와 같은 규칙) — 공장 없이 베이만으로
 * 색인하지 않는다. `placeholder` 는 이 한 대가 설비 엔티티의 실좌표 행이 아니라
 * 도면 수령 전 자리만 잡아 둔 목업이라는 표시다 — 화면이 그 사실을 숨기지 않는다.
 */
export interface OutfittingDevice {
  id: string
  kind: OutfittingDeviceKind
  /** 소속 공장 이름 (`OutfittingFactorySpec.name` = 설비 엔티티 factory) */
  factory: string
  /** 소속 베이 — 엔티티 행이면 도면 베이, 목업이면 구역 코드 */
  bay: string
  status: LidarSensorStatus
  /** 마지막 heartbeat (HH:MM) — 신선도 판정의 기준 */
  lastHeartbeatAt: string
  /** 마지막 스캔 (HH:MM) — 관측 설비(LIDAR/TILT)만 갖는다 */
  lastScanAt?: string
  placeholder: boolean
}

/** 공장 한 곳의 설비 집계 — 카드 접힌 줄과 전체 요약이 같은 값을 읽는다 */
export interface OutfittingDeviceSummary {
  factory: string
  total: number
  online: number
  /** online 이 아닌 대수 — 점검 필요 */
  issues: number
  byKind: Record<OutfittingDeviceKind, { total: number; online: number }>
  /** 이 공장의 설비가 전부 목업 자리인가 (설비 엔티티에 아직 행이 없음) */
  placeholder: boolean
  /** 가장 최근 heartbeat (HH:MM) — 없으면 undefined */
  lastHeartbeatAt?: string
}
