import { useEffect, useState } from 'react';
import {
  nearestZone,
  trackSeverity,
  useCollisionGuardStore,
  type CollisionGuardZone,
  type DetectedObjectType,
  type TrackSeverity,
} from './use-collision-guard-store';

/**
 * DOM HUD용 저주파 파생 상태.
 *
 * 트랙 위치는 의도적으로 in-place mutate라 zustand 셀렉터로는 변화가
 * 보이지 않는다(리렌더 0회 아키텍처). 대신 낮은 Hz로 getState()를 폴링해
 * 반올림된 파생값을 만들고, 구조 동등성 가드로 값이 실제로 변한 tick에만
 * setState한다 — HUD 패널 리렌더는 최악에도 hz회/초.
 */

export interface HudTrack {
  id: string;
  type: DetectedObjectType;
  /** 가장 가까운 센서(다리)까지의 거리 (m) */
  distanceM: number;
  speedMps: number;
  severity: TrackSeverity;
  phase: 'active' | 'leaving';
  /** 가장 가까운 센서 존의 라벨 (예: 'L1') */
  zoneLabel?: string;
}

export type HudOverallState = 'safe' | TrackSeverity;

export interface CollisionGuardHudSnapshot {
  overall: HudOverallState;
  tracks: HudTrack[];
}

const EMPTY_SNAPSHOT: CollisionGuardHudSnapshot = {
  overall: 'safe',
  tracks: [],
};

function deriveSnapshot(
  zones: CollisionGuardZone[],
): CollisionGuardHudSnapshot {
  const tracks = useCollisionGuardStore.getState().tracks;
  if (tracks.length === 0 || zones.length === 0) return EMPTY_SNAPSHOT;

  let overall: HudOverallState = 'safe';
  const hudTracks: HudTrack[] = tracks.map((track) => {
    const severity = trackSeverity(track, zones);
    if (track.phase === 'active') {
      if (severity === 'danger') overall = 'danger';
      else if (overall !== 'danger') overall = 'warning';
    }
    const nearest = nearestZone(track.target.x, track.target.z, zones);
    return {
      id: track.id,
      type: track.type,
      distanceM: Math.round(nearest.dist * nearest.zone.metersPerUnit),
      speedMps: Math.round(track.target.speed * 10) / 10,
      severity,
      phase: track.phase,
      zoneLabel: nearest.zone.label,
    };
  });

  // 위험도 우선 → 거리 오름차순 — 운영자가 가장 급한 것부터 읽는다.
  hudTracks.sort((a, b) => {
    if (a.severity !== b.severity) {
      return a.severity === 'danger' ? -1 : 1;
    }
    return a.distanceM - b.distanceM;
  });

  return { overall, tracks: hudTracks };
}

function isSameSnapshot(
  a: CollisionGuardHudSnapshot,
  b: CollisionGuardHudSnapshot,
): boolean {
  if (a.overall !== b.overall || a.tracks.length !== b.tracks.length) {
    return false;
  }
  return a.tracks.every((track, i) => {
    const other = b.tracks[i];
    return (
      track.id === other.id &&
      track.distanceM === other.distanceM &&
      track.speedMps === other.speedMps &&
      track.severity === other.severity &&
      track.phase === other.phase &&
      track.zoneLabel === other.zoneLabel
    );
  });
}

export function useCollisionGuardHudSnapshot(
  zones: CollisionGuardZone[],
  hz = 4,
): CollisionGuardHudSnapshot {
  const enabled = useCollisionGuardStore((s) => s.enabled);
  const [snapshot, setSnapshot] = useState(EMPTY_SNAPSHOT);

  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      const next = deriveSnapshot(zones);
      setSnapshot((prev) => (isSameSnapshot(prev, next) ? prev : next));
    };
    // 첫 tick도 interval에 맡긴다 — effect 본문 동기 setState 금지.
    // 토글 직후 최대 1/hz초 동안 EMPTY가 보이는 것은 허용 범위.
    const interval = setInterval(tick, 1000 / hz);
    return () => {
      clearInterval(interval);
      // 비활성 전환 시 스냅샷을 비운다 — 남겨두면 다시 켤 때 첫 tick
      // 전까지(최대 1/hz초) 꺼지기 직전의 낡은 목록이 되살아나 보인다.
      // 그 사이 트랙이 모두 정리됐다면 유령 목록이 되는 셈.
      setSnapshot(EMPTY_SNAPSHOT);
    };
  }, [enabled, zones, hz]);

  // 비활성화 중에는 내부 스냅샷이 무엇이든 EMPTY를 보여준다.
  return enabled ? snapshot : EMPTY_SNAPSHOT;
}
