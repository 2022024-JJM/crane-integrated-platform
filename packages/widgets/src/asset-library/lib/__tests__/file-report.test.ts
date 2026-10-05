import { describe, expect, it } from 'vitest';
import { summarizeFileReport } from '../file-report';

const report = {
  assetId: 'a',
  version: 2,
  requested: true,
  optimized: true,
  lines: ['타일 4×4 + LOD', 'meshopt 적용'],
};

describe('summarizeFileReport', () => {
  it('보고가 없으면 알릴 것이 없다', () => {
    expect(summarizeFileReport(null)).toBeNull();
  });

  it('최적화를 요청하지 않았으면 알리지 않는다 — 줄이 있어도', () => {
    expect(
      summarizeFileReport({ ...report, requested: false, optimized: false }),
    ).toBeNull();
  });

  it('최적화해 저장했으면 optimized 와 파이프라인의 줄', () => {
    expect(summarizeFileReport(report)).toEqual({
      outcome: 'optimized',
      lines: ['타일 4×4 + LOD', 'meshopt 적용'],
    });
  });

  it('요청했는데 원본 그대로 저장했으면 skipped 와 그 이유', () => {
    expect(
      summarizeFileReport({
        ...report,
        optimized: false,
        lines: ['최적화 실패: boom'],
      }),
    ).toEqual({ outcome: 'skipped', lines: ['최적화 실패: boom'] });
  });

  it('빈 줄·공백뿐인 줄은 뺀다', () => {
    expect(
      summarizeFileReport({ ...report, lines: ['', '  ', 'meshopt 적용'] }),
    ).toEqual({ outcome: 'optimized', lines: ['meshopt 적용'] });
  });

  it('줄이 없어도 결과는 알린다', () => {
    expect(summarizeFileReport({ ...report, lines: [] })).toEqual({
      outcome: 'optimized',
      lines: [],
    });
  });
});
