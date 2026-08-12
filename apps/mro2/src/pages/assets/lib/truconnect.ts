import type { CraneComponent } from '@crane/domain/asset';
import type { InspectionWO } from '@crane/domain/inspection';
import type { RepairWO } from '@crane/domain/maintenance';

/**
 * TRUCONNECT 파생 데이터 (매뉴얼 16~20p) — 별도 원격계측 저장소가 없으므로
 * 컴포넌트 수명 데이터와 점검/수리 WO 이력에서 결정적으로(무작위 없이) 유도한다.
 */

/* ── 기간 선택 ──────────────────────────────────────────────────────── */

export type RangePreset = 'last30' | 'month' | 'year' | 'custom';

export interface DateRange {
  start: Date;
  end: Date;
}

export function presetRange(preset: Exclude<RangePreset, 'custom'>, now: Date): DateRange {
  if (preset === 'last30') {
    return { start: new Date(now.getTime() - 30 * 86400_000), end: now };
  }
  if (preset === 'month') {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
  }
  return { start: new Date(now.getFullYear(), 0, 1), end: now };
}

export function inRange(dateStr: string, range: DateRange): boolean {
  const t = new Date(dateStr).getTime();
  return t >= range.start.getTime() && t <= range.end.getTime();
}

/* ── 잔여수명 추정 (매뉴얼 18p) ─────────────────────────────────────── */

export interface LifePoint {
  year: number;
  pct: number;
}

export interface LifeProjection {
  /** 설치년도부터 예상 수명 종료년도까지의 연도별 잔여수명 % */
  points: LifePoint[];
  /** 잔여수명이 0에 도달할 것으로 추정되는 연도 (마모율 0이면 null) */
  estimatedEndYear: number | null;
  currentPct: number;
}

/** 현재까지의 평균 마모율을 직선 연장해 연도별 잔여수명을 추정한다 */
export function buildLifeProjection(c: CraneComponent, now: Date): LifeProjection {
  const installYear = new Date(c.installDate).getFullYear();
  const nowYear = now.getFullYear();
  const yearsInService = Math.max(nowYear - installYear, 1);
  const usedPct = c.expectedLifeHours > 0 ? (c.currentHours / c.expectedLifeHours) * 100 : 0;
  const currentPct = Math.max(0, Math.round(100 - usedPct));
  const wearPerYear = usedPct / yearsInService;

  const estimatedEndYear =
    wearPerYear > 0 ? installYear + Math.ceil(100 / wearPerYear) : null;
  // 차트 가독성을 위해 종료 추정이 없거나 아주 멀면 +12년까지만 그린다
  const lastYear = Math.min(estimatedEndYear ?? nowYear + 12, nowYear + 12);

  const points: LifePoint[] = [];
  for (let y = installYear; y <= lastYear; y += 1) {
    points.push({ year: y, pct: Math.max(0, Math.round(100 - wearPerYear * (y - installYear))) });
  }
  return { points, estimatedEndYear, currentPct };
}

/* ── 알림 파생 (매뉴얼 19p) ─────────────────────────────────────────── */

export type AlertKind = 'safety' | 'production';

export interface DerivedAlert {
  date: string;
  /** Pareto 원인 축 — 수리는 고장유형, 점검은 체크리스트 카테고리 */
  cause: string;
  kind: AlertKind;
}

/** 수리 고장유형 키 집합 — 점검 카테고리가 같은 의미면 한 원인으로 합치기 위한 기준 */
const FAILURE_TYPE_KEYS = new Set(['mechanical', 'electrical', 'structural', 'control', 'other']);

/** 점검 카테고리 원문("Electrical")과 수리 고장유형 키("electrical")를 같은 원인 축으로 정규화 */
export function normalizeCause(raw: string): string {
  const lower = raw.toLowerCase();
  return FAILURE_TYPE_KEYS.has(lower) ? lower : raw;
}

/**
 * WO 이력 → 알림 이벤트.
 * 수리: emergency 우선순위 또는 돌발(breakdown)이면 safety, 그외 production.
 * 점검: fail 항목의 critical/major 는 safety, minor 등은 production.
 */
