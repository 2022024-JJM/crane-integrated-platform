import type { TFunction } from 'i18next'
import type { InshopKey } from '../../../lib/i18n/keys'
import type { ChipTone } from '../../../ui/atoms/StatusChip'
import { STATUS_STYLE, type StatusMeaning } from '../../../ui/statusPalette'

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
 * 색은 상태 팔레트에서 받는다 — 심각도도 결국 "이상/주의/그 밖"이라 다른 화면의
 * 같은 뜻과 같은 색이어야 한다. (클래스는 팔레트가 **문자열 상수로** 들고 있다.
 * `text-status-${severity}` 처럼 조립하면 Tailwind 정적 스캔이 못 찾아 빌드에서 사라진다.)
 */
export const ALARM_SEVERITY_META: Record<
  AlarmSeverity,
  { labelKey: InshopKey; tone: ChipTone; meaning: StatusMeaning; dotClass: string; textClass: string }
> = {
  critical: {
    labelKey: 'alarms.severity.critical',
    tone: 'critical',
    meaning: 'error',
    dotClass: STATUS_STYLE.error.fill,
    textClass: STATUS_STYLE.error.ink,
  },
  warning: {
    labelKey: 'alarms.severity.warning',
    tone: 'warning',
    meaning: 'warning',
    dotClass: STATUS_STYLE.warning.fill,
    textClass: STATUS_STYLE.warning.ink,
  },
  info: {
    labelKey: 'alarms.severity.info',
    tone: 'neutral',
    meaning: 'idle',
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
