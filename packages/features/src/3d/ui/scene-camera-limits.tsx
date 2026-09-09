import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  Box3,
  PerspectiveCamera,
  Vector3,
  type Camera,
  type Object3D,
} from 'three';
import {
  SEA_LEVEL_Y,
  modelObjectRegistry,
  raycastMapSurfaceY,
  resolveGroundMap,
  type SavedMapInfo,
  type SavedSceneInfo,
} from '@crane/domain/3d';
import {
  CAMERA_GROUND_CLEARANCE,
  CAMERA_MAX_DISTANCE,
  CAMERA_MAX_POLAR_ANGLE,
  clampToBoundsXZ,
  maxDistanceForBounds,
  maxPolarAngleForMinY,
} from '../lib/camera-limits';

/**
 * 궤도 카메라 이동 범위 제한 — 모니터링·리플레이·에디터 세 화면 공용.
 * 수식은 lib/camera-limits.ts, 여기는 OrbitControls 에 매 프레임 적용만 한다.
 *
 * 세 가지를 건다.
 * 1. 바닥: 카메라 y ≥ 카메라 아래 지도 표면 + 여유. 표면은 씬의 모든 지도에
 *    아래 방향 raycast(raycastMapSurfaceY, BVH 가속)로 잡고 카메라 XZ 가
 *    FLOOR_SAMPLE_STEP 이상 움직인 프레임에만 다시 잰다. 히트가 없으면
 *    해수면(SEA_LEVEL_Y). 처음엔 해수면 고정 평면이었는데 philly 조선소
 *    지면이 y≈3.5~5 라 카메라가 지면 밑에서 지도를 뒤집어 봤다. 회전은
 *    maxPolarAngle 을 "카메라 y 가 하한에 닿는 극각"으로 매 프레임 갱신해
 *    막고(궤도 반경·타깃 높이에 따라 달라 상수로 둘 수 없다), 팬은 극각으로
 *    못 막으니 아래 3 의 방식으로 막는다. EXR 배경 유무와 무관하게 모든 씬에
 *    적용한다(옛 CameraAboveSea 흡수). 극각엔 고정 상한(CAMERA_MAX_POLAR_ANGLE)
 *    도 함께 건다. minPolarAngle 은 0(정수직 탑뷰 허용).
 * 2. 이동 범위: **카메라**(타깃이 아니라) XZ 를 바닥 지도(resolveGroundMap)
 *    bounds 안에 둔다. 여유·여백 비율은 두지 않는다 — 지도가 작업 구역보다
 *    훨씬 넓은 씬에서 어느 쪽으로 두든 의미가 어긋났다. 타깃 기준이 아닌
 *    이유 — SceneSurfaceCamera 가 드래그 시작마다 타깃을 화면 중앙 표면점
 *    (컨텍스트 지형·바다 포함, 지도 밖 수 km 가능)으로 옮기므로, 타깃을 되밀면
 *    드래그마다 카메라가 km 단위로 튄다.
 * 3. 최대 궤도 반경: 지도 탑뷰 fit 거리 × CAMERA_MAX_DISTANCE_RATIO 를
 *    controls.maxDistance 에 쓴다(지도 없으면 3000). OrbitControls 의 반경
 *    clamp, SceneSurfaceCamera 의 휠 dolly 상한·표면 피벗 거리 cap, 뷰어·
 *    에디터 탑뷰 높이가 이 값을 함께 읽는다.
 *
 * 위반 처리 — "되밀기"가 아니라 "그 프레임의 이동 취소". OrbitControls 의
 * update(useFrame −1)와 SceneSurfaceCamera(0)가 카메라를 옮긴 뒤 이 컴포넌트
 * (0, 마운트 순서상 그 다음)가 결과를 본다. 카메라·타깃이 **같은 벡터로**
 * 움직였으면(팬, 휠 dolly — 회전은 타깃이 안 움직이고 표면 피벗은 카메라가 안
 * 움직인다) 순수 평행이동이므로, 범위를 벗어났을 때 그 델타를 둘에서 빼서
 * 이동 전 자세로 되돌린다. 카메라는 경계에서 그냥 멈추고, 옛 방식(경계 안으로
 * 투영해 벽을 따라 미끄러뜨림·바닥 아래면 들어 올림)의 "끌려가는" 느낌이
 * 없다. 그래도 벗어나 있으면(회전으로 바닥 아래, 로드 직후·북마크·reset 으로
 * 밖에 놓인 자세 — 이런 명령은 프레임 밖에서 update() 를 부르므로 이 프레임
 * 델타가 0 이라 자동으로 여기로 온다) 그때만 경계로 투영한다.
 *
 * 되돌린 뒤 controls.update() 를 부르지 않는다 — damping 이 켜진 update 는
 * 호출마다 sphericalDelta·panOffset 의 12% 를 적용하므로 두 번 부르면 회전이
 * 두 배 속도가 된다. update 는 매 호출 position−target 에서 spherical 을
 * 다시 계산하므로 둘을 같은 벡터로 옮겨 두면 다음 update 가 저항 없이
 * 이어진다(남은 panOffset 은 매 프레임 취소되며 0.88ⁿ 으로 소멸). 대신 옮긴
 * 프레임엔 change 이벤트만 발행한다 — drei 가 invalidate 와 onChange 를 호출해
 * 에디터의 카메라 상태(cameraStateRef)가 제한된 값으로 저장된다.
 *
 * controls.enabled 로 게이트하지 않는다. 기즈모 드래그 중엔 카메라가 정지라
 * no-op 이고, 충돌가드 비행은 매 프레임 절대값 대입이라 싸우지 않는다.
 *
 * 지도 bounds 캐시는 (resolveGroundMap 항목 참조, 레지스트리 객체 참조,
 * camera.aspect) 셋 중 하나가 바뀐 프레임에만 다시 계산한다 — 지도 추가·
 * 삭제·교체, 기즈모 커밋(항목 참조 변경), 레지스트리 재등록, 리사이즈를
 * 전부 덮고 폴링이 없다. 로드 전·지도 없는 씬(dock-in)은 bounds 가 null 이라
 * 이동·반경 제한이 없고 바닥(해수면)만 걸린다.
 *
 * 알려진 한계(v1): 카메라가 지도 경계선 위까지는 갈 수 있으므로 그 자리에서
 * 바깥을 보면 지도 밖이 조금 보인다 — 극각 상한이 그 시선을 눕지 못하게 막는
 * 것이 실질적인 방어선이다. 고정 극각 상한 때문에 크레인 상부를 피벗으로 지상에서 올려다보는 구도도
 * 불가하다. 지도 표면은 위에서 쏜 첫 히트라 지도 GLB 에 구운 건물 지붕 위로도
 * 카메라가 올라간다.
 */

