import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Object3D } from 'three';
import {
  modelObjectRegistry,
  sampleMapsSurfaceY,
  type SavedMapInfo,
} from '@crane/domain/3d';
import type { CollisionGuardZone } from './use-collision-guard-store';

/**
 * 충돌 감지 존의 지면 높이를 **바닥 지도 표면**으로 해석한다.
 *
 * 존 빌더(사이트 config)는 크레인 배치의 x·z 만 알고 y 는 폴백값(크레인
 * 배치 y)만 넣는다. 지도 GLB 는 비동기로 로드되고 표면 높이는 raycast 로만
 * 알 수 있으므로, 여기서 존 중심마다 `sampleMapsSurfaceY` 를 한 번 재서
 * `zone.y` 를 바꿔 끼운 배열을 돌려준다. 링·감지 객체·컷 플레인이 전부
 * `zone.y` 를 읽으므로 소비처는 바뀌지 않는다.
 *
 * 골리앗 씬에서 존을 고정 y(0.05)에 두던 시절, 크레인이 필리 조선소 지도
 * 위(지면 y≈3.6)로 옮겨지자 링과 감지 객체가 지도 아래 묻혀 보이지 않았다
 * (2026-09-15). 지도가 바뀌거나 크레인이 재배치돼도 따라오도록 상수가 아니라
 * 측정값을 쓴다.
 *
 * 샘플 규칙:
 * - `groundMaps` 가 비면 입력 `zones` 참조를 그대로 돌려준다(측정 없음).
 * - 아직 해석되지 않은 존, 또는 지난 샘플 때 쓴 지도 Object3D 참조가 바뀐
 *   경우(지도 늦은 로드·교체)에만 raycast 한다. 로딩 중 레지스트리에 메시
 *   id 가 계속 등록되므로 `registry.size` 가 아니라 **지도 객체 참조**로
 *   비교해 불필요한 재샘플을 막는다.
 * - 재시도 간격은 프레임 clock 기준 `GROUND_SAMPLE_INTERVAL_S`. demand
 *   frameloop 에서는 프레임이 있을 때만 돌지만, 지도 마운트가 곧 프레임을
 *   만들므로 늦은 로드도 잡힌다.
 * - 값이 같으면 setState 하지 않는다 — 결과 배열 참조가 유지돼 소비처의
 *   useMemo·리렌더가 흔들리지 않는다.
 * - `zones`·`groundMaps` 참조가 바뀌면(크레인 이동·씬 재로드) 해석값을
 *   버리고 다시 잰다.
 */
export const GROUND_SAMPLE_INTERVAL_S = 0.25;

interface SampleCache {
  zones: CollisionGuardZone[];
  groundMaps: readonly SavedMapInfo[];
  /** 지난 샘플 때 레지스트리에서 본 지도 객체 — 바뀌면 재샘플. */
  mapObjects: (Object3D | undefined)[];
  lastSampleAt: number;
}

function mapObjectsChanged(
  groundMaps: readonly SavedMapInfo[],
  previous: (Object3D | undefined)[],
): boolean {
  if (previous.length !== groundMaps.length) return true;
  for (let i = 0; i < groundMaps.length; i++) {
    if (modelObjectRegistry.get(groundMaps[i].id) !== previous[i]) return true;
  }
  return false;
}

function sameGroundY(a: (number | null)[], b: (number | null)[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

interface Resolved {
  /** 이 해석이 어느 입력에 대한 것인지 — 입력이 바뀌면 적용하지 않는다. */
  zones: CollisionGuardZone[];
  groundMaps: readonly SavedMapInfo[];
  /** 존별 표면 y. 히트 없음은 null(폴백 y 유지). */
  values: (number | null)[];
}

const NO_RESOLUTION: Resolved = { zones: [], groundMaps: [], values: [] };

export function useCollisionGuardGroundZones(
  zones: CollisionGuardZone[],
  groundMaps: readonly SavedMapInfo[],
): CollisionGuardZone[] {
  const [resolved, setResolved] = useState<Resolved>(NO_RESOLUTION);
  const cacheRef = useRef<SampleCache>({
    zones,
    groundMaps,
    mapObjects: [],
    lastSampleAt: -Infinity,
  });

  useFrame((state) => {
    if (groundMaps.length === 0 || zones.length === 0) return;
    const cache = cacheRef.current;

    // 입력이 바뀌면 이전 해석은 무효 — 스로틀 없이 바로 다시 잰다.
    const inputsChanged =
      cache.zones !== zones || cache.groundMaps !== groundMaps;
    if (inputsChanged) {
      cache.zones = zones;
      cache.groundMaps = groundMaps;
      cache.mapObjects = [];
      cache.lastSampleAt = -Infinity;
    }

    const now = state.clock.elapsedTime;
    if (now - cache.lastSampleAt < GROUND_SAMPLE_INTERVAL_S) return;

    const unresolved =
      resolved.zones !== zones ||
      resolved.groundMaps !== groundMaps ||
      resolved.values.some((y) => y === null);
    if (!unresolved && !mapObjectsChanged(groundMaps, cache.mapObjects)) {
      return;
    }

    cache.lastSampleAt = now;
    cache.mapObjects = groundMaps.map((map) => modelObjectRegistry.get(map.id));
    const values = zones.map((zone) =>
      sampleMapsSurfaceY(groundMaps, zone.center[0], zone.center[1]),
    );
    setResolved((prev) =>
      prev.zones === zones &&
      prev.groundMaps === groundMaps &&
      sameGroundY(prev.values, values)
        ? prev
        : { zones, groundMaps, values },
    );
  });

  return useMemo(() => {
    if (groundMaps.length === 0) return zones;
    if (resolved.zones !== zones || resolved.groundMaps !== groundMaps) {
      return zones;
    }
    if (resolved.values.every((y) => y === null)) return zones;
    return zones.map((zone, i) => {
      const y = resolved.values[i];
      return y === null || y === undefined ? zone : { ...zone, y };
    });
  }, [zones, groundMaps, resolved]);
}
