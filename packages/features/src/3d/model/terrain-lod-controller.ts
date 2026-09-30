import { Box3, Vector3, type Camera, type Object3D } from 'three';
import { modelObjectRegistry } from '@crane/domain/3d';
import {
  lodCarrierKey,
  selectTerrainLod,
  terrainLodPixelFactor,
} from '../lib/terrain-lod';

/**
 * LOD 구동의 상태 — 씬에 로드된 지형 타일 GLB(tile-terrain-glb.mjs --lod
 * 산출물, 노드 extras {tile,lod,lodError})와 모델 GLB(add-model-lod.mjs
 * 산출물, extras {lodGroup,lod,lodError})의 LOD 노드 가시성을 카메라 거리에
 * 따라 전환한다. 수식·임계는 lib/terrain-lod.ts(테스트 대상)이고 여기는
 * 발견·카메라별 상태·가시성 쓰기다. 배선은 ui/scene-terrain-lod.tsx(기본
 * 카메라)와 ui/scene-split-renderer.tsx(타일 카메라).
 *
 * - 카메라별 상태: 가시성(node.visible)은 씬 전체에 하나뿐이라 같은 프레임에
 *   여러 카메라가 번갈아 그리면(분할 화면) 카메라마다 자기 레벨을 **매번 다시
 *   쓴다**. 이동 게이트는 거리 계산만 건너뛰고 쓰기는 건너뛰지 않는다 —
 *   안 그러면 다른 카메라가 남긴 가시성으로 그린다.
 * - 모델 그룹(lodGroup)은 움직인다(태그 맵핑·기즈모). 타일처럼 발견 시 AABB
 *   를 고정하면 크레인이 주행한 뒤 거리 판정이 낡으므로, 모델은 매 프레임
 *   LOD0 노드의 월드 위치 + 발견 시 잰 반경으로 거리를 재고 이동 게이트를
 *   타지 않는다(그룹 수십 개 × 벡터 연산이라 무시할 비용).
 * - 발견: modelObjectRegistry 루트를 훑어 userData.tile 캐리어를 그룹핑한다.
 *   레지스트리 크기가 변한 프레임에만 다시 훑는다(지도 GLB 늦은 로드 대응 —
 *   SceneSurfaceCamera 의 registrySize 감시와 같은 요령). LOD 노드가 없는
 *   씬(타일 GLB 미사용)에서는 발견 결과가 비어 프레임 비용이 비교 1회다.
 * - 기본 상태: LOD>0 노드는 로드(clone) 시점에 이미 숨겨져 있고 raycast 도
 *   제외돼 있다(model-mesh.tsx 의 clone 순회) — 이 컨트롤러가 없는 캔버스
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
  /** 고정 AABB(지형 타일) — 모델 그룹은 매 프레임 위치를 다시 읽는다. */
  box: Box3;
  /**
   * 모델 그룹: 거리 = |카메라 − LOD0 월드 위치| − 반경. 타일은 null.
   * 반경은 발견 시 LOD0 AABB 의 반대각 절반(월드 스케일 포함).
   */
  dynamic: { anchor: Object3D; radius: number } | null;
}

interface CameraLodState {
  last: Vector3;
  lastFactor: number;
  /** 타일 index → 현재 레벨. 발견 직후 -1(첫 패스가 정합 상태를 강제). */
  levels: number[];
}

const CAMERA_MOVE_EPS_SQ = 0.5 * 0.5;

function isLodCarrier(object: Object3D): boolean {
  return lodCarrierKey(object.userData) !== null;
}

export class TerrainLodController {
  private tiles: TerrainLodTile[] = [];
  private registrySize = -1;
  private readonly cameras = new Map<string, CameraLodState>();
  private readonly scratchAnchor = new Vector3();
  private readonly scratchBox = new Box3();

  /** 레지스트리가 바뀐 프레임에 타일을 다시 찾는다. 다시 찾았으면 true. */
  private discover(): boolean {
    const registrySize = modelObjectRegistry.size;
    if (registrySize === this.registrySize) return false;
    this.registrySize = registrySize;
    this.tiles = discoverTiles(this.scratchBox);
    // 타일 index 가 바뀌었으니 카메라별 레벨은 전부 무효다.
    for (const state of this.cameras.values()) {
      state.levels = [];
      state.last.set(Number.NaN, 0, Number.NaN);
    }
    return true;
  }