interface OrbitControlsLike {
  target: Vector3;
  maxPolarAngle: number;
  maxDistance: number;
  dispatchEvent: (event: { type: 'change' }) => void;
}

interface LimitCache {
  mapInfo: SavedMapInfo | null;
  mapObject: Object3D | null;
  aspect: number;
  bounds: Box3 | null;
  /** 마지막으로 잰 바닥 y 와 그때의 카메라 XZ. */
  floorY: number;
  floorX: number;
  floorZ: number;
  floorMaps: SavedMapInfo[] | null | undefined;
  /** 이 프레임 update 직전의 자세(useFrame −2 에서 저장). */
  prevPosition: Vector3;
  prevTarget: Vector3;
  hasPrev: boolean;
}

/** 카메라 XZ 가 이만큼 움직이면 바닥을 다시 잰다(m). */
const FLOOR_SAMPLE_STEP = 0.5;
/** 카메라·타깃 델타가 이 거리 안에서 같으면 순수 평행이동으로 본다(m). */
const TRANSLATION_EPS = 1e-4;

const CHANGE_EVENT = { type: 'change' } as const;

const cameraDelta = new Vector3();
const targetDelta = new Vector3();

/** 카메라 `aspect`·`fov` — 직교 카메라는 반경 상한을 계산할 수 없어 기본값. */
function perspectiveOf(camera: Camera): { aspect: number; fov: number } {
  if (camera instanceof PerspectiveCamera) {
    return { aspect: camera.aspect, fov: camera.fov };
  }
  return { aspect: 1, fov: 75 };
}

/** (x, z) 아래 지도 표면 중 가장 높은 y. 지도가 없거나 전부 miss 면 해수면. */
function sampleFloorY(
  maps: SavedMapInfo[] | null | undefined,
  x: number,
  z: number,
): number {
  let floor = SEA_LEVEL_Y;
  if (!maps) return floor;
  for (const map of maps) {
    const object = modelObjectRegistry.get(map.id);
    if (!object) continue;
    const y = raycastMapSurfaceY(object, x, z);
    if (y !== null && y > floor) floor = y;
  }
  return floor;
}

