import type { CalendarEvent } from '@crane/features/calendar';

type BadgeVariant = 'success' | 'warning' | 'destructive' | 'secondary';

// 점검 상태 색상 — 공용 톤 규칙(red/amber/emerald/blue 500)과 동일. 솔리드 칩은
// 흰 텍스트 대비가 필요해 뉴트럴만 slate-500 고정값을 쓴다.
const INSPECTION_ACCENT: Record<string, string> = {
  scheduled: 'bg-slate-500',
  in_progress: 'bg-amber-500',
  completed: 'bg-emerald-500',
  overdue: 'bg-red-500',
  cancelled: 'bg-slate-500',
};

const INSPECTION_BADGE: Record<string, BadgeVariant> = {
  scheduled: 'secondary',
  in_progress: 'warning',
  completed: 'success',
  overdue: 'destructive',
  cancelled: 'secondary',
};

// 정비 우선순위 색상 — maintenance-page의 PRIORITY_VARIANT 기반
const REPAIR_ACCENT: Record<string, string> = {
  emergency: 'bg-red-500',
  high: 'bg-amber-500',
  normal: 'bg-blue-500',
  low: 'bg-slate-500',
};

const REPAIR_PRIORITY_BADGE: Record<string, BadgeVariant> = {
  emergency: 'destructive',
  high: 'warning',
  normal: 'secondary',
  low: 'secondary',
};

// 정비 상태별 뱃지 — maintenance-page COLUMN_CONFIG semantics
const REPAIR_STATUS_BADGE: Record<string, BadgeVariant> = {
  received: 'secondary',
  waiting_parts: 'destructive',
  in_progress: 'warning',
  re_inspection: 'warning',
  completed: 'success',
  on_hold: 'secondary',
};

/** 이벤트 칩/바 배경색 (colorKey = 점검:status / 정비:priority) */
export function eventAccent(event: CalendarEvent): string {
  const map = event.sourceType === 'inspection' ? INSPECTION_ACCENT : REPAIR_ACCENT;
  return map[event.colorKey] ?? 'bg-slate-500';
}

/** 실제 상태(status) 기준 뱃지 variant */
export function statusBadgeVariant(event: CalendarEvent): BadgeVariant {
  const map =
    event.sourceType === 'inspection' ? INSPECTION_BADGE : REPAIR_STATUS_BADGE;
  return map[event.status] ?? 'secondary';
}

/** 정비 우선순위 뱃지 variant */
export function priorityBadgeVariant(priority: string): BadgeVariant {
  return REPAIR_PRIORITY_BADGE[priority] ?? 'secondary';
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
