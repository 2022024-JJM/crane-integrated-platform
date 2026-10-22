import { useMemo } from 'react';
import type { SavedModelInfo, SavedSceneInfo } from '@crane/domain/3d';
import type { Alarm } from '@crane/domain/alarm';
import {
  buildHudConditions,
  type HudConditionSummary,
} from '../lib/hud-conditions';
import type { ModelStatusRecords } from './use-model-runtime-statuses';
import {
  useSceneCollisionStore,
  type SceneCollisionRecord,
} from './use-scene-collision-store';
import { useSceneZoneStore } from './use-scene-zone-store';

const EMPTY_MODELS: readonly SavedModelInfo[] = Object.freeze([]);
const EMPTY_ALARMS: readonly Alarm[] = Object.freeze([]);

/**
 * 관제 HUD 의 이상 조건 — `Monitoring3dView` 가 한 번 부르고 HUD(요약·펼침
 * 목록)와 위험 비네트가 같은 결과를 읽는다. 합성 규칙은 lib/hud-conditions.ts.
 *
 * 알람은 페이지가 넘긴 region 활성 알람이다(features/alarm 은 같은 레이어라
 * 여기서 읽지 않는다). 영역 침범·정지, 활성 충돌 기록은 각 스토어를 구독하고
 * 운전 상태·라벨·전이 시각은 뷰가 한 번 판정한 기록을 받는다. 입력 참조가
 * 그대로면 결과 참조도 그대로다.
 */
export function useHudConditions(
  sceneInfo: SavedSceneInfo | null,
  records: ModelStatusRecords,
  alarms: readonly Alarm[] = EMPTY_ALARMS,
): HudConditionSummary {
  const intrusions = useSceneZoneStore((s) => s.intrusions);
  const held = useSceneZoneStore((s) => s.held);
  const collision = useSceneCollisionStore(selectActiveCollision);
  const models = sceneInfo?.models ?? EMPTY_MODELS;
  const { runtime, labels, since } = records;
  return useMemo(
    () =>
      buildHudConditions({
        models,
        runtime,
        labels,
        since,
        alarms,
        intrusions,
        held,
        collision,
      }),
    [models, runtime, labels, since, alarms, intrusions, held, collision],
  );
}

/** 빨간 박스가 걸린(pinned·flash) 충돌 기록 — 기록 객체 참조라 안정적이다. */
function selectActiveCollision(state: {
  activeMode: unknown;
  activeRecordId: number | null;
  history: SceneCollisionRecord[];
}): SceneCollisionRecord | null {
  if (state.activeMode === null || state.activeRecordId === null) return null;
  return state.history.find((r) => r.id === state.activeRecordId) ?? null;
}
