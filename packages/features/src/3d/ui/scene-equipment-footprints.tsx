import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  Box3,
  Color,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  Path,
  RingGeometry,
  Shape,
  ShapeGeometry,
  Vector3,
  type BufferGeometry,
} from 'three';
import { modelObjectRegistry, type SavedSceneInfo } from '@crane/domain/3d';
import type { EquipmentOutlineState } from '@crane/core/types/status';
import {
  FOOTPRINT_OPACITY,
  FOOTPRINT_RING_WIDTH_RATIO,
  FOOTPRINT_Y_OFFSET,
  footprintColor,
  footprintPulseOpacity,
  footprintRadius,
} from '../lib/equipment-footprint';
import {
  PLAN_FRAME_WIDTH_RATIO,
  PLAN_SYMBOL_UPDATE_MS,
  isPlanView,
  planHeading,
} from '../lib/plan-view';
import { dangerModelIds, proximityModelIds } from '../lib/scene-proximity';
import { isEquipment } from '../model/use-scene-proximity';
import { useSceneLookStore } from '../model/use-scene-look-store';
import { useSceneProximityStore } from '../model/use-scene-proximity-store';

/**
 * 장비 작업 범위 표시 — 관제 모드의 **비스듬한 뷰**에서 근접(주의·위험) 쌍에
 * 든 장비에만 지면에 하나: 선회 장비는 선회 반경 원, 갠트리처럼 대칭이면 평면
 * AABB 사각 틀. 평면(탑뷰) 모드에선 그리지 않는다 — 거기선 마커의 점·칩과
 * 거리 선이 사건을 말하고, 원·틀은 번잡함만 더했다. 평상시 장비에도 그리지
 * 않는다(전부에 깔면 화면이 원으로 덮인다). Canvas 안.
 *
 * 반지름·선회 여부는 처음 보일 때 월드 AABB 로 재고(선회 여부는 AABB 중심이
 * 마스트에서 치우쳤는가, lib/plan-view planHeading), 반지름이 크게 달라지면
 * PLAN_SYMBOL_UPDATE_MS 주기의 재측정에서 다시 만든다. 위치는 매 프레임 모델
 * 루트를 따라간다(갠트리는 레일을 달린다). 색은 외곽선 상태와 같다(황·적),
 * 위험은 맥동(footprintPulseOpacity) — 프레임은 거버너 `pulse`.
 */
interface SymbolEntry {
  id: string;
  mesh: Mesh<BufferGeometry, MeshBasicMaterial>;
  radius: number;
  slewing: boolean;
}

/** 사각 틀 — 바깥 사각형에서 안쪽 사각형을 뺀 평면(XZ). */
function frameGeometry(width: number, depth: number): ShapeGeometry {
  const t = Math.min(width, depth) * PLAN_FRAME_WIDTH_RATIO;
  const shape = new Shape();
  shape.moveTo(-width / 2, -depth / 2);
  shape.lineTo(width / 2, -depth / 2);
  shape.lineTo(width / 2, depth / 2);
  shape.lineTo(-width / 2, depth / 2);
  shape.closePath();
  const hole = new Path();
  hole.moveTo(-width / 2 + t, -depth / 2 + t);
  hole.lineTo(width / 2 - t, -depth / 2 + t);
  hole.lineTo(width / 2 - t, depth / 2 - t);
  hole.lineTo(-width / 2 + t, depth / 2 - t);
  hole.closePath();
  shape.holes.push(hole);
  return new ShapeGeometry(shape);
}

const _box = new Box3();
const _size = new Vector3();
const _center = new Vector3();
const _pos = new Vector3();
const _dir = new Vector3();
const _color = new Color();

function buildSymbol(
  id: string,
  radius: number,
  slewing: boolean,
  width: number,
  depth: number,
): SymbolEntry {
  const material = new MeshBasicMaterial({
    color: footprintColor(undefined),
    transparent: true,
    opacity: FOOTPRINT_OPACITY,
    depthWrite: false,
    depthTest: false,
    side: DoubleSide,
    fog: false,
  });
  const mesh = new Mesh(
    slewing
      ? new RingGeometry(radius * (1 - FOOTPRINT_RING_WIDTH_RATIO), radius, 64)
      : frameGeometry(width, depth),
    material,
  );
  // 평면 geometry 는 XY — XZ 로 눕힌다(사각 틀은 축 대칭이라 방향 무관).
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 1;
  mesh.frustumCulled = true;
  mesh.raycast = () => {};
  return { id, mesh, radius, slewing };
}

