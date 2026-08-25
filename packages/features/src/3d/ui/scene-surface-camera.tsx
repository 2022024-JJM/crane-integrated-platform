import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  Plane,
  Raycaster,
  Vector2,
  Vector3,
  type Camera,
  type Object3D,
} from 'three';
import {
  SEA_LEVEL_Y,
  modelObjectRegistry,
  resolveEnvironmentFileUrl,
} from '@crane/domain/3d';

/**
 * 구글 어스식 카메라 줌 — 표면 기준 dolly + 표면 피벗.
 *
 * OrbitControls의 zoomToCursor는 휠 한 틱에 **추상 타깃까지의 반경**을 5%
 * 줄이고 그만큼 카메라를 커서 방향으로 옮긴다. minDistance도 그 반경 기준이다.
 * 씬 JSON 타깃이 지하(philly y=-235, goliath y=-343)라 크레인 근처에선 타깃이
 * 크레인 뒤 수백 m에 있어 카메라가 크레인 안까지 들어가도 안 멈추고, 반경이
 * 팬·회전·줌마다 바뀌어 틱당 체감 비율이 제멋대로였다.
 *
 * 구글 어스의 규칙을 옮긴다:
 * 1. 줌은 **커서 아래 표면 지점**을 향한다 — 카메라가 커서 레이를 따라 이동.
 * 2. 한 틱의 이동량은 **그 지점까지 거리의 일정 비율** — 멀면 크게, 가까우면
 *    작게(로그 스케일 체감). 마우스 1노치 ≈ 10%.
 * 3. 표면과의 **최소 거리**를 지킨다 — 표면을 뚫거나 안으로 들어가지 않는다.
 * 4. 이동이 **부드럽게 감속**한다(지수 easing).
 * 5. 회전의 피벗은 **화면 중앙의 표면 지점**이다 — 타깃을 forward 축 위 표면
 *    거리로 옮기므로 화면은 변하지 않고 궤도 중심·툴바 줌 버튼 기준만 바뀐다.
 *
 * OrbitControls는 회전·팬만 담당한다(enableZoom=false). 그래서 터치 핀치 줌은
 * 빠진다 — 관제·에디터 모두 데스크톱 조작이라 받아들였고, 필요하면 여기에
 * 핀치를 붙인다(휠 경로와 같은 dolly).
 *
 * 표면 레이캐스트 대상은 modelObjectRegistry 루트(지도·모델·텍스트)다. 씬 전체를
 * 쏘면 에디터 TransformControls의 보이지 않는 picker 평면·충돌가드 링까지
 * 맞는다. 히트가 없으면 바다 씬에서는 수면(SEA_LEVEL_Y) 평면, 그것도 없으면
 * 화면 중앙 표면 거리 → 타깃 거리 순으로 폴백한다.
 */

/** 표면(커서 아래 지점)에서 이만큼까지만 다가간다. 크레인 50~100m 씬 기준. */
const MIN_SURFACE_DISTANCE = 60;
/** 표면에서 이만큼 이상 멀어지지 않는다 — OrbitControls maxDistance와 동일. */
const MAX_SURFACE_DISTANCE = 3000;
/** deltaY → 배율. 마우스 1노치(deltaY≈100)가 ×0.9(10%)가 되게 잡았다. */
const ZOOM_SENSITIVITY = Math.log(1 / 0.9) / 100;
/** 한 이벤트의 배율 상·하한 — 트랙패드 폭주 방지. */
const ZOOM_FACTOR_MIN = 0.5;
const ZOOM_FACTOR_MAX = 2;
/** easing 시상수(초). 작을수록 즉각적, 클수록 미끄러진다. */
const ZOOM_EASE_TAU = 0.12;
/** 남은 이동이 이보다 작으면 마무리한다(월드 unit). */
const ZOOM_SETTLE_EPS = 0.01;
/** deltaMode=1(줄 단위) 휠을 픽셀로 환산. */
const WHEEL_LINE_PX = 16;
/** 이보다 가까운 히트는 피벗으로 쓰지 않는다(카메라가 모델 안에 있을 때). */
const RAYCAST_NEAR = 1;

