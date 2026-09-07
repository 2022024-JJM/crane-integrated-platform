import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { SavedSceneInfo } from '@crane/domain/3d';
import { SCAN_BUDGET_MS, SCAN_INTERVAL_MS } from '../lib/scene-collision-pairs';
import { rigValueStore } from './rig-value-store';
import { buildCollisionReport } from './scene-collision-report';
import { sceneCollisionRuntime } from './scene-collision-runtime';
import { useActiveTransformStore } from './use-active-transform-store';
import { useSceneCollisionStore } from './use-scene-collision-store';
import { useVirtualTagStore } from './use-virtual-tag-store';

/**
 * 씬 충돌 감지기 — R3F Canvas 안에서 useFrame 으로 런타임을 돌린다.
 *
 * **`RigDriver` 바로 다음에 마운트한다.** 같은 priority(0) 의 useFrame 은
 * 구독(마운트) 순서로 실행되므로 드라이버가 노드를 움직인 뒤 검사한다.
 * (priority 를 올리면 R3F 가 자동 렌더를 끄므로 쓰지 않는다.)
 *
 * 매 프레임이 아니라 SCAN_INTERVAL_MS 마다, SCAN_BUDGET_MS 예산으로 돈다.
 * 기즈모 드래그 중엔 건너뛴다 — 드래그 종료 프레임에 행렬이 바뀌어 다음
 * 스캔에서 검사된다.
 *
 * 충돌을 받으면: 스토어에 보고(1회 set) → 가상 태그 러너 정지 → 값 저장소
 * freeze(스무딩 잔여 수렴 차단). 런타임은 hit 을 돌려주며 스스로 halted 가
 * 된다. 재무장은 스토어의 dismiss/resetAndRearm 이 한다.
 */
export function useSceneCollisionDetector({
  sceneInfo,
  enabled,
}: {
  sceneInfo: SavedSceneInfo | null;
  enabled: boolean;
}): void {
  const models = sceneInfo?.models;
  // useFrame 콜백이 읽는 값 — 렌더 중이 아니라 effect 에서 갱신(react-hooks/refs).
  const enabledRef = useRef(false);
  const lastScanRef = useRef(0);

  useEffect(() => {
    sceneCollisionRuntime.sync(models);
  }, [models]);

  useEffect(() => {
    enabledRef.current = enabled;
    if (!enabled) return;
    sceneCollisionRuntime.arm();
    return () => {
      enabledRef.current = false;
      sceneCollisionRuntime.disarm();
      useSceneCollisionStore.getState().clear();
    };
  }, [enabled]);

  useFrame(() => {
    if (!enabledRef.current) return;
    if (useActiveTransformStore.getState().active) return;
    const now = performance.now();
    if (now - lastScanRef.current < SCAN_INTERVAL_MS) return;
    lastScanRef.current = now;

    const hit = sceneCollisionRuntime.tick(now, SCAN_BUDGET_MS);
    if (!hit) return;
    useSceneCollisionStore
      .getState()
      .reportCollision(buildCollisionReport(hit));
    useVirtualTagStore.getState().pause();
    rigValueStore.freeze();
  });
}