export function SceneCameraLimits({
  sceneInfo,
}: {
  sceneInfo: SavedSceneInfo | null | undefined;
}) {
  const get = useThree((s) => s.get);

  const sceneInfoRef = useRef(sceneInfo);
  useEffect(() => {
    sceneInfoRef.current = sceneInfo;
  }, [sceneInfo]);

  const cacheRef = useRef<LimitCache>({
    mapInfo: null,
    mapObject: null,
    aspect: NaN,
    bounds: null,
    floorY: SEA_LEVEL_Y,
    floorX: NaN,
    floorZ: NaN,
    floorMaps: undefined,
    prevPosition: new Vector3(),
    prevTarget: new Vector3(),
    hasPrev: false,
  });

  // 언마운트 시 제한을 푼다 — 같은 Canvas 에 남는 controls 가 있다면(화면
  // 전환 중) 다음 마운트가 다시 건다.
  useEffect(
    () => () => {
      const controls = get().controls as OrbitControlsLike | null;
      if (!controls) return;
      controls.maxPolarAngle = Math.PI;
      controls.maxDistance = CAMERA_MAX_DISTANCE;
    },
    [get],
  );

  // update 직전: 자세 저장 + 회전 clamp(camera.y = target.y + dist·cos φ ≥
  // 바닥 이 되는 φ 상한과 고정 상한 중 작은 쪽). 바닥은 지난 프레임에 잰 값 —
  // 회전으로 XZ 가 조금 움직여 생기는 오차는 아래 투영이 받는다.
  useFrame((state) => {
    const controls = state.controls as OrbitControlsLike | null;
    if (!controls) return;
    const cache = cacheRef.current;
    cache.prevPosition.copy(state.camera.position);
    cache.prevTarget.copy(controls.target);
    cache.hasPrev = true;

    const dist = state.camera.position.distanceTo(controls.target);
    controls.maxPolarAngle = Math.min(
      CAMERA_MAX_POLAR_ANGLE,
      maxPolarAngleForMinY(
        controls.target.y,
        dist,
        cache.floorY + CAMERA_GROUND_CLEARANCE,
      ),
    );
  }, -2);

  // update·표면 카메라 뒤: 범위 밖이면 이 프레임의 평행이동을 취소하고, 그래도
  // 밖이면 경계로 투영한다.
  useFrame((state) => {
    const controls = state.controls as OrbitControlsLike | null;
    if (!controls) return;
    const camera = state.camera;
    const cache = cacheRef.current;
    const maps = sceneInfoRef.current?.maps;

    const mapInfo = resolveGroundMap(maps) ?? null;
    const mapObject = mapInfo
      ? (modelObjectRegistry.get(mapInfo.id) ?? null)
      : null;
    const { aspect, fov } = perspectiveOf(camera);
    if (
      mapInfo !== cache.mapInfo ||
      mapObject !== cache.mapObject ||
      aspect !== cache.aspect
    ) {
      cache.mapInfo = mapInfo;
      cache.mapObject = mapObject;
      cache.aspect = aspect;
      const bounds = mapObject ? new Box3().setFromObject(mapObject) : null;
      cache.bounds = bounds && !bounds.isEmpty() ? bounds : null;
      controls.maxDistance = maxDistanceForBounds(cache.bounds, aspect, fov);
      // 지도가 바뀌면 바닥도 다시 잰다.
      cache.floorX = NaN;
    }

    const refreshFloor = () => {
      const { x, z } = camera.position;
      if (
        maps === cache.floorMaps &&
        Math.abs(x - cache.floorX) < FLOOR_SAMPLE_STEP &&
        Math.abs(z - cache.floorZ) < FLOOR_SAMPLE_STEP
      ) {
        return;
      }
      cache.floorMaps = maps;
      cache.floorX = x;
      cache.floorZ = z;
      cache.floorY = sampleFloorY(maps, x, z);
    };

    /** 현재 카메라 위치가 범위 밖인가. */
    const violation = () => {
      refreshFloor();
      if (camera.position.y < cache.floorY + CAMERA_GROUND_CLEARANCE) {
        return true;
      }
      if (!cache.bounds) return false;
      const delta = clampToBoundsXZ(
        camera.position.x,
        camera.position.z,
        cache.bounds,
      );
      return delta !== null && (delta.dx !== 0 || delta.dz !== 0);
    };

    if (!violation()) {
      cache.hasPrev = false;
      return;
    }

    let moved = false;

    // 1) 순수 평행이동(팬·dolly)이면 취소 — 경계에서 그냥 멈춘다.
    if (cache.hasPrev) {
      cameraDelta.subVectors(camera.position, cache.prevPosition);
      targetDelta.subVectors(controls.target, cache.prevTarget);
      if (
        cameraDelta.lengthSq() > 0 &&
        cameraDelta.distanceToSquared(targetDelta) <
          TRANSLATION_EPS * TRANSLATION_EPS
      ) {
        camera.position.copy(cache.prevPosition);
        controls.target.copy(cache.prevTarget);
        moved = true;
      }
    }
    cache.hasPrev = false;

    // 2) 그래도 밖이면(회전·프레임 밖 명령·로드 직후) 경계로 투영한다.
    if (violation()) {
      if (cache.bounds) {
        const delta = clampToBoundsXZ(
          camera.position.x,
          camera.position.z,
          cache.bounds,
        );
        if (delta && (delta.dx !== 0 || delta.dz !== 0)) {
          camera.position.x += delta.dx;
          camera.position.z += delta.dz;
          controls.target.x += delta.dx;
          controls.target.z += delta.dz;
          moved = true;
        }
      }
      refreshFloor();
      const minY = cache.floorY + CAMERA_GROUND_CLEARANCE;
      if (camera.position.y < minY) {
        const lift = minY - camera.position.y;
        camera.position.y += lift;
        controls.target.y += lift;
        moved = true;
      }
    }

    if (moved) controls.dispatchEvent(CHANGE_EVENT);
  });

  return null;
}
