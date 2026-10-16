import { useThree } from '@react-three/fiber';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { OrthographicCamera, PerspectiveCamera, type Camera } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import {
  PERSPECTIVE_FOV_USER_DATA_KEY,
  TOP_VIEW_POLAR_ANGLE,
  computeTopViewEntryPose,
  computeTopViewExitPose,
  ensureTopViewTilt,
  orthoHalfHeightForDistance,
  resolveCameraFov,
  setOrthoFrustum,
  type CameraPose,
} from '@crane/core/lib/top-view-pose';
import type { Vector3Tuple } from '@crane/core/types/math';

/**
 * 직교 탑뷰 카메라의 near. 카메라는 "같은 구도의 원근 카메라가 있을 높이"
 * (타깃 + 거리)에 서므로 바짝 확대하면 크레인 상부가 카메라보다 높다 —
 * 평면도에는 그것도 보여야 하니 near 를 음수로 두어 카메라 뒤(위)까지
 * 그린다. 구조물 높이보다 훨씬 큰 값이면 되고, far 와의 합이 깊이 범위라
 * 너무 크면 정밀도가 준다(직교 깊이는 선형).
 */
const TOP_VIEW_ORTHO_NEAR = -5000;

interface OrthoTopViewOptions {
  /** 캔버스의 OrbitControls — 카메라 교체 때 drei 가 다시 만든 인스턴스를 본다. */
  controlsRef: RefObject<OrbitControlsImpl | null>;
  /** 직교 카메라 far — 원근 카메라와 같은 값. */
  far: number;
  /**
   * 포즈가 적용될 때마다(진입·복귀·applyPose) 실제 적용된 자세. 에디터가
   * 카메라 상태 ref 를 갱신한다 — OrbitControls change 이벤트는 프레임
   * 밖 명령에선 오지 않을 수 있다.
   */
  onPoseApplied?: (pose: CameraPose) => void;
  /** 활성 카메라가 바뀔 때(교체·복원). 드롭·마퀴 레이캐스트의 카메라 ref. */
  onCameraChange?: (camera: Camera) => void;
}

export interface OrthoTopViewHandle {
  /** 탑뷰 중인지 — 버튼 눌림 표시용 React 상태. */
  active: boolean;
  /** 렌더 밖(콜백)에서 읽는 현재 상태. */
  isActive: () => boolean;
  /** 탑뷰 진입 / "지금 보는 곳 기준" 복귀. */
  toggle: () => void;
  /** 탑뷰 진입만 — 이미 탑뷰면 no-op. */
  enter: () => void;
  /**
   * 원근으로 복귀. `pose` 를 주면 계산한 복귀 포즈 대신 그 구도로 간다(메인
   * 뷰·저장한 뷰·영역 보기). 탑뷰가 아니면 no-op.
   */
  exit: (pose?: CameraPose) => void;
  /**
   * 현재 모드를 유지한 채 포즈 적용. 직교면 거리로 프러스텀을 다시 잡는다
   * (줌 버튼·F 포커스·미니맵 팬).
   */
  applyPose: (position: Vector3Tuple, target: Vector3Tuple) => void;
  /** 탑뷰면 그 구도로 복귀, 아니면 applyPose — 카메라를 옮기는 명령의 기본 경로. */
  moveTo: (position: Vector3Tuple, target: Vector3Tuple) => void;
}

function isOrtho(camera: Camera): camera is OrthographicCamera {
  return (camera as OrthographicCamera).isOrthographicCamera === true;
}

/**
 * 직교 탑뷰 토글 — 뷰어(ThreeSceneViewer)와 에디터 캔버스가 같은 훅을 쓴다.
 * Canvas 안에서만 부른다(useThree).
 *
 * 동작:
 * - 진입: 현재 OrbitControls 포즈를 저장하고, 같은 거리로 타깃 위에 선 직교
 *   카메라(보던 방향이 화면 위, core computeTopViewEntryPose)를 R3F 기본
 *   카메라로 교체한다. drei OrbitControls 는 기본 카메라가 바뀌면 인스턴스를
 *   새로 만들므로, 교체가 커밋된 뒤(useLayoutEffect) 새 컨트롤에 포즈를
 *   적용하고 극각을 TOP_VIEW_POLAR_ANGLE 로 잠근다(방위 회전만 남는다).
 * - 프러스텀: zoom 1, 반높이 = 거리×tan(원근 fov/2). `manual` 을 켜 R3F
 *   리사이즈가 픽셀 프러스텀으로 덮어쓰지 않게 하고, 리사이즈는 여기서
 *   종횡비만 다시 쓴다. 휠 줌(features SceneSurfaceCamera)은 프러스텀과
 *   포즈를 같은 배율로 키우고, 표면 피벗이 타깃 거리를 조금 바꿔도 프러스텀은
 *   건드리지 않는다 — 프러스텀은 명시적 줌·포즈 적용에서만 바뀐다.
 * - 복귀: 저장한 원근 오프셋을 탑뷰에서 돌린 방위·현재 거리로 옮겨 현재
 *   타깃에 붙인다(core computeTopViewExitPose). 원근 카메라를 되돌리고
 *   새 컨트롤에 그 포즈를 적용한다.
 *
 * 카메라 객체의 자세는 교체 시점에 바로 써 둔다 — 컨트롤 적용은 effect 라
 * 그 사이 프레임이 그려져도 낡은 자세가 보이지 않는다.
 */
