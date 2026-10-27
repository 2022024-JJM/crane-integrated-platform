/** 자산 카드의 "점검" 타일 — 다음 예정 점검이 지났으면 지연 D+N, 아니면 D-N. */
export type InspectionDue =
  | { kind: 'overdue'; days: number }
  | { kind: 'due'; days: number }
  | { kind: 'none' };

const DAY_MS = 86_400_000;

export function inspectionDue(
  next: string | undefined,
  now: number,
): InspectionDue {
  if (!next) return { kind: 'none' };
  const t = new Date(next).getTime();
  if (Number.isNaN(t)) return { kind: 'none' };
  const diff = Math.floor((t - startOfDay(now)) / DAY_MS);
  return diff < 0
    ? { kind: 'overdue', days: -diff }
    : { kind: 'due', days: diff };
}

function startOfDay(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