function disposeSymbol(entry: SymbolEntry): void {
  entry.mesh.geometry.dispose();
  entry.mesh.material.dispose();
  entry.mesh.removeFromParent();
}

export function SceneEquipmentFootprints({
  sceneInfo,
  outlineStates,
}: {
  sceneInfo: SavedSceneInfo | null;
  outlineStates: Record<string, EquipmentOutlineState>;
}) {
  const controlRoom = useSceneLookStore((s) => s.controlRoom);
  const equipmentIds = useMemo(
    () => (sceneInfo?.models ?? []).filter(isEquipment).map((m) => m.id),
    [sceneInfo],
  );
  const entriesRef = useRef(new Map<string, SymbolEntry>());
  const stateRef = useRef({ lastMeasureAt: 0 });
  const outlineRef = useRef(outlineStates);
  useEffect(() => {
    outlineRef.current = outlineStates;
  }, [outlineStates]);
  const proximityPairs = useSceneProximityStore((s) => s.outlinePairs);
  const dangerIds = useMemo(
    () => dangerModelIds(proximityPairs),
    [proximityPairs],
  );
  const dangerRef = useRef(dangerIds);
  useEffect(() => {
    dangerRef.current = dangerIds;
  }, [dangerIds]);
  const nearIds = useMemo(
    () => proximityModelIds(proximityPairs),
    [proximityPairs],
  );
  const nearRef = useRef(nearIds);
  useEffect(() => {
    nearRef.current = nearIds;
  }, [nearIds]);

  // 씬이 바뀌거나 내려가면 표시를 버린다.
  useEffect(() => {
    const entries = entriesRef.current;
    return () => {
      for (const entry of entries.values()) disposeSymbol(entry);
      entries.clear();
    };
  }, [equipmentIds]);

  useFrame(({ scene, camera }) => {
    const entries = entriesRef.current;
    const state = stateRef.current;
    camera.getWorldDirection(_dir);
    const plan = isPlanView(_dir.y);
    const now = performance.now();
    const measure = now - state.lastMeasureAt >= PLAN_SYMBOL_UPDATE_MS;
    if (measure) state.lastMeasureAt = now;

    for (const id of equipmentIds) {
      const root = modelObjectRegistry.get(id);
      if (!root) continue;
      let entry = entries.get(id);
      const near = nearRef.current.has(id);
      const show = near && controlRoom && !plan;
      if (!show) {
        if (entry && entry.mesh.visible) entry.mesh.visible = false;
        continue;
      }
      root.getWorldPosition(_pos);
      if (!entry || measure) {
        _box.setFromObject(root);
        if (_box.isEmpty()) continue;
        _box.getSize(_size);
        _box.getCenter(_center);
        const radius = footprintRadius(_size.x / 2, _size.z / 2);
        // 선회 여부는 처음 잰 값으로 고정 — 지브가 마스트 바로 위를 지나는
        // 순간에 원이 사각형으로 바뀌지 않게.
        const slewing = entry
          ? entry.slewing
          : planHeading(_pos.x, _pos.z, _center.x, _center.z, radius) !== null;
        if (!entry || Math.abs(radius - entry.radius) > entry.radius * 0.1) {
          if (entry) disposeSymbol(entry);
          entry = buildSymbol(id, radius, slewing, _size.x, _size.z);
          scene.add(entry.mesh);
          entries.set(id, entry);
        }
      }
      const { mesh } = entry;
      if (!mesh.visible) mesh.visible = true;
      if (entry.slewing) {
        mesh.position.set(_pos.x, _pos.y + FOOTPRINT_Y_OFFSET, _pos.z);
      } else {
        // 사각 틀은 AABB 중심에(루트가 모서리일 수 있다).
        mesh.position.set(_center.x, _pos.y + FOOTPRINT_Y_OFFSET, _center.z);
      }
      _color.set(footprintColor(outlineRef.current[id]));
      if (!mesh.material.color.equals(_color)) mesh.material.color.copy(_color);
      const opacity = dangerRef.current.has(id)
        ? footprintPulseOpacity(now)
        : FOOTPRINT_OPACITY;
      if (mesh.material.opacity !== opacity) mesh.material.opacity = opacity;
    }
  });

  return null;
}
