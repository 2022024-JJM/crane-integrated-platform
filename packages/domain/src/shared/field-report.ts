/**
 * 현장 보고 표식 — 현장(모바일)에서 올라온 티켓이 든다. 관리자 접수함은
 * `triagedAt` 이 없는 것을 "접수(미배정)" 로 본다. 상태 enum 을 늘리지 않는
 * 이유: 세 종류(수리·점검·부품)의 상태 축을 건드리지 않고도 "현장에서 왔고
 * 아직 안 봤다" 를 표현할 수 있어서다.
 */
export interface FieldReport {
  reportedBy: string;
  /** ISO 시각. */
  reportedAt: string;
  triagedAt?: string;
  triagedBy?: string;
}

export function isUntriagedFieldReport(
  report: FieldReport | undefined,
): report is FieldReport {
  return report !== undefined && !report.triagedAt;
}

/** 접수 처리 표식 — 이미 처리된 것은 그대로. */
export function markTriaged(
  report: FieldReport,
  by: string,
  at: string = new Date().toISOString(),
): FieldReport {
  if (report.triagedAt) return report;
  return { ...report, triagedAt: at, triagedBy: by };
}
