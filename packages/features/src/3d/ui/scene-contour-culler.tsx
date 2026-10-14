import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Vector3 } from 'three';
import {
  getSceneMetersPerUnit,
  modelObjectRegistry,
  sceneLookSettings,
  type SavedSceneInfo,
} from '@crane/domain/3d';
import {
  CONTOUR_CULL_INTERVAL_MS,
  selectContourIds,
  type ContourCandidate,
} from '../lib/contour-culling';
import { isEquipment } from '../model/use-scene-proximity';
import { useSceneLookStore } from '../model/use-scene-look-store';

const _pos = new Vector3();

/**
 * 상시 윤곽 거리 컬링 — Canvas 안 null 컴포넌트. CONTOUR_CULL_INTERVAL_MS
 * 마다 카메라에서 장비 루트까지의 거리를 재서 상한 안의 id 를 스토어에 쓴다
 * (바뀔 때만). 관제 모드가 아니면 빈 목록.
 */
export function SceneContourCuller({
  sceneInfo,
  regionId,
}: {
  sceneInfo: SavedSceneInfo | null;
  regionId: string | undefined;
}) {
  const controlRoom = useSceneLookStore((s) => s.controlRoom);
  const equipmentIds = useMemo(
    () => (sceneInfo?.models ?? []).filter(isEquipment).map((m) => m.id),
    [sceneInfo],
  );
  const lastRef = useRef(0);
  const metersPerUnit = getSceneMetersPerUnit(regionId);

  useEffect(() => {
    if (!controlRoom) useSceneLookStore.getState().setContourIds([]);
    return () => useSceneLookStore.getState().setContourIds([]);
  }, [controlRoom]);

  useFrame(({ camera }) => {
    if (!controlRoom) return;
    const now = performance.now();
    if (now - lastRef.current < CONTOUR_CULL_INTERVAL_MS) return;
    lastRef.current = now;
    // 평면 모드에선 윤곽을 그리지 않는다 — 기호가 장비이고 윤곽은 잡티가 된다.
    if (sceneLookSettings.planView) {
      useSceneLookStore.getState().setContourIds([]);
      return;
    }
    const candidates: ContourCandidate[] = [];
    for (const id of equipmentIds) {
      const root = modelObjectRegistry.get(id);
      if (!root) continue;
      root.getWorldPosition(_pos);
      candidates.push({ id, distance: _pos.distanceTo(camera.position) });
    }
    useSceneLookStore
      .getState()
      .setContourIds(selectContourIds(candidates, metersPerUnit));
  });

  return null;
}
