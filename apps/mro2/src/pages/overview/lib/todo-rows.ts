import type { OpenRisk } from '@crane/features/risk';

/** 개요 상단 "할 일" — 열린 리스크 중 안전 › 심각도 › 오래된 순 상위 N 건. */
export interface TodoRow {
  id: string;
  title: string;
  assetName: string;
  source: OpenRisk['source'];
  riskType: OpenRisk['riskType'];
  severity: OpenRisk['severity'];
  /** 식별된 뒤 지난 일수(음수 없음) */
  daysOpen: number;
  detailPath: string;
}

export const TODO_LIMIT = 5;
const DAY_MS = 86_400_000;
const SEVERITY_RANK = { critical: 0, major: 1, minor: 2 } as const;

export function buildTodoRows(
  risks: readonly OpenRisk[],
  now: number,
  isKo: boolean,
  limit: number = TODO_LIMIT,
  /** 점검 지연 리스크의 제목용 — 점검 id → "정기 점검 · INS-…" 라벨 */
  inspectionLabelById: Readonly<Record<string, string>> = {},
): TodoRow[] {
  return [...risks]
    .sort(
      (a, b) =>
        (a.riskType === 'safety' ? 0 : 1) - (b.riskType === 'safety' ? 0 : 1) ||
        SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
        time(a.date) - time(b.date),
    )
    .slice(0, Math.max(0, limit))
    .map((r) => ({
      id: r.id,
      title:
        (r.source === 'overdue_inspection' &&
          inspectionLabelById[r.id.replace(/^overdue-/, '')]) ||
        (isKo && r.title_ko) ||
        r.title,
      assetName: r.assetName ?? '',
      source: r.source,
      riskType: r.riskType,
      severity: r.severity,
      daysOpen: Math.max(0, Math.floor((now - time(r.date)) / DAY_MS)),
      detailPath: toMro2Path(r.detailPath),
    }));
}

/**
 * 리스크의 상세 경로는 MRO(philly) 주소다 — MRO2 의 같은 화면으로 바꾼다.
 * 모르는 형태는 서비스 요청 목록으로 보낸다(개요로 튕기는 것보다 낫다).
 */
export function toMro2Path(detailPath: string): string {
  let m = /^\/inspection\/([^/?#]+)/.exec(detailPath);
  if (m) return `/mro2/service-requests/inspection/${m[1]}`;
  m = /^\/maintenance\?wo=([^&#]+)/.exec(detailPath);
  if (m) return `/mro2/service-requests/repair/${m[1]}`;
  m = /^\/inventory\?part=([^&#]+)/.exec(detailPath);
  if (m) return `/mro2/inventory?part=${m[1]}`;
  if (detailPath.startsWith('/mro2/')) return detailPath;
  return '/mro2/service-requests';
}

function time(d: string): number {
  const t = new Date(d).getTime();
  return Number.isNaN(t) ? 0 : t;
}
