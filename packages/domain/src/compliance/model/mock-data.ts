import { getAllInspectionWOs } from '../../inspection/model/mock-data';
import type {
  Certification,
  ComplianceSummary,
  OshaReport,
  UploadedDocument,
} from './types';

const allCertifications: Certification[] = [
  {
    id: 'cert-001',
    personName: '조범희',
    role: 'Inspector',
    certType: 'nccco_inspector',
    certNumber: 'NCCCO-INS-2021-00412',
    issuedDate: '2021-06-15',
    expiryDate: '2026-06-15',
    issuingBody: 'NCCCO',
    status: 'expiry_soon',
  },
  {
    id: 'cert-002',
    personName: '조범희',
    role: 'Inspector',
    certType: 'osha_30',
    certNumber: 'OSHA30-2022-JS-881',
    issuedDate: '2022-03-10',
    expiryDate: '2027-03-10',
    issuingBody: 'OSHA',
    status: 'valid',
  },
  {
    id: 'cert-003',
    personName: '정종민',
    role: 'Inspector',
    certType: 'nccco_inspector',
    certNumber: 'NCCCO-INS-2022-00789',
    issuedDate: '2022-09-20',
    expiryDate: '2027-09-20',
    issuingBody: 'NCCCO',
    status: 'valid',
  },
  {
    id: 'cert-004',
    personName: '박순영',
    role: 'Technician',
    certType: 'nccco_rigger',
    certNumber: 'NCCCO-RIG-2020-01234',
    issuedDate: '2020-04-05',
    expiryDate: '2026-04-05',
    issuingBody: 'NCCCO',
    status: 'expiry_soon',
  },
  {
    id: 'cert-005',
    personName: '이태훈',
    role: 'Technician',
    certType: 'electrical_license',
    certNumber: 'EL-LA-2019-55231',
    issuedDate: '2019-11-01',
    expiryDate: '2025-11-01',
    issuingBody: 'State of Louisiana',
    status: 'expired',
  },
  {
    id: 'cert-006',
    personName: '박준상',
    role: 'Technician',
    certType: 'nccco_rigger',
    certNumber: 'NCCCO-RIG-2023-02541',
    issuedDate: '2023-07-14',
    expiryDate: '2028-07-14',
    issuingBody: 'NCCCO',
    status: 'valid',
  },
  {
    id: 'cert-007',
    personName: '박준상',
    role: 'Technician',
    certType: 'first_aid',
    certNumber: 'FA-ARC-2025-TP-001',
    issuedDate: '2025-01-20',
    expiryDate: '2027-01-20',
    issuingBody: 'American Red Cross',
    status: 'valid',
  },
  {
    id: 'cert-008',
    personName: '이태훈',
    role: 'Technician',
    certType: 'nccco_rigger',
    certNumber: 'NCCCO-RIG-2024-03102',
    issuedDate: '2024-02-28',
    expiryDate: '2029-02-28',
    issuingBody: 'NCCCO',
    status: 'valid',
  },
];

const allOshaReports: OshaReport[] = [
  {
    id: 'osha-001',
    reportNumber: 'OSHA-RPT-2026-0031',
    craneId: 'crane-660t',
    craneName: '660T Goliath Crane',
    siteId: 'dock-1',
    siteName: 'Dock No.1',
    inspectionWoId: 'insp-001',
    inspectionWoNumber: 'INS-2026-0001',
    inspectionType: 'frequent',
    inspectionDate: '2026-07-01',
    inspectorName: '조범희',
    result: 'pass',
    findings:
      'Hoist DCM cooling fan abnormal noise detected. Repair WO RPR-2026-0001 issued.',
    findings_ko:
      '권상 DCM 냉각팬 이상음 발견. 수리 작업지시서 RPR-2026-0001 발행.',
    generatedAt: '2026-07-01T15:30:00',
  },
  {
    id: 'osha-002',
    reportNumber: 'OSHA-RPT-2026-0030',
    craneId: 'crane-50t',
    craneName: '50T East Luffing Crane',
    siteId: 'dock-2',
    siteName: 'Dock No.2',
    inspectionWoId: 'insp-004',
    inspectionWoNumber: 'INS-2026-0004',
    inspectionType: 'frequent',
    inspectionDate: '2026-06-25',
    inspectorName: '박순영',
    result: 'pass',
    findings: 'All items within acceptable parameters.',
    findings_ko: '전 항목 허용 기준 이내.',
    generatedAt: '2026-06-25T16:00:00',
  },
  {
    id: 'osha-003',
    reportNumber: 'OSHA-RPT-2026-0028',
    craneId: 'crane-660t',
    craneName: '660T Goliath Crane',
    siteId: 'dock-1',
    siteName: 'Dock No.1',
    inspectionWoId: 'insp-005',
    inspectionWoNumber: 'INS-2026-0005',
    inspectionType: 'frequent',
    inspectionDate: '2026-05-28',
    inspectorName: '이태훈',
    result: 'pass',
    findings: 'Normal condition. Panel filter contamination noted — monitor.',
    findings_ko: '정상 상태. 판넬 필터 오염 확인 — 관찰 필요.',
    generatedAt: '2026-05-28T17:00:00',
  },
];

