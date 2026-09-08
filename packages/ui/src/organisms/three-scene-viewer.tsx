import { OrbitControls } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import {
  Binoculars,
  House,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  type ComponentProps,
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Box3, Vector3, type PerspectiveCamera } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useFullscreen } from '@crane/core/lib/use-fullscreen';
import {
  computeTopViewPose,
  ensureTopViewTilt,
} from '@crane/core/lib/top-view-pose';
import { PortalContainerProvider } from '../molecules/portal-container';
import {
  SceneToolbarButton,
  type SceneToolbarTooltipSide,
} from '../molecules/scene-toolbar-button';
import { TooltipProvider } from '../molecules/tooltip';
import {
  SCENE_DOCK_RAIL_COLUMN_WIDTH,
  SCENE_DOCK_RAIL_HANDLE_WIDTH,
  SceneDockRail,
  type SceneDockState,
} from './scene-dock';
import type { Vector3Tuple } from '@crane/core/types/math';

// SCENE_TOOLBAR_BUTTON_CLASS 는 여기서 re-export 하지 않는다. 이 파일은
// three·drei·fiber 를 정적으로 끌어오므로, 상수 하나 때문에 이 경로를 import 한
// 버튼(알람 토글 등)이 로그인 화면까지 3D 런타임을 실었다. 상수는
// `@crane/ui/molecules/scene-toolbar-button` 에서 가져온다.

interface ThreeSceneViewerCameraPreset {
  defaultPosition: Vector3Tuple;
  defaultTarget: Vector3Tuple;
  topViewPosition?: Vector3Tuple;
  topViewTarget?: Vector3Tuple;
  /**
   * 탑뷰가 한 화면에 담을 영역(보통 지도 bounds). 있으면 topViewPosition/
   * Target 대신 이 박스가 세로 fov·종횡비 기준으로 꽉 차는 높이에서
   * 정수직에 가깝게(미세 tilt, @crane/core top-view-pose) 내려다본다.
   * 없거나 비어 있으면 기존 프리셋 경로.
   */
  getTopViewBounds?: () => Box3 | null;
}

interface ThreeSceneViewerProps {
  cameraPreset: ThreeSceneViewerCameraPreset;
  canvasProps?: Omit<ComponentProps<typeof Canvas>, 'camera' | 'children'>;
  /** 카메라 near/far. 미지정 시 far 5000(지도 잘림 방지 최소값). */
  cameraClip?: { near: number; far: number };
  children: ReactNode;
  overlay?: ReactNode;
  fullscreenOverlay?: ReactNode;
  // 전체화면일 때 우측 상단에 떠있는 플로팅 슬롯. 도메인 무관.
  fullscreenTopRightOverlay?: ReactNode;
  // 전체화면일 때 화면 상단 중앙(노치 위치)에 떠있는 슬롯. critical 알림 배너 등.
  fullscreenTopCenterOverlay?: ReactNode;
  // 외부 버튼을 주입하는 슬롯. 도메인 무관. 'bottom-left' 배치에서는 툴바 맨 앞,
  // 'top-right' 배치에서는 카메라 버튼 줄 아래(다음 줄)에 놓인다 — 전체화면
  // 알람 토글처럼 상시 버튼이 아닌 것이 카메라 조작 줄을 밀지 않게 하려는 것.
  toolbarExtras?: ReactNode;
  // 툴바 카메라 버튼들 앞(왼쪽)에 붙는 슬롯. 씬 뷰 북마크 바 등 —
  // 툴바 버튼과 같은 스타일(SCENE_TOOLBAR_BUTTON_CLASS)로 맞추면 한 줄로 이어진다.
  toolbarTrailing?: ReactNode;
  /**
   * 조작 툴바 위치. 기본은 좌측 하단 한 줄. 'top-right' 는 우측 상단에
   * 세로 스택으로 놓고, toolbarExtras 와 전체화면 우측 상단 슬롯을 그 아래
   * 줄에 차례로 쌓는다 (대시보드 미리보기 등). 'dock' 은 툴바를 그리지 않고
   * 카메라 버튼·toolbarExtras·toolbarTrailing 을 우측 독 레일(dockRight)에
   * 세로로 넣는다 (실시간 3D 모니터링 화면). 'none' 은 툴바를 아예 그리지
   * 않는다 (대시보드 미리보기처럼 조작 없이 보기만 하는 작은 뷰).
   */
  toolbarPlacement?: 'bottom-left' | 'top-right' | 'dock' | 'none';
  /**
   * 우측 독 레일 상태 ('dock' 배치에서만). 내용은 카메라 버튼 + toolbarExtras
   * + toolbarTrailing 을 뷰어가 조립한다. 상태는 features 의 useSceneDock 이
   * 소유하고 여기서는 그대로 넘긴다.
   */
  dockRight?: SceneDockState;
  onControllerReady?: (controller: SceneController | null) => void;
}

