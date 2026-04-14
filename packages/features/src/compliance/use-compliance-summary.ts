import { useTranslation } from 'react-i18next';
import {
  getAllCertifications,
  getAllOshaReports,
  getComplianceSummary,
} from '@crane/domain/compliance';
import type { OshaReport } from '@crane/domain/compliance';

function localizeReport(report: OshaReport, isKo: boolean): OshaReport {
  if (!isKo) return report;
  return {
    ...report,
    findings: report.findings_ko ?? report.findings,
  };
}

export function useComplianceSummary() {
  const { i18n } = useTranslation();
  const isKo = i18n.language === 'ko';
  const certifications = getAllCertifications();
  const oshaReports = getAllOshaReports().map((r) => localizeReport(r, isKo));
  const summary = getComplianceSummary();
  return { certifications, oshaReports, summary };
}
