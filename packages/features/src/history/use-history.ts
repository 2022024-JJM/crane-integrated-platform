import { useTranslation } from 'react-i18next';
import { getAllCraneAssets } from '@crane/domain/asset';
import { useEntityTicks } from '../shared/use-domain-event-store';
import { buildHistoryEvents } from './build-history-events';
import type { HistoryEvent } from './build-history-events';

/** 자산 상세 History 탭용 — 크레인 한 대의 통합 이력 (최신순) */
export function useCraneHistory(craneId: string): HistoryEvent[] {
  const { i18n } = useTranslation();
  useEntityTicks(['repair', 'inspection', 'parts']);
  return buildHistoryEvents({ craneId, isKo: i18n.language === 'ko' });
}

/** /history 페이지용 — 전체 크레인 통합 이력 + 크레인 필터 옵션 */
export function useHistoryList(): {
  events: HistoryEvent[];
  craneOptions: { id: string; label: string }[];
} {
  const { i18n } = useTranslation();
  useEntityTicks(['repair', 'inspection', 'parts']);
  const events = buildHistoryEvents({ isKo: i18n.language === 'ko' });
  const craneOptions = getAllCraneAssets().map((a) => ({ id: a.id, label: a.name }));
  return { events, craneOptions };
}
