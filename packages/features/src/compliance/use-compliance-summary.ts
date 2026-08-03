import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getAllCertifications,
  getAllOshaReports,
  getComplianceSummary,
  requestCertRenewal,
  cancelCertRenewal,
} from '@crane/domain/compliance';
import type { OshaReport } from '@crane/domain/compliance';
import { useDomainEventStore, useEntityTick } from '../shared/use-domain-event-store';

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
  // 갱신 요청 등 컴플라이언스 mutation 후 리렌더되도록 tick 구독
  useEntityTick('compliance');
  const certifications = getAllCertifications();
  const oshaReports = getAllOshaReports().map((r) => localizeReport(r, isKo));
  const summary = getComplianceSummary();
  return { certifications, oshaReports, summary };
}

/**
 * 인증서 갱신 요청 — 상태를 'renewing'으로 전환하고 tick을 발행한다.
 * 성공 시 되돌리는 undo 클로저를, 이미 요청됐거나 없으면 null을 반환한다.
 */
export function useRequestCertRenewal(): (id: string) => (() => void) | null {
  const publish = useDomainEventStore((s) => s.publish);
  return useCallback(
    (id: string) => {
      if (!requestCertRenewal(id)) return null;
      publish('compliance');
      return () => {
        cancelCertRenewal(id);
        publish('compliance');
      };
    },
    [publish],
  );
}
