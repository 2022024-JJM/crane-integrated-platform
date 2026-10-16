import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { modelObjectRegistry, type SavedSceneInfo } from '@crane/domain/3d';
import {
  PLAN_OVERLAP_SCAN_INTERVAL_MS,
  PlanOverlapScanner,
  buildPlanHiddenIndex,
  hasPlanOverlapChanged,
} from '../lib/plan-overlap-scan';
import { usePlanOverlapStore } from '../model/use-plan-overlap-store';
import { isPlanLookCamera } from '../lib/plan-look';
import { usePlanLookStore } from '../model/use-plan-look-store';

/**
 * 평면도 겹침 검출(Canvas 안, 무렌더) — 평면도 룩일 때만
 * PLAN_OVERLAP_SCAN_INTERVAL_MS 마다 씬 모델의 메쉬 월드 박스로 겹침을 찾아
 * 스토어에 쓴다. 숨은선 대상(쌍·위아래)이 바뀐 결과만 쓴다. 원근이면
 * 스토어를 비운다. **RigDriver 뒤에 마운트**한다(같은 priority 의 useFrame 은
 * 마운트 순 — 움직인 뒤 잰다).
 */
export function ScenePlanOverlapDetector({
  sceneInfo,
}: {
  sceneInfo: SavedSceneInfo | null;
}) {
  const scannerRef = useRef<PlanOverlapScanner | null>(null);
  const lastScanRef = useRef(Number.NEGATIVE_INFINITY);
  const ids = useMemo(
    () => (sceneInfo?.models ?? []).map((model) => model.id),
    [sceneInfo],
  );

  useEffect(
    () => () => {
      scannerRef.current?.clear();
      usePlanOverlapStore.getState().clear();
    },
    [],
  );

  useFrame(({ camera, clock }) => {
    const planView = isPlanLookCamera(
      camera,
      usePlanLookStore.getState().enabled,
    );
    if (!planView) {
      usePlanOverlapStore.getState().clear();
      return;
    }
    const nowMs = clock.elapsedTime * 1000;
    if (nowMs - lastScanRef.current < PLAN_OVERLAP_SCAN_INTERVAL_MS) return;
    lastScanRef.current = nowMs;
    scannerRef.current ??= new PlanOverlapScanner();
    const next = scannerRef.current.scan(ids, (id) =>
      modelObjectRegistry.get(id),
    );
    const store = usePlanOverlapStore.getState();
    if (!hasPlanOverlapChanged(store.overlaps, next)) return;
    // 스캐너는 배열을 재사용한다 — 보관본은 복사한다(항목은 스캔마다 새 객체).
    const copy = next.slice();
    store.set(copy, buildPlanHiddenIndex(copy));
  });

  return null;
}