/** 만료 임박 판정 기준 일수 */
const EXPIRY_SOON_DAYS = 30;

// 상태를 만료일에서 파생 — 하드코딩 상태는 시간이 지나면 거짓이 된다
// (만료일이 지난 인증서가 '임박'으로 남는 것을 방지). renewing은 명시 상태 유지.
function deriveCertStatus(cert: Certification): Certification['status'] {
  if (cert.status === 'renewing') return 'renewing';
  const [y, m, d] = cert.expiryDate.split('-').map(Number);
  const expiry = new Date(y as number, (m as number) - 1, d as number);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((expiry.getTime() - today.getTime()) / 86_400_000);
  if (diffDays < 0) return 'expired';
  if (diffDays <= EXPIRY_SOON_DAYS) return 'expiry_soon';
  return 'valid';
}

// 갱신 요청된 인증서 id — 세션 내 저장. 요청되면 파생 상태 대신 'renewing'으로 노출한다
// (만료/임박 알림에서 빠지고 "갱신 중"으로 보여 이미 처리 착수했음을 나타냄)
const renewalRequestedIds = new Set<string>();

export function getAllCertifications(): Certification[] {
  return allCertifications.map((c) => ({
    ...c,
    status: renewalRequestedIds.has(c.id) ? 'renewing' : deriveCertStatus(c),
  }));
}

/** 인증서 갱신 요청 — 상태를 'renewing'으로 전환. 이미 요청됐으면 false */
export function requestCertRenewal(id: string): boolean {
  if (renewalRequestedIds.has(id)) return false;
  if (!allCertifications.some((c) => c.id === id)) return false;
  renewalRequestedIds.add(id);
  return true;
}

/** 갱신 요청 취소 (Undo용) */
export function cancelCertRenewal(id: string): void {
  renewalRequestedIds.delete(id);
}

export function getAllOshaReports(): OshaReport[] {
  return allOshaReports;
}

/* ── 업로드 문서 (세션 내 메모리) ─────────────────────────────────────
 * 매뉴얼 12p: 자동 생성 보고서 외에 고객이 직접 올린 파일도 함께 보관한다.
 * 파일 바이트는 저장하지 않고 메타데이터만 유지한다. */
const uploadedDocuments: UploadedDocument[] = [
  {
    id: 'doc-001',
    fileName: 'HPSI-660T-Operation-Manual-Rev3.pdf',
    docType: 'manual',
    craneId: 'crane-660t',
    craneName: '660T Goliath Crane',
    uploadedBy: '조범희',
    uploadedAt: '2026-02-11',
    sizeBytes: 8_412_000,
  },
  {
    id: 'doc-002',
    fileName: 'Dock4-Crane-Layout-Drawing.dwg',
    docType: 'drawing',
    uploadedBy: '정종민',
    uploadedAt: '2026-01-23',
    sizeBytes: 2_140_000,
  },
  {
    id: 'doc-003',
    fileName: 'HPSI-Maintenance-Agreement-2026.pdf',
    docType: 'contract',
    uploadedBy: '박순영',
    uploadedAt: '2026-01-05',
    sizeBytes: 645_000,
  },
];

export function getAllUploadedDocuments(): UploadedDocument[] {
  return uploadedDocuments;
}

export function addUploadedDocument(doc: UploadedDocument): void {
  uploadedDocuments.unshift(doc);
}

export function getComplianceSummary(): ComplianceSummary {
  // 파생 상태 기준으로 집계 — 하드코딩 상태와 어긋나지 않게 getAllCertifications를 경유한다
  const certs = getAllCertifications();
  const expiring = certs.filter((c) => c.status === 'expiry_soon').length;
  const expired = certs.filter((c) => c.status === 'expired').length;

  // 완료율은 점검 WO에서 파생 — 점검 페이지와 같은 소스를 써서 두 화면의 숫자가 어긋나지 않게 한다
  const inspections = getAllInspectionWOs();
  const rateFor = (woType: 'frequent' | 'periodic') => {
    const ofType = inspections.filter((w) => w.woType === woType);
    if (ofType.length === 0) return 0;
    const completed = ofType.filter((w) => w.status === 'completed').length;
    return Math.round((completed / ofType.length) * 100);
  };

  const now = new Date();
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  return {
    frequentCompletionRate: rateFor('frequent'),
    periodicCompletionRate: rateFor('periodic'),
    expiringCerts: expiring,
    expiredCerts: expired,
    // 합격이 아닌 보고서(불합격·조건부)가 미결 소견이다
    openFindings: allOshaReports.filter((r) => r.result !== 'pass').length,
    reportsThisMonth: allOshaReports.filter((r) =>
      r.inspectionDate.startsWith(monthPrefix),
    ).length,
  };
}
