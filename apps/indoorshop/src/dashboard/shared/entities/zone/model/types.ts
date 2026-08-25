import type { InshopKey } from '../../../lib/i18n/keys'
import type { ChipTone } from '../../../ui/atoms/StatusChip'

/** 서비스가 **돌고 있는가** — 프로세스 자체의 상태 */
export type ZoneStatus = 'running' | 'stopped' | 'error'
/** 돌고 있는 것이 **제대로 걷고 있는가** — 연결·지연·오류율의 종합 */
export type ZoneHealth = 'healthy' | 'degraded' | 'unhealthy'

/** 건전성 판정을 이루는 개별 점검 항목 */
export type ZoneCheckState = 'ok' | 'warn' | 'fail'

export interface ZoneCheck {
  /** 무엇을 봤는가 (예: `수집 경로`) */
  labelKey: InshopKey
  state: ZoneCheckState
  /** 판정의 근거가 되는 실제 값 (예: `MQTT 구독 4/4 · 최근 이벤트 8초 전`) */
  detailKey: InshopKey
}

export interface Zone {
  id: string
  /**
   * 화면에 낼 이름·근거는 전부 **번역 키**다.
   * 실적 판정 문구는 결국 서버가 만들게 되지만, 지금 화면을 채우는 값은 목업이라
   * 언어를 따라가야 한다 — 한쪽만 한국어로 남으면 영어 화면이 반쯤 깨져 보인다.
   */
  displayNameKey: InshopKey
  status: ZoneStatus
  health: ZoneHealth
  processingCount: number
  lastUpdateKey: InshopKey
  /** 실적을 어디서 받아오는가 — "무엇이 실행 중인지"를 가르는 첫 정보 (없을 수 있다) */
  source?: string
  /** 상태 배지가 무엇을 근거로 그렇게 판정됐는지 (한 줄) */
  statusDetailKey: InshopKey
  /** 건전성 배지의 근거 (한 줄) */
  healthDetailKey: InshopKey
  /** 근거의 내역 — 배지 하나로는 어디가 문제인지 알 수 없다 */
  checks: ZoneCheck[]
}

/*
 * 배지 문구의 단일 출처.
 *
 * "실행 중"과 "정상"이 나란히 붙어 있으면 둘이 같은 말로 보인다. 그래서 라벨마다
 * **무엇을 본 판정인지**(meaning)를 함께 들고 다니게 하고, 화면은 배지 옆이나
 * 툴팁에 그것을 반드시 같이 낸다.
 */
export const ZONE_STATUS_META: Record<
  ZoneStatus,
  { labelKey: InshopKey; tone: ChipTone; meaningKey: InshopKey }
> = {
  running: {
    labelKey: 'zone.status.running',
    tone: 'good',
    meaningKey: 'zone.statusMeaning.running',
  },
  stopped: {
    labelKey: 'zone.status.stopped',
    tone: 'critical',
    meaningKey: 'zone.statusMeaning.stopped',
  },
  error: {
    labelKey: 'zone.status.error',
    tone: 'critical',
    meaningKey: 'zone.statusMeaning.error',
  },
}

export const ZONE_HEALTH_META: Record<
  ZoneHealth,
  { labelKey: InshopKey; tone: ChipTone; meaningKey: InshopKey }
> = {
  healthy: {
    labelKey: 'zone.health.healthy',
    tone: 'good',
    meaningKey: 'zone.healthMeaning.healthy',
  },
  degraded: {
    labelKey: 'zone.health.degraded',
    tone: 'warning',
    meaningKey: 'zone.healthMeaning.degraded',
  },
  unhealthy: {
    labelKey: 'zone.health.unhealthy',
    tone: 'critical',
    meaningKey: 'zone.healthMeaning.unhealthy',
  },
}

export const ZONE_CHECK_META: Record<ZoneCheckState, { dotClass: string; labelKey: InshopKey }> = {
  ok: { dotClass: 'bg-status-healthy', labelKey: 'zone.checkState.ok' },
  warn: { dotClass: 'bg-status-degraded', labelKey: 'zone.checkState.warn' },
  fail: { dotClass: 'bg-status-unhealthy', labelKey: 'zone.checkState.fail' },
}
