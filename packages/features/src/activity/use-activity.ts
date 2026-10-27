import {
  getActivities,
  getAllActivities,
  type Activity,
  type NoteRefKind,
} from '@crane/domain/shared';
import { useEntityTicks } from '../shared/use-domain-event-store';

/** 요청 하나의 기록 — 어떤 도메인 publish 든 기록이 따라 바뀌므로 전부 구독한다. */
export function useActivities(kind: NoteRefKind, refId: string): Activity[] {
  useEntityTicks(['repair', 'inspection', 'parts', 'notes']);
  return getActivities(kind, refId);
}

export function useAllActivities(): Activity[] {
  useEntityTicks(['repair', 'inspection', 'parts', 'notes']);
  return getAllActivities();
}
