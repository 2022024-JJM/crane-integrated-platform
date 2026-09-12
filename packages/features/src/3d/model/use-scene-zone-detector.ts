import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { SavedSceneInfo } from '@crane/domain/3d';
import { ZONE_SCAN_BUDGET_MS, ZONE_SCAN_INTERVAL_MS } from '../lib/scene-zones';
import { sceneZoneRuntime } from './scene-zone-runtime';
import { useSceneZoneStore } from './use-scene-zone-store';

/**
 * 모델 영역 침범 검출기 — R3F Canvas 안에서 useFrame 으로 런타임을 돌린다.
 * **`RigDriver` 뒤**(충돌 검출기 옆)에 마운트한다 — 같은 priority 의 useFrame
 * 은 마운트 순이라 노드가 움직인 뒤 검사한다.
 *
 * 충돌 검출기와 달리 **러너 여부로 스캔을 막지 않는다.** 영역은 상태라 에디터
 * 에서 모델을 끌어 넣으면 그 자리에서 링이 밝아져야 한다(편집 피드백). 기록이
 * 없으므로 러너를 알 필요도 없다 — 기준선·억제 장치도 필요 없다.
 *
 * demand 프레임루프: `gl.render` 가 useFrame 뒤에 matrixWorld 를 갱신하므로
 * 여기서 읽는 행렬은 한 프레임 늦다. 무언가 움직였으면(`moved`) 다음 프레임을
 * 한 번 더 요청해 마지막 자세가 미검사로 남지 않게 하고, 전이가 있으면
 * 링·배지가 다시 그려지게 한 번 더 요청한다.
 */
export function useSceneZoneDetector({
  sceneInfo,
  enabled,
}: {
  sceneInfo: SavedSceneInfo | null;
  enabled: boolean;
}): void {
  const models = sceneInfo?.models;
  const invalidate = useThree((s) => s.invalidate);
  // useFrame 콜백이 읽는 값 — 렌더 중이 아니라 effect 에서 갱신(react-hooks/refs).
  const enabledRef = useRef(false);
  const lastScanRef = useRef(0);

  useEffect(() => {
    sceneZoneRuntime.sync(models);
  }, [models]);

  useEffect(() => {
    enabledRef.current = enabled;
    if (!enabled) return;
    sceneZoneRuntime.arm();
    // 재무장 첫 스캔이 곧바로 돌게 한 프레임 요청.
    invalidate();
    return () => {
      enabledRef.current = false;
      sceneZoneRuntime.disarm();
      useSceneZoneStore.getState().clear();
    };
  }, [enabled, invalidate]);

  useFrame(() => {
    if (!enabledRef.current) return;
    const now = performance.now();
    if (now - lastScanRef.current < ZONE_SCAN_INTERVAL_MS) return;
    lastScanRef.current = now;

    const result = sceneZoneRuntime.tick(now, ZONE_SCAN_BUDGET_MS);
    if (result.moved) invalidate();
    if (result.transitions.length === 0) return;
    useSceneZoneStore.getState().applyTransitions(result.transitions);
    invalidate();
  });
}
