import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Box3, Vector3, type Object3D, type PerspectiveCamera } from 'three';
import { modelObjectRegistry } from '@crane/domain/3d';
import {
  selectTerrainLod,
  terrainLodPixelFactor,
} from '../lib/terrain-lod';

/**
 * 지형 타일 LOD 구동 — 씬에 로드된 타일 GLB(tile-terrain-glb.mjs --lod 산출물,
 * 노드 extras {tile,lod,lodError})의 LOD 노드 가시성을 카메라 거리에 따라
 * 전환한다. 수식·임계는 lib/terrain-lod.ts(테스트 대상), 여기는 배선만.
 *
 * - 발견: modelObjectRegistry 루트를 훑어 userData.tile 캐리어를 그룹핑한다.
 *   레지스트리 크기가 변한 프레임에만 다시 훑는다(지도 GLB 늦은 로드 대응 —
 *   SceneSurfaceCamera 의 registrySize 감시와 같은 요령). LOD 노드가 없는
 *   씬(타일 GLB 미사용)에서는 발견 결과가 비어 프레임 비용이 비교 1회다.
 * - 전환: 카메라 XZ 가 0.5m 넘게 움직였거나 픽셀 계수(fov·뷰포트)가 변한
 *   프레임에만 타일별 거리→레벨을 다시 계산한다(SceneCameraLimits 의 재측정
 *   게이트와 같은 요령). 거리는 타일 월드 AABB 최근접점 기준 — 보수적이라
 *   타일 어느 부분도 오차 상한을 넘지 않는다.
 * - 기본 상태: LOD>0 노드는 로드(clone) 시점에 이미 숨겨져 있고 raycast 도
 *   제외돼 있다(model-mesh.tsx 의 clone 순회) — 이 컴포넌트가 없는 캔버스
 *   (mro2 자산 뷰 등)에서도 이중 렌더가 없다. 여기서는 전환만 담당한다.
 * - 타일 AABB 는 발견 시 1회 계산한다. 지형은 잠긴 지도라 움직이지 않는 것이
 *   전제다 — 에디터에서 잠금 해제해 드래그하는 이례적 경우 LOD 거리 판정이
 *   재발견 전까지 낡을 수 있지만, 가시성 전환이 늦을 뿐 품질 파괴는 아니다.
 */

interface TerrainLodTile {
  /** 레벨별 오차 상한(m). [0]=0. 결손 레벨은 배열에 없음. */
  errors: number[];
  /** 레벨별 가시성 토글 대상 노드들. */
  levels: Object3D[][];
  box: Box3;
  current: number;
}

const CAMERA_MOVE_EPS_SQ = 0.5 * 0.5;

function isLodCarrier(object: Object3D): boolean {
  const data = object.userData as { tile?: unknown; lod?: unknown };
  return Array.isArray(data.tile) && typeof data.lod === 'number';
}

export function SceneTerrainLod() {
  const tilesRef = useRef<TerrainLodTile[]>([]);
  const registrySizeRef = useRef(-1);
  const lastCameraRef = useRef(new Vector3(Number.NaN, 0, Number.NaN));
  const lastFactorRef = useRef(0);
  const scratchBoxRef = useRef(new Box3());

  useFrame(({ camera, gl }) => {
    let discovered = false;
    const registrySize = modelObjectRegistry.size;
    if (registrySize !== registrySizeRef.current) {
      registrySizeRef.current = registrySize;
      tilesRef.current = discoverTiles(scratchBoxRef.current);
      discovered = true;
    }
    const tiles = tilesRef.current;
    if (tiles.length === 0) return;

    const perspective = camera as PerspectiveCamera;
    // domElement.height = 드로잉 버퍼 세로 device px(CSS px × DPR) — 오차를
    // device px 로 판정해야 DPR 1.5 에서도 서브픽셀 보장이 유지된다.
    const factor = perspective.isPerspectiveCamera
      ? terrainLodPixelFactor(perspective.fov, gl.domElement.height)
      : 0;

    const last = lastCameraRef.current;
    const moved =
      !Number.isFinite(last.x) ||
      (camera.position.x - last.x) ** 2 + (camera.position.z - last.z) ** 2 >
        CAMERA_MOVE_EPS_SQ ||
      Math.abs(camera.position.y - last.y) > 0.5;
    const factorChanged = factor !== lastFactorRef.current;
    if (!discovered && !moved && !factorChanged) return;
    last.copy(camera.position);
    lastFactorRef.current = factor;

    for (const tile of tiles) {
      const distance = tile.box.distanceToPoint(camera.position);
      const level = selectTerrainLod(
        tile.errors,
        distance,
        factor,
        tile.current,
      );
      if (level === tile.current && !discovered) continue;
      tile.current = level;
      for (let lod = 0; lod < tile.levels.length; lod += 1) {
        const show = lod === level;
        for (const node of tile.levels[lod]) {
          if (node.visible !== show) node.visible = show;
        }
      }
    }
  });

  return null;
}

/** 레지스트리 루트를 훑어 타일 그룹을 만든다. 발견 프레임에만 돈다. */
function discoverTiles(scratchBox: Box3): TerrainLodTile[] {
  const groups = new Map<
    string,
    { errors: number[]; levels: Object3D[][]; lod0: Object3D[] }
  >();

  modelObjectRegistry.forEachRoot((root) => {
    root.traverse((object) => {
      if (!isLodCarrier(object)) return;
      // 캐리어 안에 캐리어가 중첩될 일은 없지만(스크립트 산출 구조), 조상이
      // 이미 캐리어면 중복 그룹핑을 막는다.
      for (let p = object.parent; p; p = p.parent) {
        if (isLodCarrier(p)) return;
      }
      const data = object.userData as {
        tile: [number, number];
        lod: number;
        lodError?: number;
      };
      const key = `${root.uuid}:${data.tile[0]},${data.tile[1]}`;
      let group = groups.get(key);
      if (!group) {
        group = { errors: [], levels: [], lod0: [] };
        groups.set(key, group);
      }
      const lod = data.lod;
      group.errors[lod] = lod === 0 ? 0 : (data.lodError ?? 0);
      (group.levels[lod] ??= []).push(object);
      if (lod === 0) group.lod0.push(object);
    });
  });

  const tiles: TerrainLodTile[] = [];
  for (const group of groups.values()) {
    // 결손 레벨(오차 미기록·노드 없음)은 그 위 레벨을 못 쓰게 잘라낸다 —
    // selectTerrainLod 는 연속 배열을 전제한다.
    let usable = group.levels.length;
    for (let lod = 0; lod < group.levels.length; lod += 1) {
      const nodes = group.levels[lod];
      const error = group.errors[lod];
      if (!nodes || nodes.length === 0 || typeof error !== 'number') {
        usable = lod;
        break;
      }
    }
    if (usable === 0 || group.lod0.length === 0) continue;

    const box = new Box3();
    for (const node of group.lod0) {
      node.updateWorldMatrix(true, false);
      scratchBox.setFromObject(node);
      if (!scratchBox.isEmpty()) box.union(scratchBox);
    }
    if (box.isEmpty()) continue;

    tiles.push({
      errors: group.errors.slice(0, usable) as number[],
      levels: group.levels.slice(0, usable),
      box,
      // 발견 직후 첫 패스가 전 레벨 가시성을 정합 상태로 강제한다.
      current: -1,
    });
  }
  return tiles;
}
