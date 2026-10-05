import type { AssetFileReport } from '@crane/features/asset-library';

/**
 * 방금 올린 파일의 처리 결과를 알림 한 줄로. 번역은 호출부가 한다 — 여기서는
 * 어떤 문장을 쓸지와 덧붙일 줄만 고른다.
 *
 * 최적화를 요청하지 않았으면 알릴 것이 없다(null). 요청했는데 원본 그대로
 * 저장됐으면 `skipped` 다 — 등록은 됐고, 파이프라인이 적은 이유가 뒤따른다.
 */
export interface FileReportSummary {
  outcome: 'optimized' | 'skipped';
  /** 파이프라인이 고른 것·건너뛴 이유. */
  lines: string[];
}

export function summarizeFileReport(
  report: AssetFileReport | null,
): FileReportSummary | null {
  if (!report || !report.requested) return null;
  return {
    outcome: report.optimized ? 'optimized' : 'skipped',
    lines: report.lines.filter((line) => line.trim() !== ''),
  };
}
