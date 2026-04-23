import type { CraneAsset, AssetStatus } from '@crane/domain/asset';
import type { RepairWO, RepairStatus, FailureType } from '@crane/domain/maintenance';

// ── Repair Pipeline ────────────────────────────────────────────

export interface RepairPipelineSlice {
  status: RepairStatus;
  count: number;
}

const PIPELINE_ORDER: RepairStatus[] = [
  'received',
  'waiting_parts',
  'in_progress',
  're_inspection',
  'on_hold',
];

export function aggregateRepairPipeline(repairs: RepairWO[]): RepairPipelineSlice[] {
  const counts = new Map<RepairStatus, number>();
  for (const r of repairs) {
    if (r.status === 'completed') continue;
    counts.set(r.status, (counts.get(r.status) ?? 0) + 1);
  }
  return PIPELINE_ORDER.filter((s) => (counts.get(s) ?? 0) > 0).map((status) => ({
    status,
    count: counts.get(status) ?? 0,
  }));
}

export function totalActiveRepairs(slices: RepairPipelineSlice[]): number {
  return slices.reduce((sum, s) => sum + s.count, 0);
}

// ── Site Load ──────────────────────────────────────────────────

export interface SiteLoadRow {
  siteId: string;
  siteKey: 'dock1' | 'dock2' | 'dockIn';
  operating: number;
  inspection: number;
  repair: number;
  idle: number;
  total: number;
}

const SITE_CONFIG: Array<{ siteId: string; siteKey: SiteLoadRow['siteKey'] }> = [
  { siteId: 'dock-1', siteKey: 'dock1' },
  { siteId: 'dock-2', siteKey: 'dock2' },
  { siteId: 'dock-in', siteKey: 'dockIn' },
];

export function aggregateSiteLoad(assets: CraneAsset[]): SiteLoadRow[] {
  return SITE_CONFIG.map(({ siteId, siteKey }) => {
    const siteAssets = assets.filter((a) => a.siteId === siteId);
    const countBy = (status: AssetStatus) =>
      siteAssets.filter((a) => a.status === status).length;
    return {
      siteId,
      siteKey,
      operating: countBy('operating'),
      inspection: countBy('inspection'),
      repair: countBy('repair'),
      idle: countBy('idle'),
      total: siteAssets.length,
    };
  });
}

// ── Repair Weekly Trend (ISO week) ─────────────────────────────

export interface WeeklyTrendRow {
  weekKey: string; // 'W14'
  fullKey: string; // '2026-W14'
  completed: number;
  emergency: number;
}

function isoWeekOf(date: Date): { year: number; week: number } {
  // ISO week: Thursday decides the year
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

function weekKeyOfDate(iso: string): { fullKey: string; shortKey: string } {
  const d = new Date(iso);
  const { year, week } = isoWeekOf(d);
  const ww = String(week).padStart(2, '0');
  return { fullKey: `${year}-W${ww}`, shortKey: `W${ww}` };
}

function shiftWeek(year: number, week: number, delta: number): { year: number; week: number } {
  // Approximate via Jan 4th (always in W1) + delta weeks
  const anchor = new Date(Date.UTC(year, 0, 4));
  anchor.setUTCDate(anchor.getUTCDate() + (week - 1) * 7 + delta * 7);
  return isoWeekOf(anchor);
}

export function aggregateRepairWeeklyTrend(
  repairs: RepairWO[],
  weeks = 8,
  now: Date = new Date(),
): WeeklyTrendRow[] {
  const { year: curYear, week: curWeek } = isoWeekOf(now);

  // Generate last N weeks (ending at current)
  const buckets: WeeklyTrendRow[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const { year, week } = shiftWeek(curYear, curWeek, -i);
    const ww = String(week).padStart(2, '0');
    buckets.push({
      weekKey: `W${ww}`,
      fullKey: `${year}-W${ww}`,
      completed: 0,
      emergency: 0,
    });
  }

  const lookup = new Map(buckets.map((b) => [b.fullKey, b]));

  for (const r of repairs) {
    if (r.status !== 'completed' || !r.actualEnd) continue;
    const { fullKey } = weekKeyOfDate(r.actualEnd);
    const bucket = lookup.get(fullKey);
    if (!bucket) continue;
    bucket.completed += 1;
    if (r.priority === 'emergency') bucket.emergency += 1;
  }

  return buckets;
}

// ── Failure Mix ────────────────────────────────────────────────

export interface FailureMixSlice {
  type: FailureType;
  count: number;
}

const FAILURE_ORDER: FailureType[] = ['mechanical', 'electrical', 'structural', 'control', 'other'];

export function aggregateFailureMix(repairs: RepairWO[]): FailureMixSlice[] {
  const counts = new Map<FailureType, number>();
  for (const r of repairs) {
    counts.set(r.failureType, (counts.get(r.failureType) ?? 0) + 1);
  }
  return FAILURE_ORDER.filter((t) => (counts.get(t) ?? 0) > 0).map((type) => ({
    type,
    count: counts.get(type) ?? 0,
  }));
}