export interface SceneController {
  reset: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  moveToTopView: () => void;
  moveTo: (position: Vector3Tuple, target: Vector3Tuple) => void;
  getPose: () => { position: Vector3Tuple; target: Vector3Tuple } | null;
}

interface SceneControlsBridgeProps {
  cameraPreset: ThreeSceneViewerCameraPreset;
  onControllerChange: (controller: SceneController | null) => void;
}

const ZOOM_STEP = 1.2;
/**
 * 툴바 줌 버튼의 카메라-타깃 최소 거리. 타깃은 SceneSurfaceCamera(features)가
 * 화면 중앙 표면에 붙여 두므로 "표면까지 60m"가 된다 — 휠 줌의 표면 최소
 * 거리(MIN_SURFACE_DISTANCE)와 같은 값. 크레인 50~100m 씬에서 5·20은 트롤리
 * 안까지 파고들어 60으로 올렸다.
 */
const MIN_CAMERA_DISTANCE = 60;

/**
 * 브라우저가 WebGL을 지원하는지 검사. 모듈 스코프에서 1회만 평가하고
 * 결과를 캐시하여 매 렌더 시 비용 없음.
 */
let cachedWebGLSupport: boolean | null = null;
function isWebGLSupported(): boolean {
  if (cachedWebGLSupport !== null) return cachedWebGLSupport;
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl');
    cachedWebGLSupport = Boolean(gl);
    // 검사용 컨텍스트는 즉시 반납 — 브라우저의 동시 WebGL 컨텍스트
    // 상한(보통 16)을 문서 수명 내내 1개 소모하지 않도록.
    if (gl && 'getExtension' in gl) {
      (gl as WebGLRenderingContext)
        .getExtension('WEBGL_lose_context')
        ?.loseContext();
    }
  } catch {
    cachedWebGLSupport = false;
  }
  return cachedWebGLSupport;
}

function toVector3([x, y, z]: Vector3Tuple) {
  return new Vector3(x, y, z);
}

