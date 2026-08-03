export type {
  CertStatus,
  CertType,
  Certification,
  ComplianceSummary,
  DocumentType,
  OshaReport,
  UploadedDocument,
} from './model/types';
export {
  getAllCertifications,
  getAllOshaReports,
  getAllUploadedDocuments,
  addUploadedDocument,
  getComplianceSummary,
  requestCertRenewal,
  cancelCertRenewal,
} from './model/mock-data';
