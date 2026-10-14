import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { getSceneMetersPerUnit, type SavedModelInfo } from '@crane/domain/3d';
import {
  PROXIMITY_MAX_PAIRS,
  PROXIMITY_UPDATE_MS,
  PROXIMITY_WARN_M,
  resolveProximityLevel,
  type ProximityPair,
} from '../lib/scene-proximity';
import { sceneCollisionRuntime } from './scene-collision-runtime';
import { useSceneProximityStore } from './use-scene-proximity-store';

/**
 * 근접 표시 대상 — 태그가 걸린(움직이는) 장비끼리만. 블록·선박·구조물처럼
 * 태그 없는 모델은 크레인이 그 위에서 작업하는 것이 정상이라 거리를 재지
 * 않는다(크레인↔크레인 충돌 관제가 목적).
 */
export function isEquipment(model: SavedModelInfo): boolean {
  return (model.tagMappings?.length ?? 0) > 0;
}

/**
 * 근접 쌍 갱신 — R3F Canvas 안, **충돌 검출기 뒤**에 둔다(같은 priority 의
 * useFrame 은 마운트 순이라 그 스캔이 갱신한 모델 AABB 를 읽는다). 충돌
 * 런타임이 무장돼 있어야(감지 설정 켬) 쌍이 나온다 — 감지를 끄면 거리 선도
 * 사라진다. m 환산은 씬 지역의 unit 스케일.
 */
export function useSceneProximity({
  regionId,
  enabled,
}: {
  regionId: string | undefined;
  enabled: boolean;
}): void {
  const enabledRef = useRef(enabled);
  const metersPerUnitRef = useRef(getSceneMetersPerUnit(regionId));
  const lastRef = useRef(0);
  useEffect(() => {
    enabledRef.current = enabled;
    metersPerUnitRef.current = getSceneMetersPerUnit(regionId);
    if (!enabled) useSceneProximityStore.getState().clear();
  }, [enabled, regionId]);
  useEffect(() => () => useSceneProximityStore.getState().clear(), []);

  useFrame(() => {
    if (!enabledRef.current) return;
    const now = performance.now();
    if (now - lastRef.current < PROXIMITY_UPDATE_MS) return;
    lastRef.current = now;
    const mpu = metersPerUnitRef.current;
    const candidates = sceneCollisionRuntime.nearestPairs(
      PROXIMITY_WARN_M / mpu,
      PROXIMITY_MAX_PAIRS,
      isEquipment,
    );
    const pairs: ProximityPair[] = [];
    for (const c of candidates) {
      const gapM = c.gap * mpu;
      const level = resolveProximityLevel(gapM);
      if (!level) continue;
      pairs.push({
        key: c.key,
        a: c.a,
        b: c.b,
        gapM,
        level,
        from: c.from,
        to: c.to,
      });
    }
    useSceneProximityStore.getState().setPairs(pairs);
  });
}