export function useOrthoTopView({
  controlsRef,
  far,
  onPoseApplied,
  onCameraChange,
}: OrthoTopViewOptions): OrthoTopViewHandle {
  const set = useThree((state) => state.set);
  const get = useThree((state) => state.get);
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const invalidate = useThree((state) => state.invalidate);

  const orthoRef = useRef<OrthographicCamera | null>(null);
  const perspectiveRef = useRef<PerspectiveCamera | null>(null);
  const savedPoseRef = useRef<CameraPose | null>(null);
  const pendingPoseRef = useRef<CameraPose | null>(null);
  // 교체 직전 컨트롤의 반경 제한 — drei 가 새로 만든 컨트롤은 prop 초기값
  // (뷰어 3000·에디터 30000)으로 돌아가고 SceneCameraLimits 는 다음 프레임에야
  // 덮어쓰므로, 그 사이의 update() 가 반경을 초기값으로 잘라 포즈가 튄다.
  const pendingLimitsRef = useRef<{
    minDistance: number;
    maxDistance: number;
  } | null>(null);
  const activeRef = useRef(false);
  const [active, setActive] = useState(false);

  const onPoseAppliedRef = useRef(onPoseApplied);
  const onCameraChangeRef = useRef(onCameraChange);
  useEffect(() => {
    onPoseAppliedRef.current = onPoseApplied;
    onCameraChangeRef.current = onCameraChange;
  }, [onCameraChange, onPoseApplied]);

  const aspectOf = useCallback(() => {
    const { width, height } = get().size;
    return height > 0 ? width / height : 1;
  }, [get]);

  // 포즈를 현재 컨트롤·카메라에 적용. 정수직 입력은 정규 tilt 로(up=+Y 규약).
  // 감쇠를 잠시 끄고 update() 한다 — 켠 채로 부르면 직전 드래그의 잔여
  // 관성이 이후 프레임에 계속 적용돼 방금 맞춘 포즈가 흘러간다.
  const applyPose = useCallback(
    (position: Vector3Tuple, target: Vector3Tuple) => {
      const controls = controlsRef.current;
      if (!controls) return;
      const cam = controls.object;
      cam.position.fromArray(ensureTopViewTilt(position, target));
      controls.target.fromArray(target);
      cam.lookAt(controls.target);

      const previousDamping = controls.enableDamping;
      controls.enableDamping = false;
      controls.update();
      controls.enableDamping = previousDamping;

      // 직교면 update() 가 반경을 clamp 한 뒤의 실제 거리로 프러스텀을 잡는다.
      if (isOrtho(cam)) {
        const fov = resolveCameraFov(cam);
        if (fov !== null) {
          setOrthoFrustum(
            cam,
            orthoHalfHeightForDistance(
              cam.position.distanceTo(controls.target),
              fov,
            ),
            aspectOf(),
          );
        }
      }

      onPoseAppliedRef.current?.({
        position: cam.position.toArray(),
        target: controls.target.toArray(),
      });
      invalidate();
    },
    [aspectOf, controlsRef, invalidate],
  );

  const enter = useCallback(() => {
    const controls = controlsRef.current;
    if (!controls || activeRef.current) return;
    const cam = controls.object;
    if (!(cam instanceof PerspectiveCamera)) return;

    const current: CameraPose = {
      position: cam.position.toArray(),
      target: controls.target.toArray(),
    };
    savedPoseRef.current = current;
    perspectiveRef.current = cam;

    const ortho =
      orthoRef.current ??
      (orthoRef.current = new OrthographicCamera(
        -1,
        1,
        1,
        -1,
        TOP_VIEW_ORTHO_NEAR,
        far,
      ));
    ortho.near = TOP_VIEW_ORTHO_NEAR;
    ortho.far = far;
    ortho.zoom = 1;
    ortho.up.set(0, 1, 0);
    ortho.layers.mask = cam.layers.mask;
    ortho.userData[PERSPECTIVE_FOV_USER_DATA_KEY] = cam.fov;
    // R3F updateCamera 가 리사이즈마다 픽셀 프러스텀으로 덮어쓰지 않게.
    (ortho as Camera & { manual?: boolean }).manual = true;

    const entry = computeTopViewEntryPose(current.position, current.target);
    ortho.position.fromArray(entry.position);
    ortho.lookAt(entry.target[0], entry.target[1], entry.target[2]);
    setOrthoFrustum(
      ortho,
      orthoHalfHeightForDistance(
        cam.position.distanceTo(controls.target),
        cam.fov,
      ),
      aspectOf(),
    );
    ortho.updateMatrixWorld();

    pendingPoseRef.current = entry;
    pendingLimitsRef.current = {
      minDistance: controls.minDistance,
      maxDistance: controls.maxDistance,
    };
    activeRef.current = true;
    setActive(true);
    set({ camera: ortho });
  }, [aspectOf, controlsRef, far, set]);

  const exit = useCallback(
    (override?: CameraPose) => {
      const controls = controlsRef.current;
      const perspective = perspectiveRef.current;
      const saved = savedPoseRef.current;
      if (!controls || !perspective || !saved || !activeRef.current) return;

      const pose =
        override ??
        computeTopViewExitPose(saved, {
          position: controls.object.position.toArray(),
          target: controls.target.toArray(),
        });
      perspective.position.fromArray(
        ensureTopViewTilt(pose.position, pose.target),
      );
      perspective.lookAt(pose.target[0], pose.target[1], pose.target[2]);
      perspective.updateMatrixWorld();

      savedPoseRef.current = null;
      pendingPoseRef.current = pose;
      pendingLimitsRef.current = {
        minDistance: controls.minDistance,
        maxDistance: controls.maxDistance,
      };
      activeRef.current = false;
      setActive(false);
      set({ camera: perspective });
    },
    [controlsRef, set],
  );

  const toggle = useCallback(() => {
    if (activeRef.current) exit();
    else enter();
  }, [enter, exit]);

  const moveTo = useCallback(
    (position: Vector3Tuple, target: Vector3Tuple) => {
      if (activeRef.current) exit({ position, target });
      else applyPose(position, target);
    },
    [applyPose, exit],
  );

  const isActive = useCallback(() => activeRef.current, []);

  // 카메라 교체가 커밋된 뒤 — drei 가 새 OrbitControls 를 만들어 ref 에 붙인
  // 다음이다. 보류한 포즈를 새 컨트롤에 적용하고 극각 잠금을 맞춘다.
  const flushPending = useCallback(() => {
    const controls = controlsRef.current;
    const pending = pendingPoseRef.current;
    if (!controls || !pending || controls.object !== camera) return;
    pendingPoseRef.current = null;
    const limits = pendingLimitsRef.current;
    pendingLimitsRef.current = null;
    if (limits) {
      controls.minDistance = limits.minDistance;
      controls.maxDistance = limits.maxDistance;
    }
    if (isOrtho(camera)) {
      controls.minPolarAngle = TOP_VIEW_POLAR_ANGLE;
      controls.maxPolarAngle = TOP_VIEW_POLAR_ANGLE;
    } else {
      controls.minPolarAngle = 0;
      controls.maxPolarAngle = Math.PI;
    }
    applyPose(pending.position, pending.target);
  }, [applyPose, camera, controlsRef]);

  useLayoutEffect(() => {
    onCameraChangeRef.current?.(camera);
    flushPending();
  }, [camera, flushPending]);
  // 레이아웃 시점에 컨트롤 ref 가 아직 이전 인스턴스였다면 passive 에서 한 번 더.
  useEffect(() => {
    flushPending();
  }, [flushPending]);

  // 리사이즈 — 세로 범위는 그대로, 가로만 종횡비를 따라간다.
  useEffect(() => {
    const ortho = orthoRef.current;
    if (!ortho || !activeRef.current || camera !== ortho) return;
    setOrthoFrustum(
      ortho,
      ortho.top,
      size.height > 0 ? size.width / size.height : 1,
    );
    invalidate();
  }, [camera, invalidate, size]);

  // 언마운트 — 기본 카메라를 원근으로 되돌려 둔다(같은 Canvas 가 남는 경우).
  useEffect(
    () => () => {
      const perspective = perspectiveRef.current;
      if (activeRef.current && perspective) {
        activeRef.current = false;
        set({ camera: perspective });
      }
    },
    [set],
  );

  return { active, isActive, toggle, enter, exit, applyPose, moveTo };
}