interface OrbitControlsLike {
  enabled: boolean;
  target: Vector3;
  update: () => void;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
}

const raycaster = new Raycaster();
raycaster.near = RAYCAST_NEAR;
const ndc = new Vector2();
const forward = new Vector3();
const planeHit = new Vector3();
const surfacePlane = new Plane();
const roots: Object3D[] = [];

/** 레이 방향으로 가장 가까운 표면까지의 거리. 없으면 null. */
function surfaceDistance(fallbackPlaneY: number | null): number | null {
  roots.length = 0;
  modelObjectRegistry.forEachRoot((object) => {
    roots.push(object);
  });
  const hits = raycaster.intersectObjects(roots, true);
  if (hits.length > 0) return hits[0].distance;

  if (fallbackPlaneY !== null) {
    surfacePlane.set(new Vector3(0, 1, 0), -fallbackPlaneY);
    const point = raycaster.ray.intersectPlane(surfacePlane, planeHit);
    if (point) {
      const d = point.distanceTo(raycaster.ray.origin);
      if (d >= RAYCAST_NEAR) return d;
    }
  }
  return null;
}

/** 화면 중앙 forward 레이로 본 표면 거리. */
function centerSurfaceDistance(
  camera: Camera,
  fallbackPlaneY: number | null,
): number | null {
  camera.getWorldDirection(forward);
  raycaster.set(camera.position, forward);
  return surfaceDistance(fallbackPlaneY);
}

/**
 * 타깃을 화면 중앙 표면 지점으로 옮긴다(구글 어스 5). forward 축 위에서 거리만
 * 바뀌므로 lookAt 결과가 같다 — 화면은 변하지 않는다.
 */