function SceneControlsBridge({
  cameraPreset,
  onControllerChange,
}: SceneControlsBridgeProps) {
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  const { defaultPosition, defaultTarget } = cameraPreset;
  const defaultDistance = useMemo(() => {
    const distance = toVector3(defaultPosition).distanceTo(
      toVector3(defaultTarget),
    );
    return distance > 0 ? distance : 1;
  }, [defaultPosition, defaultTarget]);
  const topViewTarget = cameraPreset.topViewTarget ?? defaultTarget;
  // 프리셋 폴백은 타깃 정확히 위(정수직)다. 정규 tilt 는 applyCameraState 의
  // ensureTopViewTilt 가 붙인다.
  const topViewPosition = useMemo<Vector3Tuple>(
    () =>
      cameraPreset.topViewPosition ?? [
        topViewTarget[0],
        topViewTarget[1] + defaultDistance,
        topViewTarget[2],
      ],
    [cameraPreset.topViewPosition, defaultDistance, topViewTarget],
  );

  // 카메라 up 은 항상 +Y(three 기본)다. 탑뷰도 up 을 바꾸지 않고 카메라를
  // 미세하게 기울여 만든다 — 이유는 @crane/core top-view-pose 의 TOP_VIEW_TILT
  // 주석. 정수직 포즈(사이트 프리셋·옛 북마크)는 ensureTopViewTilt 로
  // 같은 정규 포즈로 바꿔 lookAt 이 퇴화하지 않게 한다.
  const applyCameraState = useCallback(
    (position: Vector3Tuple, target: Vector3Tuple) => {
      const controls = controlsRef.current;

      if (!controls) {
        return;
      }

      camera.position.fromArray(ensureTopViewTilt(position, target));
      controls.target.fromArray(target);
      camera.lookAt(controls.target);

      // 감쇠(damping)를 잠시 끄고 update() 한다. 켠 채로 부르면 직전 드래그의
      // 잔여 관성이 남아 있다가 이후 프레임에서 계속 적용돼, 방금 맞춘 포즈가
      // 조금씩 흘러간다("리셋을 눌렀는데 카메라가 미끄러진다"). three-stdlib는
      // damping이 꺼져 있을 때만 update()에서 델타를 0으로 리셋한다.
      const previousDamping = controls.enableDamping;
      controls.enableDamping = false;
      controls.update();
      controls.enableDamping = previousDamping;

      invalidate();
    },
    [camera, invalidate],
  );

  const reset = useCallback(() => {
    applyCameraState(defaultPosition, defaultTarget);
  }, [applyCameraState, defaultPosition, defaultTarget]);

  const getTopViewBounds = cameraPreset.getTopViewBounds;
  const moveToTopView = useCallback(() => {
    const bounds = getTopViewBounds?.();
    const perspective = camera as PerspectiveCamera;
    // 지도 XZ가 세로 fov 기준으로 화면에 꽉 차는 높이(편집기와 같은 함수).
    const pose =
      bounds && perspective.isPerspectiveCamera
        ? computeTopViewPose(bounds, perspective.aspect, perspective.fov)
        : null;
    if (pose) {
      applyCameraState(pose.position, pose.target);
      return;
    }
    applyCameraState(topViewPosition, topViewTarget);
  }, [
    applyCameraState,
    camera,
    getTopViewBounds,
    topViewPosition,
    topViewTarget,
  ]);

  const zoomByFactor = useCallback(
    (factor: number) => {
      const controls = controlsRef.current;

      if (!controls) {
        return;
      }

      const nextOffset = camera.position.clone().sub(controls.target);
      const nextDistance = Math.max(
        MIN_CAMERA_DISTANCE,
        nextOffset.length() * factor,
      );

      nextOffset.setLength(nextDistance);
      camera.position.copy(controls.target).add(nextOffset);

      // applyCameraState와 같은 이유로 감쇠를 잠시 끄고 update() 한다 —
      // 잔여 관성이 남으면 줌 버튼으로 맞춘 거리가 이후 프레임에서 흘러간다.
      const previousDamping = controls.enableDamping;
      controls.enableDamping = false;
      controls.update();
      controls.enableDamping = previousDamping;

      invalidate();
    },
    [camera.position, invalidate],
  );

  const zoomIn = useCallback(() => {
    zoomByFactor(1 / ZOOM_STEP);
  }, [zoomByFactor]);

  const zoomOut = useCallback(() => {
    zoomByFactor(ZOOM_STEP);
  }, [zoomByFactor]);

  const moveTo = useCallback(
    (position: Vector3Tuple, target: Vector3Tuple) => {
      applyCameraState(position, target);
    },
    [applyCameraState],
  );

  const getPose = useCallback((): {
    position: Vector3Tuple;
    target: Vector3Tuple;
  } | null => {
    const controls = controlsRef.current;

    if (!controls) {
      return null;
    }

    return {
      position: camera.position.toArray() as Vector3Tuple,
      target: controls.target.toArray() as Vector3Tuple,
    };
  }, [camera]);

  useEffect(() => {
    const controls = controlsRef.current;

    if (!controls) {
      return;
    }

    onControllerChange({
      reset,
      zoomIn,
      zoomOut,
      moveToTopView,
      moveTo,
      getPose,
    });

    reset();

    return () => {
      onControllerChange(null);
    };
  }, [
    onControllerChange,
    reset,
    zoomIn,
    zoomOut,
    moveToTopView,
    moveTo,
    getPose,
  ]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      // 관성 감쇠 — 끄면 드래그를 놓는 즉시 회전이 멈춰 조작이 뚝뚝 끊긴다.
      // 관제 화면에서 마우스 조작은 사용자가 가장 오래 만지는 요소라 체감이 크다.
      // dampingFactor는 drei 기본(0.05)보다 조금 높여 잔여 관성을 짧게 끊는다 —
      // 정밀 배치 작업에서 손을 뗀 뒤에도 계속 흐르면 오히려 방해가 된다.
      enableDamping
      dampingFactor={0.12}
      target={cameraPreset.defaultTarget}
      // 휠 줌은 features의 SceneSurfaceCamera가 맡는다 — 커서 아래 표면을
      // 향해 표면 거리의 일정 비율씩 다가가는 구글 어스식 dolly. OrbitControls의
      // zoomToCursor는 추상 타깃 반경 기준이라 타깃이 지하일 때 지오메트리를
      // 뚫고 들어갔다. 그래서 여기선 줌을 끈다.
      enableZoom={false}
      // 회전/팬 반경 clamp만 — 표면 피벗이 60m보다 가까울 때(경사면·크레인
      // 상부) 튕겨 나가지 않게 낮게 둔다. 확대 하한은 SceneSurfaceCamera가 지킨다.
      minDistance={5}
      // 무한 줌 아웃 방지 — 지도가 점이 되기 전에 멈춘다 (camera far보다 작게)
      maxDistance={3000}
    />
  );
}

