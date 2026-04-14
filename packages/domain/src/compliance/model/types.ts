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

export interface ComplianceSummary {
  frequentCompletionRate: number;
  periodicCompletionRate: number;
  expiringCerts: number;
  expiredCerts: number;
  openFindings: number;
  reportsThisMonth: number;
}
