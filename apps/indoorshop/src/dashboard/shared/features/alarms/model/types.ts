/*
 * 통합 알람 레일의 어휘 (W7-1).
 *
 * 알람은 **판정 결과**이지 저장된 레코드가 아니다 — 원천 데이터(매칭 캐스케이드·설비
 * 상태 스냅샷·일일 배치 그레인)를 순수 함수(`derive.ts`)가 접어서 만들고, 원천이
 * 갱신되면 알람도 다시 계산된다. 그래서 별도 알람 mock 우주가 없다: 알람이 가리키는
 * 블록·설비·테이블은 전부 화면 어딘가에 실제로 서 있는 것들이다.
 *
 * 문구를 여기 두지 않는 이유 — 판정 함수는 i18n 을 모른다. 알람은 **번역 키 + 파라미터**
 * 로 서고, 문장은 UI 계층(`useRailAlarms`)이 t() 로 완성한다. 판정 규칙 테스트가
 * 번역 리소스에 묶이지 않게 하기 위해서다.
 */
import type { InshopKey } from '../../../lib/i18n/keys'

/**
 * 심각도 2단 — 이만하면 충분하다(과설계 금지).
 *  - `critical` 수집이 실제로 멈췄거나 잘못 가고 있다 — 지금 손대야 한다
 *  - `warning`  주의 신호 — 오늘 안에 확인하면 된다
 */
export type RailSeverity = 'critical' | 'warning'

/** 알람 원천 축 — 셋뿐이다 (매칭 불일치 · 설비 이상 · 배치/수집 공백) */
export type RailAlarmKind = 'mismatch' | 'equipment' | 'batch'

export interface RailAlarm {
  /**
   * 안정 식별자 — sessionStorage dismiss 의 키. 같은 사정이면 다시 계산돼도 같은
   * id 가 나와야 한다(지운 알람이 다음 폴링에 되살아나면 dismiss 가 거짓말이 된다).
   */
  id: string
  severity: RailSeverity
  kind: RailAlarmKind
  titleKey: InshopKey
  titleParams?: Record<string, string | number>
  messageKey: InshopKey
  messageParams?: Record<string, string | number>
  /** 알람을 낸 주체(설비ID·블록·테이블명) — 고유명사라 번역하지 않는다 */
  source: string
  /** 해당 화면 딥링크 — 기존 계약(통합실적 쿼리·드릴다운 URL)만 쓴다. 없으면 null */
  href: string | null
  /** ISO — 원천이 말하는 시각(판별일·스냅샷 시각·최신 실적일) */
  occurredAt: string
}

/** 심각도 정렬 — 같은 시각이면 위험이 위로 (기존 알림 정렬 규칙과 같다) */
export const RAIL_SEVERITY_ORDER: Record<RailSeverity, number> = {
  critical: 0,
  warning: 1,
}

export function byRailSeverityThenTime(a: RailAlarm, b: RailAlarm): number {
  const severity = RAIL_SEVERITY_ORDER[a.severity] - RAIL_SEVERITY_ORDER[b.severity]
  if (severity !== 0) return severity
  return b.occurredAt.localeCompare(a.occurredAt)
}
