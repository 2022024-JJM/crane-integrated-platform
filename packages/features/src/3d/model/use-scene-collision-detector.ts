import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { SavedSceneInfo } from '@crane/domain/3d';
import { SCAN_BUDGET_MS, SCAN_INTERVAL_MS } from '../lib/scene-collision-pairs';
import { rigValueStore } from './rig-value-store';
import { holdRunners } from './scene-collision-hold';
import { buildCollisionRecord } from './scene-collision-record';
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
 * 충돌을 받으면 기록을 남기고 그 쌍을 억제(메쉬가 떨어질 때까지 재보고
 * 없음)한 채 감시를 계속한다. 모드에 따라 달라지는 것은 화면 쪽뿐이다.
 * - 충돌 시 정지: 러너 정지(가상 태그 pause + 실시간 화면 반영 보류,
 *   scene-collision-hold) → 값 저장소 freeze(스무딩 잔여 수렴 차단) → 박스
 *   고정(pin). ▶ 재생(isRunning false→true)·재개·오버레이 X 가 resume 으로
 *   고정을 푼다 — 가상 태그 러너는 경과 시간을 보존하므로 멈춘 지점에서
 *   이어지고, 실시간은 다음 수신 값부터 따라간다. 정지 중 기즈모로 떼었다
 *   다시 붙여도 새 충돌로 기록된다.
 * - 정지 안 함: 박스는 FLASH_MS 동안만.
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
    useSceneCollisionStore.getState().setBaselinePending(true);
    return () => {
      enabledRef.current = false;
      sceneCollisionRuntime.disarm();
      const store = useSceneCollisionStore.getState();
      store.clear();
      store.setBaselinePending(false);
    };
  }, [enabled]);

  // ▶ 재생 전이 — 정지·복원 상태를 풀고 재무장. 정지 상태를 만든 쪽(충돌·
  // 기록 클릭)이 어디든 해제 경로는 이 하나다.
  useEffect(
    () =>
      useVirtualTagStore.subscribe((state, prev) => {
        if (state.isRunning && !prev.isRunning) {
          useSceneCollisionStore.getState().resume();
        }
      }),
    [],
  );

  useFrame(() => {
    if (!enabledRef.current) return;
    if (useActiveTransformStore.getState().active) return;
    const now = performance.now();
    if (now - lastScanRef.current < SCAN_INTERVAL_MS) return;
    lastScanRef.current = now;

    const hit = sceneCollisionRuntime.tick(now, SCAN_BUDGET_MS);
    // 기준선 완료(baseline → scanning)를 화면에 알린다. 스토어 쓰기는 값이
    // 바뀔 때만 — 매 스캔마다 set 하면 구독자가 헛되이 리렌더된다.
    useSceneCollisionStore
      .getState()
      .setBaselinePending(sceneCollisionRuntime.currentPhase === 'baseline');
    if (!hit) return;

    const store = useSceneCollisionStore.getState();
    const record = buildCollisionRecord(hit);
    store.pushRecord(record);
    // 어느 모드든 그 쌍만 억제하고 감시는 계속한다 — 런타임을 멈추면 떼었다
    // 다시 붙인 충돌(기즈모·재생)이 보고되지 않는다. 억제는 메쉬가 떨어지면 풀린다.
    sceneCollisionRuntime.suppress(hit.key);
    if (store.pauseOnCollision) {
      holdRunners();
      rigValueStore.freeze();
      store.pin(record.id);
    } else {
      store.flash(record.id);
    }
  });
}
