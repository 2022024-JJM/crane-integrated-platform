import type { Certification, ComplianceSummary, OshaReport } from './types';

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

export function getAllCertifications(): Certification[] {
  return allCertifications;
}

export function getAllOshaReports(): OshaReport[] {
  return allOshaReports;
}

export function getComplianceSummary(): ComplianceSummary {
  const expiring = allCertifications.filter((c) => c.status === 'expiry_soon').length;
  const expired = allCertifications.filter((c) => c.status === 'expired').length;
  return {
    frequentCompletionRate: 75,
    periodicCompletionRate: 50,
    expiringCerts: expiring,
    expiredCerts: expired,
    openFindings: 2,
    reportsThisMonth: allOshaReports.filter((r) =>
      r.inspectionDate.startsWith('2026-07'),
    ).length,
  };
}
