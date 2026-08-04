import type {
  Certification,
  DocumentType,
  OshaReport,
  UploadedDocument,
} from '@crane/domain/compliance';
import { downloadCsv, toCsv, type CsvColumn } from '../../../shared/lib/export-csv';

/**
 * 매뉴얼 12p Documents and reports — 점검 보고서·인증서·업로드 파일을
 * 하나의 필터 가능한 목록으로 병합한다. 라벨 번역은 호출부(i18n)가 맡는다.
 */
export const DOCUMENT_TYPES: DocumentType[] = [
  'inspection_report',
  'certificate',
  'manual',
  'drawing',
  'contract',
  'other',
];

export type DocumentOrigin = 'generated' | 'uploaded';

export interface DocumentRow {
  id: string;
  /** 목록에 보이는 이름 (보고서 번호·자격증명·파일명) */
  name: string;
  docType: DocumentType;
  origin: DocumentOrigin;
  /** 정렬·표시용 날짜 (YYYY-MM-DD) */
  date: string;
  /** 자산 상세 Documents 탭 필터용 */
  craneId?: string;
  assetName?: string;
  /** 발행자 또는 업로더 */
  by: string;
  /** 부가 정보 한 줄 (점검 결과, 만료일, 파일 크기 등) */
  detail: string;
  sizeBytes?: number;
  /** 세션 내 실파일 다운로드 URL (업로드 문서만) */
  objectUrl?: string;
}

function day(d: string | null | undefined): string {
  return d ? d.slice(0, 10) : '';
}

/** 바이트 → 사람이 읽는 크기. 목록/CSV 공용 */
export function formatSize(bytes: number | undefined): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export interface BuildDocumentRowsInput {
  oshaReports: OshaReport[];
  certifications: Certification[];
  uploads: UploadedDocument[];
}

export function buildDocumentRows(input: BuildDocumentRowsInput): DocumentRow[] {
  const rows: DocumentRow[] = [
    ...input.oshaReports.map((r) => ({
      id: `osha-${r.id}`,
      name: r.reportNumber,
      docType: 'inspection_report' as DocumentType,
      origin: 'generated' as DocumentOrigin,
      date: day(r.inspectionDate),
      craneId: r.craneId,
      assetName: r.craneName,
      by: r.inspectorName,
      detail: r.result,
    })),
    ...input.certifications.map((c) => ({
      id: `cert-${c.id}`,
      name: `${c.personName} — ${c.certNumber}`,
      docType: 'certificate' as DocumentType,
      origin: 'generated' as DocumentOrigin,
      date: day(c.issuedDate),
      by: c.issuingBody,
      detail: c.status,
    })),
    ...input.uploads.map((u) => ({
      id: `up-${u.id}`,
      name: u.fileName,
      docType: u.docType,
      origin: 'uploaded' as DocumentOrigin,
      date: day(u.uploadedAt),
      craneId: u.craneId,
      assetName: u.craneName,
      by: u.uploadedBy,
      detail: formatSize(u.sizeBytes),
      sizeBytes: u.sizeBytes,
      objectUrl: u.objectUrl,
    })),
  ];

  // 최신순 — 같은 날짜면 이름으로 안정 정렬
  return rows.sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
}

/** 문서 목록 CSV 컬럼 — 페이지 테이블과 같은 순서 (Generate Report / 메타데이터 폴백 공용) */
export const DOCUMENT_CSV_COLUMNS: CsvColumn<DocumentRow>[] = [
  { header: 'Document', value: (r) => r.name },
  { header: 'Type', value: (r) => r.docType },
  { header: 'Origin', value: (r) => r.origin },
  { header: 'Asset', value: (r) => r.assetName },
  { header: 'Date', value: (r) => r.date },
  { header: 'By', value: (r) => r.by },
  { header: 'Detail', value: (r) => r.detail },
];

/**
 * 문서 다운로드 — 세션 내 실파일(objectUrl)이 있으면 원본을, 없으면
 * (자동 생성 보고서 등) 메타데이터 CSV를 내려준다.
 */
export function downloadDocumentRow(row: DocumentRow): void {
  if (row.objectUrl) {
    const a = document.createElement('a');
    a.href = row.objectUrl;
    a.download = row.name;
    a.click();
    return;
  }
  downloadCsv(`${row.name.replace(/\.[^.]+$/, '')}.csv`, toCsv([row], DOCUMENT_CSV_COLUMNS));
}

export interface DocumentFilter {
  types: Set<DocumentType>;
  query: string;
}

export function filterDocumentRows(rows: DocumentRow[], filter: DocumentFilter): DocumentRow[] {
  const q = filter.query.trim().toLowerCase();
  return rows.filter((r) => {
    if (filter.types.size > 0 && !filter.types.has(r.docType)) return false;
    if (q && !r.name.toLowerCase().includes(q) && !(r.assetName ?? '').toLowerCase().includes(q)) {
      return false;
    }
    return true;
  });
}
