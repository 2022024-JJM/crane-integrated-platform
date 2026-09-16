import { useEffect, useMemo, useState } from 'react';
import type { SavedSceneInfo } from '@crane/domain/3d';
import {
  collectModelTagKeys,
  isSameRuntimeStatusRecord,
  resolveRuntimeStatus,
  scaleStatusWindows,
  type RuntimeStatusRecord,
} from '../lib/model-runtime-status';
import { tagLiveValues } from './tag-value-bus';

/** 상태 재판정 주기. 창(8s/20s)에 비해 충분히 촘촘하고 커밋은 초당 1회 이하. */
export const RUNTIME_STATUS_POLL_MS = 1_000;

const EMPTY: RuntimeStatusRecord = Object.freeze({});

export interface UseModelRuntimeStatusesOptions {
  /**
   * 값 생산이 멈춰 있는 동안(플레이백 일시정지) true — 재판정을 건너뛰어
   * 마지막 기록을 유지한다. 벽시계 창으로 판정하면 정지 20초 뒤 전 장비가
   * 두절이 되어 버린다.
   */
  paused?: boolean;
  /** 재생 배속 — 창을 1/배속 으로 조정(scaleStatusWindows). 기본 1. */
  timeScale?: number;
}

/**
 * 씬 모델별 운전 상태 — 태그 값 버스의 live 캐시를 1초마다 읽어 판정한다.
 * 결과가 같으면 이전 참조를 그대로 돌려줘 리렌더가 없다(상태가 실제로
 * 바뀌는 순간에만 커밋). 프레임 속도 값(tagLiveValues)을 React 상태로
 * 올리지 않는 규칙은 rig-live-readouts 와 같다.
 *
 * 맵핑이 없는 모델도 'unknown' 으로 기록에 들어간다 — 소비자가 "모델 수"와
 * "상태를 아는 수"를 함께 셀 수 있게(countRuntimeStatuses).
 */
export function useModelRuntimeStatuses(
  sceneInfo: SavedSceneInfo | null,
  { paused = false, timeScale = 1 }: UseModelRuntimeStatusesOptions = {},
): RuntimeStatusRecord {
  const keysByModel = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const model of sceneInfo?.models ?? []) {
      map.set(model.id, collectModelTagKeys(model));
    }
    return map;
  }, [sceneInfo]);

  const [record, setRecord] = useState<RuntimeStatusRecord>(EMPTY);

  useEffect(() => {
    const windows = scaleStatusWindows(timeScale);
    const evaluate = () => {
      if (paused) return;
      const now = Date.now();
      const next: Record<string, RuntimeStatusRecord[string]> = {};
      for (const [modelId, keys] of keysByModel) {
        next[modelId] = resolveRuntimeStatus(
          keys,
          (key) => tagLiveValues.get(key),
          now,
          windows,
        );
      }
      setRecord((prev) =>
        isSameRuntimeStatusRecord(prev, next) ? prev : next,
      );
    };
    evaluate();
    const timer = window.setInterval(evaluate, RUNTIME_STATUS_POLL_MS);
    return () => window.clearInterval(timer);
  }, [keysByModel, paused, timeScale]);

  return record;
}
