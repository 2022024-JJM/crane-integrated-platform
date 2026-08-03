import { describe, expect, it } from 'vitest';
import type { Certification, OshaReport, UploadedDocument } from '@crane/domain/compliance';
import {
  buildDocumentRows,
  filterDocumentRows,
  formatSize,
  type DocumentFilter,
} from './document-rows';

const oshaReports = [
  {
    id: 'o1',
    reportNumber: 'OSHA-2026-001',
    craneName: '660T Goliath Crane',
    inspectionDate: '2026-05-10',
    inspectorName: '조범희',
    result: 'pass',
  } as OshaReport,
];

const certifications = [
  {
    id: 'c1',
    personName: '박순영',
    certNumber: 'NCCCO-11223',
    issuedDate: '2026-06-01',
    issuingBody: 'NCCCO',
    status: 'valid',
  } as Certification,
];

const uploads: UploadedDocument[] = [
  {
    id: 'u1',
    fileName: 'Manual-Rev3.pdf',
    docType: 'manual',
    craneId: 'crane-660t',
    craneName: '660T Goliath Crane',
    uploadedBy: '정종민',
    uploadedAt: '2026-07-02',
    sizeBytes: 8_412_000,
  },
];

const input = { oshaReports, certifications, uploads };

describe('buildDocumentRows', () => {
  it('세 소스를 하나의 목록으로 병합한다', () => {
    expect(buildDocumentRows(input)).toHaveLength(3);
  });

  it('최신순으로 정렬한다', () => {
    expect(buildDocumentRows(input).map((r) => r.date)).toEqual([
      '2026-07-02',
      '2026-06-01',
      '2026-05-10',
    ]);
  });

  it('소스별로 유형과 출처를 부여한다', () => {
    const rows = buildDocumentRows(input);
    expect(rows.find((r) => r.name === 'OSHA-2026-001')).toMatchObject({
      docType: 'inspection_report',
      origin: 'generated',
    });
    expect(rows.find((r) => r.name === 'Manual-Rev3.pdf')).toMatchObject({
      docType: 'manual',
      origin: 'uploaded',
    });
  });

  it('인증서는 이름과 번호를 함께 표기한다', () => {
    const cert = buildDocumentRows(input).find((r) => r.id === 'cert-c1');
    expect(cert?.name).toBe('박순영 — NCCCO-11223');
  });

  it('빈 입력은 빈 목록', () => {
    expect(buildDocumentRows({ oshaReports: [], certifications: [], uploads: [] })).toEqual([]);
  });
});

describe('filterDocumentRows', () => {
  const rows = buildDocumentRows(input);
  const filter = (over: Partial<DocumentFilter> = {}): DocumentFilter => ({
    types: new Set(),
    query: '',
    ...over,
  });

  it('유형 미선택이면 전부 통과', () => {
    expect(filterDocumentRows(rows, filter())).toHaveLength(3);
  });

  it('선택한 유형만 남긴다', () => {
    const out = filterDocumentRows(rows, filter({ types: new Set(['manual'] as const) }));
    expect(out.map((r) => r.name)).toEqual(['Manual-Rev3.pdf']);
  });

  it('문서명으로 검색한다', () => {
    expect(filterDocumentRows(rows, filter({ query: 'osha' }))).toHaveLength(1);
  });

  it('자산명으로도 검색된다', () => {
    const out = filterDocumentRows(rows, filter({ query: 'goliath' }));
    expect(out).toHaveLength(2);
  });

  it('일치하지 않으면 빈 목록', () => {
    expect(filterDocumentRows(rows, filter({ query: 'zzz' }))).toHaveLength(0);
  });
});

describe('formatSize', () => {
  it('단위를 상황에 맞게 고른다', () => {
    expect(formatSize(512)).toBe('512 B');
    expect(formatSize(2048)).toBe('2 KB');
    expect(formatSize(8_412_000)).toBe('8.0 MB');
  });

  it('없거나 0이면 빈 문자열', () => {
    expect(formatSize(undefined)).toBe('');
    expect(formatSize(0)).toBe('');
  });
});
