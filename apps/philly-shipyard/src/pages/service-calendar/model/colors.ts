import type { CalendarEvent } from '@crane/features/calendar';
import { TONE_DOT } from '../../../shared/ui/tone';
import {
  INSPECTION_STATUS_VARIANT,
  REPAIR_PRIORITY_VARIANT,
  REPAIR_STATUS_VARIANT,
  type BadgeVariant,
} from '../../../shared/ui/status-variants';

// 솔리드 칩(흰 텍스트 대비 필요) 전용 뉴트럴 — tone.ts의 반투명 neutral을 쓸 수 없는 유일한 예외
const SOLID_NEUTRAL = 'bg-slate-500';

// 점검 상태 색상 — TONE_DOT(red/amber/emerald 500)와 동일 스텝
const INSPECTION_ACCENT: Record<string, string> = {
  scheduled: SOLID_NEUTRAL,
  in_progress: TONE_DOT.warning,
  completed: TONE_DOT.positive,
  overdue: TONE_DOT.critical,
  cancelled: SOLID_NEUTRAL,
};

// 정비 우선순위 색상 (이벤트 칩은 우선순위축으로 색을 쓴다)
const REPAIR_ACCENT: Record<string, string> = {
  emergency: TONE_DOT.critical,
  high: TONE_DOT.warning,
  normal: TONE_DOT.info,
  low: SOLID_NEUTRAL,
};

/** 이벤트 칩/바 배경색 (colorKey = 점검:status / 정비:priority) */
export function eventAccent(event: CalendarEvent): string {
  const map = event.sourceType === 'inspection' ? INSPECTION_ACCENT : REPAIR_ACCENT;
  return map[event.colorKey] ?? SOLID_NEUTRAL;
}

/** 실제 상태(status) 기준 뱃지 variant — 페이지들과 동일한 공용 매핑 사용 */
export function statusBadgeVariant(event: CalendarEvent): BadgeVariant {
  const map: Record<string, BadgeVariant> =
    event.sourceType === 'inspection' ? INSPECTION_STATUS_VARIANT : REPAIR_STATUS_VARIANT;
  return map[event.status] ?? 'secondary';
}

/** 정비 우선순위 뱃지 variant */
export function priorityBadgeVariant(priority: string): BadgeVariant {
  return (REPAIR_PRIORITY_VARIANT as Record<string, BadgeVariant>)[priority] ?? 'secondary';
}

/**
 * 범례용 색상↔의미 매핑. 점검은 상태축, 정비는 우선순위축으로 색을 쓰므로
 * (예: 빨강이 점검=지연 / 정비=긴급) 두 축을 분리해 노출한다.
 */
export const LEGEND: {
  inspection: { key: string; accent: string }[];
  repair: { key: string; accent: string }[];
} = {
  inspection: [
    { key: 'scheduled', accent: INSPECTION_ACCENT.scheduled },
    { key: 'in_progress', accent: INSPECTION_ACCENT.in_progress },
    { key: 'completed', accent: INSPECTION_ACCENT.completed },
    { key: 'overdue', accent: INSPECTION_ACCENT.overdue },
  ],
  repair: [
    { key: 'emergency', accent: REPAIR_ACCENT.emergency },
    { key: 'high', accent: REPAIR_ACCENT.high },
    { key: 'normal', accent: REPAIR_ACCENT.normal },
    { key: 'low', accent: REPAIR_ACCENT.low },
  ],
};