export function deriveAlerts(
  inspections: InspectionWO[],
  repairs: RepairWO[],
): DerivedAlert[] {
  const alerts: DerivedAlert[] = [];
  for (const wo of repairs) {
    alerts.push({
      date: wo.actualStart ?? wo.scheduledStart,
      cause: normalizeCause(wo.failureType),
      kind: wo.priority === 'emergency' || wo.sourceType === 'breakdown' ? 'safety' : 'production',
    });
  }
  for (const wo of inspections) {
    const date = wo.actualDate ?? wo.scheduledDate;
    for (const item of wo.checklistItems) {
      if (item.judgment !== 'fail') continue;
      alerts.push({
        date,
        cause: normalizeCause(item.category),
        kind: item.severity === 'critical' || item.severity === 'major' ? 'safety' : 'production',
      });
    }
  }
  return alerts.sort((a, b) => a.date.localeCompare(b.date));
}

export interface ParetoEntry {
  cause: string;
  count: number;
  /** 이 항목까지의 누적 비중 (0~100) */
  cumPct: number;
}

/** 원인별 건수 내림차순 + 누적 % (Alert Pareto) */
export function alertPareto(alerts: DerivedAlert[]): ParetoEntry[] {
  const byCause = new Map<string, number>();
  for (const a of alerts) byCause.set(a.cause, (byCause.get(a.cause) ?? 0) + 1);
  const total = alerts.length || 1;
  let cum = 0;
  return [...byCause.entries()]
    .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
    .map(([cause, count]) => {
      cum += count;
      return { cause, count, cumPct: Math.round((cum / total) * 100) };
    });
}

export interface MonthBucket {
  /** 로컬 연-월 라벨용 */
  year: number;
  month: number;
  safety: number;
  production: number;
}

/** 기간 내 알림의 월별 safety/production 건수 — 빈 달도 채워 연속 축을 만든다 */
export function alertMonthlyTrend(alerts: DerivedAlert[], range: DateRange): MonthBucket[] {
  const buckets: MonthBucket[] = [];
  const cur = new Date(range.start.getFullYear(), range.start.getMonth(), 1);
  const last = new Date(range.end.getFullYear(), range.end.getMonth(), 1);
  while (cur.getTime() <= last.getTime()) {
    buckets.push({ year: cur.getFullYear(), month: cur.getMonth(), safety: 0, production: 0 });
    cur.setMonth(cur.getMonth() + 1);
  }
  for (const a of alerts) {
    const d = new Date(a.date);
    const b = buckets.find((x) => x.year === d.getFullYear() && x.month === d.getMonth());
    if (b) b[a.kind] += 1;
  }
  return buckets;
}

/* ── Load spectrum (매뉴얼 20p) ─────────────────────────────────────── */

export interface SpectrumBucket {
  /** '0-10' 처럼 정격 대비 부하 구간 (%) */
  label: string;
  pct: number;
}

/** 문자열 → 안정적 의사 난수 시드 (렌더마다 동일해야 하므로 Math.random 금지) */
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 0xffffffff;
}

/**
 * 정격 대비 부하 분포 추정 — 저부하 운전이 지배적인 산업 크레인의 전형 곡선
 * (지수 감쇠)을 크레인별 시드로 살짝 변형한 결정적 프로파일.
 * 실측 하중 데이터가 연결되면 이 함수만 교체하면 된다.
 */
export function loadSpectrum(craneId: string): SpectrumBucket[] {
  const seed = hashSeed(craneId);
  const decay = 0.45 + seed * 0.25; // 0.45~0.70 — 클수록 저부하 집중
  const raw: number[] = [];
  for (let i = 0; i < 11; i += 1) raw.push(Math.exp(-decay * i));
  const total = raw.reduce((s, v) => s + v, 0);
  return raw.map((v, i) => ({
    label: `${i * 10}-${(i + 1) * 10}`,
    pct: Math.round((v / total) * 1000) / 10,
  }));
}
