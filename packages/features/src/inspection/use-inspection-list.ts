import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getAllInspectionWOs,
  getInspectionSummary,
  getInspectionWOById,
} from '@crane/domain/inspection';
import type { InspectionWO, ChecklistItem } from '@crane/domain/inspection';
import { useEntityTick } from '../shared/use-domain-event-store';

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
  const tick = useEntityTick('inspection');
  // localize는 새 객체를 만들므로 tick 단위로 memoize — 매 렌더 새 참조가 내려가면
  // 소비측 useMemo/useEffect가 계속 재실행된다
  const inspections = useMemo(
    () => getAllInspectionWOs().map((w) => localizeInspection(w, isKo)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isKo, tick],
  );
  const summary = getInspectionSummary();
  return { inspections, summary };
}

export function useInspectionDetail(id: string) {
  const { i18n } = useTranslation();
  const isKo = i18n.language === 'ko';
  const tick = useEntityTick('inspection');
  // 참조 안정화 — 상세 페이지의 편집 버퍼 동기화 effect가 [inspection]에 걸려 있어
  // 매 렌더 새 객체를 반환하면 클릭한 판정이 즉시 초기값으로 되돌아간다 (ko 체크리스트 무반응 버그)
  const inspection = useMemo(
    () => {
      const raw = getInspectionWOById(id);
      return raw ? localizeInspection(raw, isKo) : undefined;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, isKo, tick],
  );
  return { inspection };
}
