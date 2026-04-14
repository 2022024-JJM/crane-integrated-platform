import { useTranslation } from 'react-i18next';
import {
  getAllInspectionWOs,
  getInspectionSummary,
  getInspectionWOById,
} from '@crane/domain/inspection';
import type { InspectionWO, ChecklistItem } from '@crane/domain/inspection';

function localizeChecklist(items: ChecklistItem[], isKo: boolean): ChecklistItem[] {
  if (!isKo) return items;
  return items.map((item) => ({
    ...item,
    category: item.category_ko ?? item.category,
    itemName: item.itemName_ko ?? item.itemName,
  }));
}

function localizeInspection(wo: InspectionWO, isKo: boolean): InspectionWO {
  if (!isKo) return wo;
  return {
    ...wo,
    findings: wo.findings_ko ?? wo.findings,
    checklistItems: localizeChecklist(wo.checklistItems, isKo),
  };
}

export function useInspectionList() {
  const { i18n } = useTranslation();
  const isKo = i18n.language === 'ko';
  const inspections = getAllInspectionWOs().map((w) => localizeInspection(w, isKo));
  const summary = getInspectionSummary();
  return { inspections, summary };
}

export function useInspectionDetail(id: string) {
  const { i18n } = useTranslation();
  const isKo = i18n.language === 'ko';
  const raw = getInspectionWOById(id);
  const inspection = raw ? localizeInspection(raw, isKo) : undefined;
  return { inspection };
}
