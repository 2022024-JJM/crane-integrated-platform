import type { RepairWO } from '@crane/domain/maintenance';
import type { InspectionWO } from '@crane/domain/inspection';
import { parseLocalDateTime } from '../../../shared/lib/relative-date';

// 날짜전용 문자열('YYYY-MM-DD')을 new Date()로 파싱하면 UTC 기준이 되어
// 월·주 경계일 완료건이 오귀속된다 — 로컬 파서로 통일.
function isSameMonth(iso: string | null | undefined, now: Date): boolean {
  if (!iso) return false;
  const d = parseLocalDateTime(iso);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function isWithinDays(iso: string | null | undefined, now: Date, days: number): boolean {
  if (!iso) return false;
  const t = parseLocalDateTime(iso).getTime();
  const cutoff = now.getTime() - days * 24 * 60 * 60 * 1000;
  return t >= cutoff && t <= now.getTime();
}

export interface MonthlyServiceMetrics {
  visits: number;
  assets: number;
  findings: number;
}

export function aggregateMonthlyServiceMetrics(
  repairs: RepairWO[],
  inspections: InspectionWO[],
  now: Date = new Date(),
): MonthlyServiceMetrics {
  const completedRepairs = repairs.filter(
    (r) => r.status === 'completed' && isSameMonth(r.actualEnd, now),
  );
  const completedInspections = inspections.filter(
    (i) => i.status === 'completed' && isSameMonth(i.actualDate, now),
  );

  const visits = completedRepairs.length + completedInspections.length;

  const assetIds = new Set<string>();
  completedRepairs.forEach((r) => assetIds.add(r.craneId));
  completedInspections.forEach((i) => assetIds.add(i.craneId));

  const findings = completedInspections.reduce((sum, i) => {
    const failed = i.checklistItems?.filter((c) => c.judgment === 'fail').length ?? 0;
    return sum + failed;
  }, 0);

  return {
    visits,
    assets: assetIds.size,
    findings,
  };
}

export interface InspectionPassFail {
  passed: number;
  failed: number;
  total: number;
}

export function aggregateInspectionPassFail(
  inspections: InspectionWO[],
  now: Date = new Date(),
  days = 1,
): InspectionPassFail {
  const recent = inspections.filter(
    (i) => i.status === 'completed' && isWithinDays(i.actualDate, now, days),
  );

  const passed = recent.filter((i) => i.result === 'pass').length;
  const failed = recent.filter((i) => i.result === 'fail').length;

  return { passed, failed, total: passed + failed };
}

export interface DailyPassFail {
  /** 로컬 'YYYY-MM-DD' */
  date: string;
  passed: number;
  failed: number;
}

/** 최근 N일 일자별 점검 결과 — 미니 바 차트용. 과거→오늘 순, 빈 날도 버킷을 유지한다. */
export function aggregateInspectionPassFailByDay(
  inspections: InspectionWO[],
  now: Date = new Date(),
  days = 7,
): DailyPassFail[] {
  const pad = (n: number) => String(n).padStart(2, '0');
  const buckets: DailyPassFail[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    buckets.push({
      date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      passed: 0,
      failed: 0,
    });
  }
  const byKey = new Map(buckets.map((b) => [b.date, b]));
  for (const wo of inspections) {
    if (wo.status !== 'completed' || !wo.actualDate) continue;
    const bucket = byKey.get(wo.actualDate.slice(0, 10));
    if (!bucket) continue;
    if (wo.result === 'pass') bucket.passed += 1;
    else if (wo.result === 'fail') bucket.failed += 1;
  }
  return buckets;
}

export function formatPeriodLabel(now: Date = new Date(), locale = 'en-US'): string {
  return now.toLocaleDateString(locale, { month: 'short', year: 'numeric' });
}
