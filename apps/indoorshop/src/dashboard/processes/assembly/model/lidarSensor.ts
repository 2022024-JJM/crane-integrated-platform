/*
 * LiDAR 센서 상태 모델 (PRD FR-1 · §7.1 — `ot/device/{zone}/lidar/{id}/status` 계약).
 * 기준 문서(필드데이터 v0.2)의 네 상태를 그대로 쓴다: ONLINE | OFFLINE | ERROR | CALIBRATING.
 */
export type LidarSensorStatus = 'online' | 'offline' | 'error' | 'calibrating'

/**
 * `raw_payload.*` 진단값 — 장비가 준 값만 담는다. 없는 값은 추정하지 않고 화면이
 * `-` 로 낸다 (FR-1). 임계값(정상·주의·위험)은 장비사 확인 전이라 색 판정을 하지
 * 않으므로 여기에는 수치만 있다.
 */
export interface LidarDiagnostics {
  scanRatePtsPerSec?: number
  temperatureC?: number
  rssiDbm?: number
  fovMode?: string
}

export interface LidarSensor {
  id: string
  locationId: string
  name: string
  status: LidarSensorStatus
  lastScanAt: string
  /**
   * 마지막 heartbeat 시각 — 데이터 신선도의 기준(FR-1). 계약(§7.1)상 필수지만
   * 실측 데이터셋 등 아직 안 주는 출처가 있어 optional 로 두고, 없으면 스캔
   * 시각으로 신선도를 대신한다 (lib/freshness).
   */
  lastHeartbeatAt?: string
  /** 원문 오류 코드 — 사용자용 설명 매핑이 생기기 전에는 원문 그대로 보존한다 (FR-1) */
  errorCode?: string
  diagnostics?: LidarDiagnostics
}