  /**
   * 카메라 기준으로 LOD 가시성을 쓴다. `heightPx` 는 그 카메라가 그리는
   * 뷰포트의 세로 **device px**(CSS px × DPR) — 오차를 device px 로 판정해야
   * DPR 1.5 에서도 서브픽셀 보장이 유지된다. `cameraKey` 마다 이동 게이트와
   * 현재 레벨을 따로 둔다.
   */
  apply(cameraKey: string, camera: Camera, heightPx: number): void {
    const discovered = this.discover();
    const tiles = this.tiles;
    if (tiles.length === 0) return;

    let state = this.cameras.get(cameraKey);
    if (!state) {
      state = {
        last: new Vector3(Number.NaN, 0, Number.NaN),
        lastFactor: 0,
        levels: [],
      };
      this.cameras.set(cameraKey, state);
    }

    const perspective = camera as Camera & {
      isPerspectiveCamera?: boolean;
      fov?: number;
    };
    const factor =
      perspective.isPerspectiveCamera && typeof perspective.fov === 'number'
        ? terrainLodPixelFactor(perspective.fov, heightPx)
        : 0;

    const last = state.last;
    const moved =
      !Number.isFinite(last.x) ||
      (camera.position.x - last.x) ** 2 + (camera.position.z - last.z) ** 2 >
        CAMERA_MOVE_EPS_SQ ||
      Math.abs(camera.position.y - last.y) > 0.5;
    const factorChanged = factor !== state.lastFactor;
    const cameraStill = !discovered && !moved && !factorChanged;
    last.copy(camera.position);
    state.lastFactor = factor;

    for (let index = 0; index < tiles.length; index += 1) {
      const tile = tiles[index];
      const current = state.levels[index] ?? -1;
      let level = current;
      // 카메라가 멈춰 있으면 움직이는 모델 그룹만 다시 판정한다.
      if (!(cameraStill && !tile.dynamic) || current < 0) {
        let distance: number;
        if (tile.dynamic) {
          const anchor = tile.dynamic.anchor;
          this.scratchAnchor.setFromMatrixPosition(anchor.matrixWorld);
          distance = Math.max(
            0,
            camera.position.distanceTo(this.scratchAnchor) -
              tile.dynamic.radius,
          );
        } else {
          distance = tile.box.distanceToPoint(camera.position);
        }
        level = selectTerrainLod(tile.errors, distance, factor, current);
        state.levels[index] = level;
      }
      // 레벨이 같아도 쓴다 — 다른 카메라가 남긴 가시성일 수 있다.
      for (let lod = 0; lod < tile.levels.length; lod += 1) {
        const show = lod === level;
        for (const node of tile.levels[lod]) {
          if (node.visible !== show) node.visible = show;
        }
      }
    }
  }

  /** 카메라 상태를 지운다(타일 구성이 바뀌어 키가 사라질 때). */
  forget(cameraKey: string): void {
    this.cameras.delete(cameraKey);
  }
}

/** 레지스트리 루트를 훑어 타일 그룹을 만든다. 발견 프레임에만 돈다. */
function discoverTiles(scratchBox: Box3): TerrainLodTile[] {
  const groups = new Map<
    string,
    {
      errors: number[];
      levels: Object3D[][];
      lod0: Object3D[];
      dynamic: boolean;
    }
  >();

  modelObjectRegistry.forEachRoot((root) => {
    root.traverse((object) => {
      const carrierKey = lodCarrierKey(object.userData);
      if (carrierKey === null) return;
      // 캐리어 안에 캐리어가 중첩될 일은 없지만(스크립트 산출 구조), 조상이
      // 이미 캐리어면 중복 그룹핑을 막는다.
      for (let p = object.parent; p; p = p.parent) {
        if (isLodCarrier(p)) return;
      }
      const data = object.userData as { lod: number; lodError?: number };
      const key = `${root.uuid}:${carrierKey}`;
      let group = groups.get(key);
      if (!group) {
        group = {
          errors: [],
          levels: [],
          lod0: [],
          dynamic: carrierKey.startsWith('group:'),
        };
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

    // 모델 그룹의 반경 — LOD0 AABB 반대각 절반(월드 스케일 포함). 앵커는
    // 첫 LOD0 노드(모델 하나의 프리미티브 노드).
    const size = new Vector3();
    box.getSize(size);
    tiles.push({
      errors: group.errors.slice(0, usable) as number[],
      levels: group.levels.slice(0, usable),
      box,
      dynamic: group.dynamic
        ? { anchor: group.lod0[0], radius: size.length() / 2 }
        : null,
    });
  }
  return tiles;
}
