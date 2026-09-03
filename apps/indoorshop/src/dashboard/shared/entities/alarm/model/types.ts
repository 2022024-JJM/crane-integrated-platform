import type { TFunction } from 'i18next'
import type { InshopKey } from '../../../lib/i18n/keys'
import type { ChipTone } from '../../../ui/atoms/StatusChip'

export type AlarmSeverity = 'critical' | 'warning' | 'info'

export interface Alarm {
  id: string
  severity: AlarmSeverity
  /**
   * 표시 문구.
   *
   * 목업은 **번역 키**를 들고 있고(`titleKey`/`messageKey`), 실제 알림 API 가 붙으면
   * 서버가 보낸 문장이 `title`/`message` 로 들어온다 — 두 경로를 다 받아 두는 이유는
   * 서버 문구까지 프론트에서 번역할 수는 없기 때문이다.
   */
  titleKey?: InshopKey
  messageKey?: InshopKey
  title?: string
  message?: string
  /** 알람을 낸 주체 (서비스·설비 이름) — 고유명사라 번역하지 않는다 */
  source: string
  /** 관련 공정존 — 있으면 목록 항목이 그 화면으로 이동한다 */
  zoneId?: string
  /** 이동 경로 — zone 상세보다 더 구체적인 화면이 있으면 그쪽 */
  href?: string
  occurredAt: string
  read: boolean
}

/** 화면에 낼 제목·본문을 한 곳에서 정한다 (키 우선, 없으면 서버 문구) */
export function alarmText(
  alarm: Alarm,
  t: TFunction
): { title: string; message: string } {
  return {
    title: alarm.titleKey ? t(alarm.titleKey) : (alarm.title ?? ''),
    message: alarm.messageKey ? t(alarm.messageKey) : (alarm.message ?? ''),
  }
}

/*
 * 색 클래스는 여기서 **문자열 상수로** 완성해 둔다.
 * `text-status-${severity}` 처럼 조립하면 Tailwind 가 정적 스캔에서 찾지 못해
 * 빌드 결과에 그 클래스가 아예 없다.
 */
export const ALARM_SEVERITY_META: Record<
  AlarmSeverity,
  { labelKey: InshopKey; tone: ChipTone; dotClass: string; textClass: string }
> = {
  critical: {
    labelKey: 'alarms.severity.critical',
    tone: 'critical',
    dotClass: 'bg-status-unhealthy',
    textClass: 'text-status-unhealthy',
  },
  warning: {
    labelKey: 'alarms.severity.warning',
    tone: 'warning',
    dotClass: 'bg-status-degraded',
    textClass: 'text-status-degraded',
  },
  info: {
    labelKey: 'alarms.severity.info',
    tone: 'neutral',
    dotClass: 'bg-foreground/30',
    textClass: 'text-foreground/45',
  },
}

/** 심각도 정렬 우선순위 — 같은 시각이면 위험이 위로 */
export const ALARM_SEVERITY_ORDER: Record<AlarmSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
}
