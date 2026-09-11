import { useEffect, useMemo } from 'react';
import {
  computeSunDayEvents,
  getSceneSiteGeo,
  type SceneSiteGeo,
  type SunDayEvents,
} from '@crane/domain/3d';
import { parseReplayTimestamp } from '@crane/domain/monitoring';
import {
  getZonedTimeParts,
  startOfZonedDay,
  type ZonedTimeParts,
} from '@crane/core/lib/time-zone';
import { SCENE_LIGHTING_BASE } from '../lib/sky-lighting';
import {
  resolveSolarLighting,
  type SolarLightingSnapshot,
} from '../lib/solar-lighting';
import type { SceneTimeSource } from './scene-time-source';
import { useReplayPlayerStore } from './use-replay-player-store';
import { useSceneClockStore } from './use-scene-clock-store';

/** live 모드에서 UI 표시 시각을 갱신하는 주기. 태양은 이 사이 0.08° 움직인다. */
export const SCENE_SUN_UI_TICK_MS = 20_000;

export interface SceneSunUiState {
  geo: SceneSiteGeo;
  /** 표시 기준 시각(UTC epoch ms). */
  timeMs: number;
  /** 현장 벽시계 구성요소. */
  parts: ZonedTimeParts | null;
  snapshot: SolarLightingSnapshot;
  /** 그 현장 날짜의 일출·일몰·남중. */
  events: SunDayEvents | null;
  /** 시각이 어디서 오는지 — 'replay' 는 리플레이 프레임, 나머지는 씬 시계. */
  timeOrigin: 'live' | 'manual' | 'replay';
}

/**
 * UI(독 팝업·에디터 배경 탭)가 보는 태양 상태. 매 프레임 조명이 쓰는
 * 값과 같은 함수(resolveSolarLighting)를 쓰되, 갱신은 React 상태 기준이다
 * — live 는 SCENE_SUN_UI_TICK_MS 마다, manual 은 값이 바뀔 때, replay 는
 * 프레임이 바뀔 때. 현장 위치가 없는 region 은 null.
 */
export function useSceneSunState(
  regionId: string,
  source: SceneTimeSource = 'clock',
): SceneSunUiState | null {
  const geo = getSceneSiteGeo(regionId);
  const mode = useSceneClockStore((s) => s.mode);
  const manualTimeMs = useSceneClockStore((s) => s.manualTimeMs);
  const liveNowMs = useSceneClockStore((s) => s.liveNowMs);
  const yardLights = useSceneClockStore((s) => s.yardLights);
  const tickLive = useSceneClockStore((s) => s.tickLive);
  const replayTimestamp = useReplayPlayerStore((s) =>
    source === 'replay' ? (s.frames[s.frameIndex]?.timestamp ?? null) : null,
  );

  // live 시계 갱신 — 스토어 액션 호출이라 렌더 상태를 effect 에서 직접
  // 바꾸지 않는다. 마운트 즉시 한 번 맞추고 주기적으로 잇는다.
  useEffect(() => {
    if (mode !== 'live' || !geo) return;
    tickLive();
    const handle = window.setInterval(tickLive, SCENE_SUN_UI_TICK_MS);
    return () => window.clearInterval(handle);
  }, [mode, geo, tickLive]);

  return useMemo(() => {
    if (!geo) return null;
    const replayMs =
      replayTimestamp !== null
        ? parseReplayTimestamp(replayTimestamp, geo.timeZone)
        : null;
    const timeOrigin: SceneSunUiState['timeOrigin'] =
      replayMs !== null ? 'replay' : mode;
    const timeMs = replayMs ?? (mode === 'manual' ? manualTimeMs : liveNowMs);
    const snapshot = resolveSolarLighting(timeMs, geo, SCENE_LIGHTING_BASE, {
      yardLights,
    });
    if (!snapshot) return null;
    const dayStart = startOfZonedDay(timeMs, geo.timeZone);
    return {
      geo,
      timeMs,
      parts: getZonedTimeParts(timeMs, geo.timeZone),
      snapshot,
      events: computeSunDayEvents(dayStart, geo.latitude, geo.longitude),
      timeOrigin,
    };
  }, [geo, mode, manualTimeMs, liveNowMs, replayTimestamp, yardLights]);
}
