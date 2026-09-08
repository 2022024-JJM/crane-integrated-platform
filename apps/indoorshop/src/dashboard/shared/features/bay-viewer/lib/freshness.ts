import type { LidarSensor } from '../model/lidarSensor'

/*
 * 데이터 신선도 (PRD FR-1 신선도 · FR-9 데이터 지연).
 *
 * 임계값은 운영 합의 전까지의 **설정값**이다 — UI 컴포넌트에 하드코딩하지 않고
 * 여기 한 곳에 모아, 합의가 나면 이 파일만 고친다 (PRD 오픈 이슈 3).
 * 프레임워크 비의존 순수 함수 — 단위 테스트 대상.
 */
export const FRESHNESS_THRESHOLDS = {
  /** 이 시간이 지나면 개별 센서 표기를 '주의' 톤으로 */
  staleMinutes: 10,
  /** 이 시간이 지나면 개별 센서 표기를 '위험' 톤으로 */
  deadMinutes: 60,
  /** 공장 전체 뷰에 `데이터 지연` 배너를 띄우는 기준 — 가장 신선한 수신조차 이보다 오래됐을 때 */
  viewDelayMinutes: 10,
} as const

/** "HH:MM" 을 오늘 날짜의 시각으로 읽는다 (백엔드 포맷 미확정 — mock 은 시:분만 준다) */
export function parseScanTime(value: string, now: Date): Date | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const at = new Date(now)
  at.setHours(Number(match[1]), Number(match[2]), 0, 0)
  return at
}

/** heartbeat 원문(ISO8601 또는 개발 fixture의 HH:mm) 이후 경과 분. 값이 없으면 null */
export function heartbeatElapsedMinutes(
  heartbeatAt: string | undefined,
  now: Date,
): number | null {
  if (!heartbeatAt) return null
  const iso = new Date(heartbeatAt)
  if (!Number.isNaN(iso.getTime())) {
    return Math.max(0, Math.floor((now.getTime() - iso.getTime()) / 60000))
  }
  return elapsedMinutes(heartbeatAt, now)
}

/** 마지막 스캔 이후 경과 분. 읽을 수 없는 값이면 null */
export function elapsedMinutes(scanAt: string, now: Date): number | null {
  const at = parseScanTime(scanAt, now)
  if (!at) return null
  // 미래로 찍힌 값(시계 오차·자정 넘김)은 0 분으로 본다
  return Math.max(0, Math.floor((now.getTime() - at.getTime()) / 60000))
}

export interface LatestScan {
  /** 가장 신선한 수신의 원문 시각 — 원본 값을 보존해 그대로 보여준다 */
  time: string
  /** 그 수신 이후 경과 분 */
  minutes: number
}

/**
 * 센서 집합에서 가장 신선한 수신 하나 — `마지막 갱신 시각`(FR-8 헤더)과
 * `데이터 지연` 판정(FR-9)의 원천. 읽을 수 있는 수신이 하나도 없으면 null
 * (= 데이터 미수신, 지연과 구분해 표시한다).
 */
export function latestScan(sensors: LidarSensor[], now: Date): LatestScan | null {
  let best: LatestScan | null = null
  for (const sensor of sensors) {
    const minutes = elapsedMinutes(sensor.lastScanAt, now)
    if (minutes === null) continue
    if (best === null || minutes < best.minutes) {
      best = { time: sensor.lastScanAt, minutes }
    }
  }
  return best
}

/** 전체 뷰 `데이터 지연` 여부 — 원본 값 없음(null)은 지연이 아니라 미수신으로 다룬다 */
export function isViewDelayed(latest: LatestScan | null): boolean {
  return latest !== null && latest.minutes >= FRESHNESS_THRESHOLDS.viewDelayMinutes
}