export function ThreeSceneViewer({
  cameraPreset,
  canvasProps,
  cameraClip,
  children,
  overlay,
  fullscreenOverlay,
  fullscreenTopRightOverlay,
  fullscreenTopCenterOverlay,
  toolbarExtras,
  toolbarTrailing,
  toolbarPlacement = 'bottom-left',
  dockRight,
  onControllerReady,
}: ThreeSceneViewerProps) {
  const { t } = useTranslation();
  // 전체화면은 문서 전체를 올린다(useFullscreen 주석). 이 뷰어가
  // 켠 동안은 루트를 fixed inset-0 으로 띄워 페이지의 나머지를 덮는다.
  const {
    isFullscreen,
    supported: fullscreenSupported,
    toggleFullscreen,
  } = useFullscreen();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<SceneController | null>(null);

  const setController = useCallback(
    (controller: SceneController | null) => {
      controllerRef.current = controller;
      onControllerReady?.(controller);
    },
    [onControllerReady],
  );

  const showSplitPanel = isFullscreen && fullscreenOverlay;
  const isTopRightToolbar = toolbarPlacement === 'top-right';
  const isDock = toolbarPlacement === 'dock';
  const webglSupported = isWebGLSupported();

  if (!webglSupported) {
    return (
      <div
        ref={rootRef}
        role="alert"
        className="bg-muted/40 relative flex h-full min-h-0 w-full flex-col items-center justify-center gap-2 overflow-hidden p-6 text-center"
      >
        <p className="text-sm font-semibold">
          {t('common:viewer3d.webglUnsupportedTitle', {
            defaultValue: '3D viewer is unavailable',
          })}
        </p>
        <p className="text-muted-foreground max-w-md text-xs">
          {t('common:viewer3d.webglUnsupportedDescription', {
            defaultValue:
              'WebGL is disabled or unsupported in this browser. Enable hardware acceleration or use a recent Chromium-based browser.',
          })}
        </p>
      </div>
    );
  }

  // 툴바 아이콘 순서: 원래위치 / 탑뷰 / 확대 / 축소 / 전체화면.
  // 앞(왼쪽)에는 toolbarTrailing(씬 뷰 북마크 — 저장된 뷰 칩 + 저장 버튼)이 붙어
  // "추가한 뷰들 / 현재 뷰 저장 / 원래위치 / 탑뷰 / 확대 / 축소 / 전체화면"이 된다.
  // 독 레일(세로)에서는 툴팁을 왼쪽으로 연다.
  const tooltipSide: SceneToolbarTooltipSide = isDock
    ? 'left'
    : isTopRightToolbar
      ? 'bottom'
      : 'top';
  const cameraToolbarButtons = (
    <>
      <SceneToolbarButton
        label={t('common:viewer3d.resetView')}
        side={tooltipSide}
        onClick={() => {
          controllerRef.current?.reset();
        }}
      >
        <House />
      </SceneToolbarButton>
      <SceneToolbarButton
        label={t('common:viewer3d.topView')}
        side={tooltipSide}
        onClick={() => {
          controllerRef.current?.moveToTopView();
        }}
      >
        <Binoculars />
      </SceneToolbarButton>
      <SceneToolbarButton
        label={t('common:viewer3d.zoomIn')}
        side={tooltipSide}
        onClick={() => {
          controllerRef.current?.zoomIn();
        }}
      >
        <ZoomIn />
      </SceneToolbarButton>
      <SceneToolbarButton
        label={t('common:viewer3d.zoomOut')}
        side={tooltipSide}
        onClick={() => {
          controllerRef.current?.zoomOut();
        }}
      >
        <ZoomOut />
      </SceneToolbarButton>
      {fullscreenSupported ? (
        <SceneToolbarButton
          label={
            isFullscreen
              ? t('common:viewer3d.exitFullscreen')
              : t('common:viewer3d.fullscreen')
          }
          side={tooltipSide}
          onClick={toggleFullscreen}
        >
          {isFullscreen ? <Minimize2 /> : <Maximize2 />}
        </SceneToolbarButton>
      ) : null}
    </>
  );

  // 독 배치의 기하. 미고정 독은 핸들만큼 캔버스 가장자리를 덮으므로 캔버스
  // 영역의 오버레이(충돌 도움말·알람 패널 등)가 그만큼 안쪽으로 비켜야 한다
  // — CSS 변수 --dock-right-inset 으로 알려 준다.
  // 고정 독은 캔버스 밖 placeholder 가 자리를 차지하므로 inset 0.
  const rightDockPinned = isDock && dockRight?.pinned === true;
  const dockRightInset =
    !isDock || !dockRight
      ? '0px'
      : rightDockPinned
        ? '0px'
        : SCENE_DOCK_RAIL_HANDLE_WIDTH;

  return (
    <div
      ref={rootRef}
      className={
        isFullscreen
          ? // 전체화면 — 페이지 슬롯을 떠나 뷰포트를 채운다. z 는 base-ui 포털
            // (z-9999)·토스트보다 낮게.
            'bg-background fixed inset-0 z-50 overflow-hidden'
          : 'relative h-full min-h-0 w-full overflow-hidden'
      }
    >
      {/* 툴팁·팝오버·컨텍스트 메뉴·셀렉트를 루트 안에 렌더한다 — overflow-hidden
          에 잘리지 않고 floating-ui가 루트 안쪽으로 밀어준다(프리뷰 모달 180px
          높이에서도 팝오버가 들어간다). 컨테이너를 도중에 바꾸면(body↔root)
          안 된다 — 닫히는 중인 팝업이 새 컨테이너로 리마운트되는데, base-ui는
          리마운트되지 않는 Root에서 옛 요소의 퇴장 애니메이션 완료를
          기다리다(useAnimationsFinished, abort를 완료로 안 침) unmount를 영영
          놓쳐 툴팁이 화면에 남는다. */}
      <PortalContainerProvider container={rootRef}>
        {/* 도킹 프레임: [캔버스 행: [캔버스 영역][CMMS 분할][우측 독 placeholder]].
            placeholder 는 고정된 독의 크기만 차지하는 빈 요소다 — 독 내용은
            루트의 absolute 자식으로 한 곳에만 있고 CSS 로 그 자리에 겹친다.
            Canvas 의 부모 체인은 고정 여부와 무관하게 같아야 한다(리마운트되면
            씬이 다시 로드된다). placeholder 는 항상 형제 뒤에만 붙인다. */}
        <div className="flex h-full w-full flex-col">
          {/* 캔버스 행 — 전체화면 + CMMS 패널 동시 표시 시 좌우 분할 */}
          <div className="flex min-h-0 flex-1">
            {/* 3D 캔버스 영역 */}
            <div
              className={`relative h-full ${showSplitPanel ? 'w-1/2 shrink-0' : 'min-w-0 flex-1'}`}
              style={
                {
                  '--dock-right-inset': dockRightInset,
                } as CSSProperties
              }
            >
              <Canvas
                {...canvasProps}
                // near/far는 호출부가 넘긴 cameraClip을 쓴다. 에디터와 뷰어가
                // 같은 값을 쓰도록 features의 SCENE_CAMERA_CLIP 하나로 모았는데,
                // 이 패키지(@crane/ui)는 features를 참조할 수 없으므로 prop으로
                // 받는다. 기본값은 far 5000 — 이보다 작으면 줌 아웃 시 지도
                // 중앙부터 잘려나간다(maxDistance 3000 + 씬 반폭보다 커야 한다).
                camera={{
                  position: cameraPreset.defaultPosition,
                  ...(cameraClip ?? { near: 0.1, far: 5000 }),
                }}
                // 픽셀 비율 상한 1.5 — Retina(DPR 2~3)에서 네이티브로 그리면
                // 프래그먼트 수가 1.8~4배라 지도급 씬에서 프레임을 다 먹는다.
                // 라벨은 DOM(Html)이라 텍스트 선명도와 무관하고, MSAA(antialias)가
                // 켜져 있어 1.5로도 엣지가 깨끗하다. 호출부가 canvasProps.dpr로
                // 넘기면 그 값이 우선한다. features 쪽 프리셋(SCENE_DEFAULT_DPR,
                // scene-render-preset.tsx)과 같은 값 — cameraClip처럼 이 패키지는
                // features를 참조할 수 없어 리터럴로 둔다.
                dpr={canvasProps?.dpr ?? [1, 1.5]}
              >
                <SceneControlsBridge
                  cameraPreset={cameraPreset}
                  onControllerChange={setController}
                />
                {children}
              </Canvas>

              {overlay ? (
                <div className="pointer-events-none absolute inset-0 z-10">
                  {overlay}
                </div>
              ) : null}

              {/* 독 배치의 우측 상단 슬롯(알람 패널). 다른 배치와 달리 전체화면
                  여부를 가리지 않는다 — 독 배치의 목표가 전체화면과 평소의 UI 를
                  같게 하는 것이라, 이 슬롯을 여닫는 버튼(레일의 알람 토글)이
                  평소에도 있다. 캔버스 영역 기준이라 레일이 고정되면 자동으로
                  안쪽으로 온다. */}
              {isDock && fullscreenTopRightOverlay ? (
                <div
                  className="pointer-events-auto absolute top-3 z-50"
                  style={{
                    right: 'calc(0.75rem + var(--dock-right-inset))',
                  }}
                >
                  {fullscreenTopRightOverlay}
                </div>
              ) : null}
            </div>

            {/* CMMS 패널 (전체화면 시에만). 남는 폭을 쓴다 — 우측 독이
                고정돼 있으면 그 폭만큼 줄어들어 행이 넘치지 않는다. */}
            {showSplitPanel ? (
              <div className="relative h-full min-w-0 flex-1 overflow-hidden">
                {fullscreenOverlay}
              </div>
            ) : null}

            {rightDockPinned ? (
              <div
                aria-hidden
                className="shrink-0"
                style={{ width: SCENE_DOCK_RAIL_COLUMN_WIDTH }}
              />
            ) : null}
          </div>
        </div>

        {isFullscreen && fullscreenTopCenterOverlay ? (
          <div className="pointer-events-auto absolute top-3 left-1/2 z-50 -translate-x-1/2">
            {fullscreenTopCenterOverlay}
          </div>
        ) : null}

        {/* 화면 조작 툴바.
            'dock': 우측 독 레일 안에 세로로 — 카메라 버튼, toolbarExtras,
            toolbarTrailing 순.
            'top-right': 우측 상단 세로 스택 — 1줄 카메라 조작, 2줄 toolbarExtras
            (전체화면 알람 토글 등), 그 아래 전체화면 우측 상단 슬롯(알람 패널).
            좌우 여백을 함께 잡아 두어 북마크 칩이 많아도 왼쪽 화면 밖으로
            나가지 않고 toolbarTrailing 안쪽 스크롤이 흡수한다.
            'bottom-left': 좌측 하단 가로 한 줄. 분할 전체화면에서도 루트의
            좌측 하단은 곧 3D 캔버스의 좌측 하단이라 캔버스 밖으로 나가지 않는다. */}
        <TooltipProvider delay={150}>
          {toolbarPlacement === 'none' ? null : isDock ? (
            <>
              {dockRight ? (
                <SceneDockRail
                  label={dockRight.label}
                  expanded={dockRight.expanded}
                  pinned={dockRight.pinned}
                  onPinnedChange={dockRight.onPinnedChange}
                  handlers={dockRight.handlers}
                >
                  {cameraToolbarButtons}
                  {toolbarExtras ? (
                    <>
                      <DockRailSeparator />
                      {toolbarExtras}
                    </>
                  ) : null}
                  {toolbarTrailing ? (
                    <>
                      <DockRailSeparator />
                      {toolbarTrailing}
                    </>
                  ) : null}
                </SceneDockRail>
              ) : null}
            </>
          ) : isTopRightToolbar ? (
            <div
              className={`pointer-events-none absolute top-3 left-3 z-1 flex flex-col items-end gap-2 ${
                // 분할 전체화면(CMMS 패널)에서는 캔버스가 왼쪽 절반이라
                // 우측 기준을 화면 절반으로 당겨야 툴바가 패널 위로 넘어가지 않는다.
                showSplitPanel ? 'right-[calc(50%+0.75rem)]' : 'right-3'
              }`}
            >
              <div className="pointer-events-auto flex max-w-full items-center gap-2">
                {toolbarTrailing}
                {cameraToolbarButtons}
              </div>
              {toolbarExtras ? (
                <div className="pointer-events-auto flex max-w-full items-center gap-2">
                  {toolbarExtras}
                </div>
              ) : null}
              {isFullscreen && fullscreenTopRightOverlay ? (
                <div className="pointer-events-auto">
                  {fullscreenTopRightOverlay}
                </div>
              ) : null}
            </div>
          ) : (
            <>
              {isFullscreen && fullscreenTopRightOverlay ? (
                <div className="pointer-events-auto absolute top-3 right-3 z-50">
                  {fullscreenTopRightOverlay}
                </div>
              ) : null}
              <div className="pointer-events-none absolute inset-x-3 bottom-3 z-1 flex items-end">
                <div className="pointer-events-auto flex max-w-full items-center gap-2">
                  {toolbarExtras}
                  {toolbarTrailing}
                  {cameraToolbarButtons}
                </div>
              </div>
            </>
          )}
        </TooltipProvider>
      </PortalContainerProvider>
    </div>
  );
}

/** 독 레일 안에서 버튼 그룹을 나누는 가로 구분선. */
function DockRailSeparator() {
  return (
    <span
      aria-hidden
      className="my-0.5 h-px w-5 shrink-0 bg-black/25 dark:bg-white/25"
    />
  );
}
