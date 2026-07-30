import type { CraneComponent } from '@crane/domain/asset';
import type { Tone } from '../../../shared/ui/tone';
import { usedLifePercent, lifeTone } from '../../../shared/lib/component-life';
import { parseLocalDate } from '../../../shared/lib/relative-date';

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;
/** 신규 설치 divide-by-near-zero 방지 하한 (년) */
const MIN_YEARS = 0.25;
/** 추이 샘플 상한 — 마모율이 극히 낮아도 차트가 무한히 길어지지 않게 */
const MAX_TREND_YEARS = 30;

export interface ClusterCondition {
  component: CraneComponent;
  usedPct: number;
  remainingPct: number;
  tone: Tone;
  /** 연평균 수명 소모율 (%/년) */
  annualWearPct: number;
  /** 올해 들어 소모된 수명 (%) — 연평균 × 연중 경과 비율 */
  periodWearPct: number;
  /** 현재 소모율 유지 시 수명 도달 예상 (YYYY-MM), 가동 이력 없으면 null */
  estimatedEol: string | null;
}

export function computeClusterCondition(c: CraneComponent, now: Date): ClusterCondition {
  const usedPct = usedLifePercent(c);
  const install = parseLocalDate(c.installDate);
  const yearsSince = Math.max((now.getTime() - install.getTime()) / MS_PER_YEAR, MIN_YEARS);

  const hoursPerYear = c.currentHours / yearsSince;
  const annualWearPct =
    c.expectedLifeHours > 0 ? (hoursPerYear / c.expectedLifeHours) * 100 : 0;

  const yearStart = new Date(now.getFullYear(), 0, 1);
  const yearElapsedFraction = Math.min(
    (now.getTime() - yearStart.getTime()) / MS_PER_YEAR,
    1,
  );
  const periodWearPct = annualWearPct * yearElapsedFraction;

  let estimatedEol: string | null = null;
  if (c.currentHours > 0 && hoursPerYear > 0 && c.expectedLifeHours > 0) {
    const totalLifeYears = c.expectedLifeHours / hoursPerYear;
    const eol = new Date(install.getTime() + totalLifeYears * MS_PER_YEAR);
    const p = (n: number) => String(n).padStart(2, '0');
    estimatedEol = `${eol.getFullYear()}-${p(eol.getMonth() + 1)}`;
  }

  return {
    component: c,
    usedPct,
    remainingPct: 100 - usedPct,
    tone: lifeTone(usedPct),
    annualWearPct: Math.round(annualWearPct * 10) / 10,
    periodWearPct: Math.round(periodWearPct * 10) / 10,
    estimatedEol,
  };
}

/** 설치 연도 → 예상 EOL 연도까지 잔여 수명 % 추이 (연 단위 샘플, 30년 캡) */
export function buildLifeTrend(cond: ClusterCondition): { year: number; remaining: number }[] {
  const install = parseLocalDate(cond.component.installDate);
  const installYear = install.getFullYear();
  const installYearFrac = installYear + install.getMonth() / 12;

  const wear = cond.annualWearPct;
  const spanYears =
    wear > 0 ? Math.min(Math.ceil(100 / wear) + 1, MAX_TREND_YEARS) : MAX_TREND_YEARS;

  const points: { year: number; remaining: number }[] = [];
  for (let i = 0; i <= spanYears; i += 1) {
    const year = installYear + i;
    const remaining = Math.max(0, Math.min(100, 100 - wear * (year - installYearFrac)));
    points.push({ year, remaining: Math.round(remaining * 10) / 10 });
    if (remaining <= 0) break;
  }
  return points;
}
