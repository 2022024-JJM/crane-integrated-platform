import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { SavedSceneInfo } from '@crane/domain/3d';
import { SCAN_BUDGET_MS, SCAN_INTERVAL_MS } from '../lib/scene-collision-pairs';
import { rigValueStore } from './rig-value-store';
import {
  holdRunners,
  isRunnerRunning,
  type SceneCollisionRunner,
} from './scene-collision-hold';
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
 * **시뮬레이션이 만든 움직임만 검사한다.** 스캔은 `runner` 가 재생 중이고
 * 기즈모 드래그가 아닐 때만 돌고(scene-collision-hold 의 isRunnerRunning),
 * 멈췄다 재개되는 전이마다 런타임 기준선을 다시 잡는다(`rebaseline`) —
 * 정지 중 기즈모·인스펙터·슬라이더로 만든 겹침, 드래그로 놓은 겹침은 보고
 * 대신 억제되고, 시뮬레이션이 떼었다 다시 붙여야 보고된다. 새 모델 항목
 * (로딩 배치)은 런타임이 스스로 기준선에 넣는다. 안정화 창 동안 워밍업
 * 표시가 "기준선 계산 중" 을 보이고, 스캔이 멈추면 표시도 내린다.
 *
 * 스캔 중엔 매 프레임이 아니라 SCAN_INTERVAL_MS 마다, SCAN_BUDGET_MS 예산으로
 * 돈다.
 *
 * 충돌을 받으면 기록을 남기고 그 쌍을 억제(메쉬가 떨어질 때까지 재보고
 * 없음)한 채 감시를 계속한다. 모드에 따라 달라지는 것은 화면 쪽뿐이다.
 * - 충돌 시 정지: 러너 정지(가상 태그 pause + 실시간 화면 반영 보류,
 *   scene-collision-hold) → 값 저장소 freeze(스무딩 잔여 수렴 차단) → 박스
 *   고정(pin). 정지 중엔 스캔도 멈춘다. ▶ 재생(isRunning false→true)·재개·
 *   오버레이 X 가 resume 으로 고정을 풀고, 재생 첫 프레임의 재기준선이 아직
 *   겹친 쌍을 조용히 넘긴다 — 가상 태그 러너는 경과 시간을 보존하므로 멈춘
 *   지점에서 이어지고, 실시간은 다음 수신 값부터 따라간다.
 * - 정지 안 함: 박스는 FLASH_MS 동안만.
 */
export function useSceneCollisionDetector({
  sceneInfo,
  enabled,
  runner,
}: {
  sceneInfo: SavedSceneInfo | null;
  enabled: boolean;
  runner: SceneCollisionRunner;
}): void {
  const models = sceneInfo?.models;
  // useFrame 콜백이 읽는 값 — 렌더 중이 아니라 effect 에서 갱신(react-hooks/refs).
  const enabledRef = useRef(false);
  const runnerRef = useRef<SceneCollisionRunner>(runner);
  /** 직전 프레임에 스캔 게이트가 열려 있었는지 — 재개 전이에서 재기준선. */
  const scanningRef = useRef(false);
  const lastScanRef = useRef(0);

  useEffect(() => {
    sceneCollisionRuntime.sync(models);
  }, [models]);

  useEffect(() => {
    runnerRef.current = runner;
  }, [runner]);

  useEffect(() => {
    enabledRef.current = enabled;
    if (!enabled) return;
    // baselinePending 은 여기서 올리지 않는다 — 러너가 꺼져 있으면 스캔이
    // 없어 "기준선 계산 중" 이 영원히 남는다. 첫 스캔이 올린다.
    sceneCollisionRuntime.arm();
    return () => {
      enabledRef.current = false;
      scanningRef.current = false;
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
    const scanning =
      isRunnerRunning(runnerRef.current) &&
      !useActiveTransformStore.getState().active;
    if (!scanning) {
      if (scanningRef.current) {
        scanningRef.current = false;
        useSceneCollisionStore.getState().setBaselinePending(false);
      }
      return;
    }
    if (!scanningRef.current) {
      scanningRef.current = true;
      sceneCollisionRuntime.rebaseline();
    }
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
    // 다시 붙인 충돌이 보고되지 않는다. 억제는 메쉬가 떨어지면 풀린다.
    sceneCollisionRuntime.suppress(hit.key);
    if (store.pauseOnCollision) {
      holdRunners();
      rigValueStore.freeze();
      store.pin(record.id);
      // 스캔을 우리 손으로 멈췄다 — 다음 프레임 전에 ▶ 가 눌려도 재개 전이로
      // 보이게 게이트 상태를 내린다(실시간은 보류만 하므로 다음 프레임에 그대로
      // 재기준선 1회 — 얼어 있는 씬이라 무해).
      scanningRef.current = false;
    } else {
      store.flash(record.id);
    }
  });
}
