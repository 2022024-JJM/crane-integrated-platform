export type CertType =
  | 'nccco_inspector'
  | 'nccco_rigger'
  | 'electrical_license'
  | 'contractor_license'
  | 'osha_30'
  | 'first_aid';

export type CertStatus = 'valid' | 'expiry_soon' | 'expired' | 'renewing';

export interface Certification {
  id: string;
  personName: string;
  role: string;
  certType: CertType;
  certNumber: string;
  issuedDate: string;
  expiryDate: string;
  issuingBody: string;
  status: CertStatus;
  documentUrl?: string;
}

export interface OshaReport {
  id: string;
  reportNumber: string;
  craneId: string;
  craneName: string;
  siteId: string;
  siteName: string;
  inspectionWoId: string;
  inspectionWoNumber: string;
  inspectionType: 'frequent' | 'periodic';
  inspectionDate: string;
  inspectorName: string;
  result: 'pass' | 'fail' | 'conditional';
  findings: string;
  findings_ko?: string;
  generatedAt: string;
}

/** 문서 보관함 분류 — 자동 생성물(점검 보고서·인증서)과 사용자 업로드를 함께 다룬다 */
export type DocumentType =
  | 'inspection_report'
  | 'certificate'
  | 'manual'
  | 'drawing'
  | 'contract'
  | 'other';

/**
 * 사용자가 업로드한 문서 — 메타데이터 + 세션 한정 blob URL.
 * (백엔드 저장소가 없으므로 파일 바이트는 브라우저 세션 안에서만 유지된다)
 */
export interface UploadedDocument {
  id: string;
  fileName: string;
  docType: DocumentType;
  craneId?: string;
  craneName?: string;
  uploadedBy: string;
  uploadedAt: string;
  sizeBytes: number;
  /** 세션 내 실파일 다운로드용 object URL — 새로고침하면 소실된다 */
  objectUrl?: string;
  /** 서비스 요청 첨부로 올린 경우 해당 WO 번호 */
  refWoNumber?: string;
}

export interface ComplianceSummary {
  frequentCompletionRate: number;
  periodicCompletionRate: number;
  expiringCerts: number;
  expiredCerts: number;
  openFindings: number;
  reportsThisMonth: number;
}