function placePivot(
  camera: Camera,
  controls: OrbitControlsLike,
  fallbackPlaneY: number | null,
  lastPivot: Vector3,
): boolean {
  const dist = centerSurfaceDistance(camera, fallbackPlaneY);
  if (dist === null) return false;
  controls.target.copy(camera.position).addScaledVector(forward, dist);
  lastPivot.copy(controls.target);
  return true;
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

interface DollyState {
  /** 커서 레이 방향으로 남은 이동 거리(부호 있음, +면 표면 쪽). */
  pending: number;
  dir: Vector3;
  /** OrbitControls start~end 사이(드래그 중). 이 동안은 피벗을 옮기지 않는다. */
  interacting: boolean;
  /** 마운트 후 첫 피벗 배치 성공 여부 — 지도 GLB 로드를 기다린다. */
  pivotReady: boolean;
  /** 마지막으로 우리가 놓은 타깃. 다른 코드가 타깃을 옮겼는지 판별. */
  lastPivot: Vector3;
}

export function SceneSurfaceCamera({
  regionId,
  environmentId,
}: {
  regionId: string;
  environmentId?: string | null;
}) {
  // 바다(EXR 배경) 씬이면 히트가 없을 때 수면 평면으로 폴백한다.
  const fallbackPlaneY =
    resolveEnvironmentFileUrl(regionId, environmentId) !== null
      ? SEA_LEVEL_Y
      : null;
  const fallbackRef = useRef(fallbackPlaneY);
  useEffect(() => {
    fallbackRef.current = fallbackPlaneY;
  }, [fallbackPlaneY]);

  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as OrbitControlsLike | null;

  const stateRef = useRef<DollyState>({
    pending: 0,
    dir: new Vector3(),
    interacting: false,
    pivotReady: false,
    lastPivot: new Vector3(),
  });

  // 휠 → 표면 기준 dolly 목표 누적(구글 어스 1~3).
  useEffect(() => {
    if (!controls) return;
    const element = gl.domElement;
    const state = stateRef.current;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (!controls.enabled) return;

      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      ndc.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      const cursorDir = raycaster.ray.direction.clone();

      // 커서 아래 표면 → 없으면(하늘) 화면 중앙 표면 → 그것도 없으면 타깃 거리.
      const dist =
        surfaceDistance(fallbackRef.current) ??
        centerSurfaceDistance(camera, fallbackRef.current) ??
        camera.position.distanceTo(controls.target);

      const deltaY =
        event.deltaMode === 1 ? event.deltaY * WHEEL_LINE_PX : event.deltaY;
      const factor = clamp(
        Math.exp(-deltaY * ZOOM_SENSITIVITY),
        ZOOM_FACTOR_MIN,
        ZOOM_FACTOR_MAX,
      );

      // 아직 적용 안 된 이동(pending)을 반영한 거리에서 목표를 잡아야 연속
      // 휠에서도 한 틱당 비율이 같다.
      const effective = Math.max(MIN_SURFACE_DISTANCE, dist - state.pending);
      const goal = clamp(
        effective * factor,
        MIN_SURFACE_DISTANCE,
        MAX_SURFACE_DISTANCE,
      );
      state.dir.copy(cursorDir);
      state.pending += effective - goal;
    };

    element.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      element.removeEventListener('wheel', onWheel);
    };
  }, [gl, camera, controls]);

  // 표면 피벗(구글 어스 5): 드래그 시작 시, 그리고 다른 코드(reset/top view/팬
  // 관성)가 타깃을 옮긴 뒤.
  useEffect(() => {
    if (!controls) return;
    const state = stateRef.current;

    const onStart = () => {
      state.interacting = true;
      if (state.pending === 0) {
        placePivot(camera, controls, fallbackRef.current, state.lastPivot);
      }
    };
    const onEnd = () => {
      state.interacting = false;
    };
    const onChange = () => {
      if (state.interacting || state.pending !== 0 || !controls.enabled) return;
      // 회전 관성은 타깃을 움직이지 않으므로 여기 걸리지 않는다 — 매 프레임
      // 피벗을 옮기면 반경이 변해 각속도가 흔들린다.
      if (controls.target.distanceToSquared(state.lastPivot) < 1e-6) return;
      placePivot(camera, controls, fallbackRef.current, state.lastPivot);
    };

    controls.addEventListener('start', onStart);
    controls.addEventListener('end', onEnd);
    controls.addEventListener('change', onChange);
    return () => {
      controls.removeEventListener('start', onStart);
      controls.removeEventListener('end', onEnd);
      controls.removeEventListener('change', onChange);
    };
  }, [camera, controls]);

  // 프레임: 첫 피벗 배치(지도 로드 대기) + dolly easing(구글 어스 4).
  useFrame((_, delta) => {
    if (!controls) return;
    const state = stateRef.current;

    if (!state.pivotReady && controls.enabled) {
      state.pivotReady = placePivot(
        camera,
        controls,
        fallbackRef.current,
        state.lastPivot,
      );
    }

    if (state.pending === 0) return;

    let step = state.pending * (1 - Math.exp(-delta / ZOOM_EASE_TAU));
    if (Math.abs(state.pending - step) < ZOOM_SETTLE_EPS) {
      step = state.pending;
    }

    // 시선이 돌지 않게 타깃을 카메라 앞 같은 반경에 유지한다(OrbitControls의
    // screenSpacePanning 줌과 같은 원리). update()가 change를 발행해 에디터
    // 카메라 상태·줌 % 표시가 따라온다.
    const radius = camera.position.distanceTo(controls.target);
    camera.position.addScaledVector(state.dir, step);
    state.pending -= step;
    camera.getWorldDirection(forward);
    controls.target.copy(camera.position).addScaledVector(forward, radius);
    state.lastPivot.copy(controls.target);
    controls.update();

    if (state.pending === 0) {
      placePivot(camera, controls, fallbackRef.current, state.lastPivot);
    }
  });

  return null;
}
