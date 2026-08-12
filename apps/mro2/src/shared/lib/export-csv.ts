/**
 * CSV 내보내기 — 매뉴얼 5p "Asset Reports → Excel 파일 생성"에 대응.
 * Excel이 CSV를 그대로 열기 때문에 외부 의존성 없이 요구사항을 만족한다.
 */

export type CsvValue = string | number | null | undefined;

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => CsvValue;
}

/** RFC 4180 이스케이프 — 쉼표·따옴표·줄바꿈이 있으면 따옴표로 감싸고 내부 따옴표는 중복 */
function escapeCell(v: CsvValue): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const head = columns.map((c) => escapeCell(c.header)).join(',');
  const body = rows.map((row) => columns.map((c) => escapeCell(c.value(row))).join(','));
  return [head, ...body].join('\r\n');
}

/**
 * 브라우저 다운로드 트리거.
 * Excel이 UTF-8을 올바로 인식하도록 BOM을 붙인다 (한글 파트명이 깨지지 않게).
 */
export function downloadCsv(filename: string, csv: string): void {
  if (typeof window === 'undefined') return;
  // U+FEFF(BOM) — 리터럴로 두면 보이지 않아 편집 중 유실되기 쉬우므로 이스케이프로 명시한다.
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
