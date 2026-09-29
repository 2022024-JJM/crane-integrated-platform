import { useEffect, useMemo, useState } from 'react';
import type { SavedSceneInfo } from '@crane/domain/3d';
import {
  collectModelStatusKeys,
  isSameLabelStateRecord,
  resolveLabelState,
  type LabelStateRecord,
  type ModelStatusKeys,
} from '../lib/model-label-state';
import {
  isSameRuntimeStatusRecord,
  scaleStatusWindows,
  type RuntimeStatusRecord,
} from '../lib/model-runtime-status';
import { tagLiveValues } from './tag-value-bus';

/** 상태 재판정 주기. 창(8s/20s)에 비해 충분히 촘촘하고 커밋은 초당 1회 이하. */
export const RUNTIME_STATUS_POLL_MS = 1_000;

export interface ModelStatusRecords {
  /** 운전 상태 — HUD·실행 리포트·저널. 라벨의 tone 과 같은 값이다. */
  runtime: RuntimeStatusRecord;
  /** 라벨 표시 상태 — 색과 아이콘. */
  labels: LabelStateRecord;
}

const EMPTY: ModelStatusRecords = Object.freeze({
  runtime: Object.freeze({}),
  labels: Object.freeze({}),
});

export interface UseModelRuntimeStatusesOptions {
  /**
   * 값 생산이 멈춰 있는 동안(3D 플레이 일시정지) true — 재판정을 건너뛰어
   * 마지막 기록을 유지한다. 벽시계 창으로 판정하면 정지 20초 뒤 전 장비가
   * 두절이 되어 버린다.
   */
  paused?: boolean;
  /** 재생 배속 — 창을 1/배속 으로 조정(scaleStatusWindows). 기본 1. */
  timeScale?: number;
}

/**
 * 씬 모델별 운전 상태·라벨 표시 상태 — 태그 값 버스의 live 캐시를 1초마다 읽어
 * 판정한다. 운전 상태는 라벨의 상자 색(tone) 그 자체다(lib/model-label-state.ts
 * `resolveLabelState`) — 따로 판정하면 HUD 의 가동 수와 녹색 라벨 수가
 * 어긋난다.
 *
 * 결과가 같으면 이전 참조를 그대로 돌려줘 리렌더가 없다(상태가 실제로 바뀌는
 * 순간에만 커밋, 두 기록 각각). 프레임 속도 값(tagLiveValues)을 React 상태로
 * 올리지 않는 규칙은 rig-live-readouts 와 같다.
 *
 * 맵핑이 없는 모델도 'unknown' 으로 기록에 들어간다 — 소비자가 "모델 수"와
 * "상태를 아는 수"를 함께 셀 수 있게(countRuntimeStatuses).
 */
export function useModelStatusRecords(
  sceneInfo: SavedSceneInfo | null,
  { paused = false, timeScale = 1 }: UseModelRuntimeStatusesOptions = {},
): ModelStatusRecords {
  const keysByModel = useMemo(() => {
    const map = new Map<string, ModelStatusKeys>();
    for (const model of sceneInfo?.models ?? []) {
      map.set(model.id, collectModelStatusKeys(model));
    }
    return map;
  }, [sceneInfo]);

  const [records, setRecords] = useState<ModelStatusRecords>(EMPTY);

  useEffect(() => {
    const windows = scaleStatusWindows(timeScale);
    const evaluate = () => {
      if (paused) return;
      const now = Date.now();
      const runtime: Record<string, RuntimeStatusRecord[string]> = {};
      const labels: Record<string, LabelStateRecord[string]> = {};
      for (const [modelId, keys] of keysByModel) {
        const state = resolveLabelState(
          keys,
          (key) => tagLiveValues.get(key),
          now,
          windows,
        );
        labels[modelId] = state;
        runtime[modelId] = state.tone;
      }
      setRecords((prev) => {
        const nextRuntime = isSameRuntimeStatusRecord(prev.runtime, runtime)
          ? prev.runtime
          : runtime;
        const nextLabels = isSameLabelStateRecord(prev.labels, labels)
          ? prev.labels
          : labels;
        return nextRuntime === prev.runtime && nextLabels === prev.labels
          ? prev
          : { runtime: nextRuntime, labels: nextLabels };
      });
    };
    evaluate();
    const timer = window.setInterval(evaluate, RUNTIME_STATUS_POLL_MS);
    return () => window.clearInterval(timer);
  }, [keysByModel, paused, timeScale]);

  return records;
}

/** 운전 상태만 — 라벨을 그리지 않는 소비자(3D 플레이 통계 기록기)용. */
export function useModelRuntimeStatuses(
  sceneInfo: SavedSceneInfo | null,
  options?: UseModelRuntimeStatusesOptions,
): RuntimeStatusRecord {
  return useModelStatusRecords(sceneInfo, options).runtime;
}
