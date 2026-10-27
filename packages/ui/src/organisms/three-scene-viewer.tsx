import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
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
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useFullscreen } from '@crane/core/lib/use-fullscreen';
import { scalePoseAboutPoint } from '@crane/core/lib/top-view-pose';
import { useOrthoTopView } from './use-ortho-top-view';
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
  SceneDockRailSeparator,
  type SceneDockState,
} from './scene-dock';
import type { Vector3Tuple } from '@crane/core/types/math';

// SCENE_TOOLBAR_BUTTON_CLASS 는 여기서 re-export 하지 않는다. 이 파일은
// three·drei·fiber 를 정적으로 끌어오므로, 상수 하나 때문에 이 경로를 import 한
// 버튼(알람 토글 등)이 로그인 화면까지 3D 런타임을 실었다. 상수는
// `@crane/ui/molecules/scene-toolbar-button` 에서 가져온다.

/**
 * 초기 시점·"메인 뷰" 버튼의 구도. 탑뷰는 프리셋이 아니라 지금 보는 화면
 * 위로 올라가는 토글이다(use-ortho-top-view).
 */
interface ThreeSceneViewerCameraPreset {
  defaultPosition: Vector3Tuple;
  defaultTarget: Vector3Tuple;
}

/** 호출부가 cameraClip 을 넘기지 않을 때 — far 5000(지도 잘림 방지 최소값). */
const DEFAULT_CAMERA_CLIP = { near: 0.1, far: 5000 } as const;

interface ThreeSceneViewerProps {
  cameraPreset: ThreeSceneViewerCameraPreset;
  canvasProps?: Omit<ComponentProps<typeof Canvas>, 'camera' | 'children'>;
  /** 카메라 near/far. 미지정 시 far 5000(지도 잘림 방지 최소값). */
  cameraClip?: { near: number; far: number };
  children: ReactNode;
  overlay?: ReactNode;
  // 전체화면일 때 우측 상단에 떠있는 플로팅 슬롯. 도메인 무관.
  fullscreenTopRightOverlay?: ReactNode;
  // 외부 버튼을 주입하는 슬롯. 도메인 무관. 'bottom-left' 배치에서는 툴바 맨 앞,
  // 'dock' 배치에서는 레일의 카메라 버튼 묶음 아래에 놓인다.
  toolbarExtras?: ReactNode;
  /**
   * 조작 툴바 위치. 기본은 좌측 하단 한 줄. 'dock' 은 툴바를 그리지 않고
   * 카메라 버튼·toolbarExtras 를 우측 독 레일(dockRight)에 세로로 넣는다
   * (3D 모니터링·3D 플레이 화면).
   */
  toolbarPlacement?: 'bottom-left' | 'dock';
  /**
   * 우측 독 레일 상태 ('dock' 배치에서만). 내용은 카메라 버튼 + toolbarExtras
   * 를 뷰어가 조립한다. 상태는 features 의 useSceneDock 이 소유하고 여기서는
   * 그대로 넘긴다.
   */
  dockRight?: SceneDockState;
  /**
   * 카메라 버튼(원래위치·탑뷰·확대·축소) 비활성 사유. 넘기면 네 버튼이
   * 회색으로 남고 툴팁이 이 문구를 보인다 — 기본 카메라가 화면에 보이지
   * 않는 분할 화면. 전체화면 버튼은 그대로 동작한다.
   */
  cameraControlsDisabledLabel?: string;
  /**
   * 탑뷰 진입·해제 알림 — 탑뷰일 때만 보이는 오버레이(2D/3D 전환 토글)를
   * 호출자가 그린다. 상태는 Canvas 안 브리지(useOrthoTopView)가 소유한다.
   */
  onTopViewActiveChange?: (active: boolean) => void;
  onControllerReady?: (controller: SceneController | null) => void;
}

export interface SceneController {
  /** 메인 뷰(프리셋 기본 구도). 탑뷰 중이면 원근으로 복귀하면서 간다. */
  reset: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  /** 직교 탑뷰 진입 / "지금 보는 곳 기준" 원근 복귀. */
  toggleTopView: () => void;
  /** 탑뷰면 원근으로 복귀(지금 보는 곳 기준), 아니면 no-op. */
  exitTopView: () => void;
  /** 구도로 이동 — 탑뷰 중이면 원근으로 복귀하면서 그 구도로 간다. */
  moveTo: (position: Vector3Tuple, target: Vector3Tuple) => void;
  /** 모드를 유지한 채 이동(미니맵 팬) — 탑뷰 중이면 탑뷰인 채 옮긴다. */
  panTo: (position: Vector3Tuple, target: Vector3Tuple) => void;
  getPose: () => { position: Vector3Tuple; target: Vector3Tuple } | null;
}

interface SceneControlsBridgeProps {
  cameraPreset: ThreeSceneViewerCameraPreset;
  /** 카메라 far — 직교 탑뷰 카메라가 같은 값을 쓴다. */
  cameraFar: number;
  onControllerChange: (controller: SceneController | null) => void;
  onTopViewActiveChange: (active: boolean) => void;
}

const ZOOM_STEP = 1.2;
/**
 * 툴바 줌 버튼의 카메라-타깃 최소 거리. 타깃은 SceneSurfaceCamera(features)가
 * 화면 중앙 표면에 붙여 두므로 "표면까지의 거리"가 된다 — 휠 줌의 표면 최소
 * 거리(features camera-limits.ts CAMERA_MIN_SURFACE_DISTANCE)와 같은 값.
 * ui 는 features 를 import 하지 못해 리터럴로 둔다. 바꿀 때 둘을 함께 바꾼다.
 */
const MIN_CAMERA_DISTANCE = 2;

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

function SceneControlsBridge({
  cameraPreset,
  cameraFar,
  onControllerChange,
  onTopViewActiveChange,
}: SceneControlsBridgeProps) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  // 직교 탑뷰 토글 — 카메라 교체·포즈 적용·프러스텀은 훅이 맡는다. 아래
  // 콜백은 전부 controlsRef 를 읽고 state.camera 에 의존하지 않는다 — 카메라
  // 교체(탑뷰)로 컨트롤러가 다시 등록되거나 reset 이 다시 돌면 안 된다.
  const topView = useOrthoTopView({ controlsRef, far: cameraFar });
  const { active: topViewActive, applyPose, moveTo, exit, toggle } = topView;

  useEffect(() => {
    onTopViewActiveChange(topViewActive);
  }, [onTopViewActiveChange, topViewActive]);

  const { defaultPosition, defaultTarget } = cameraPreset;

  // 메인 뷰 — 탑뷰 중이면 원근으로 복귀하면서 그 구도로 간다.
  const reset = useCallback(() => {
    moveTo(defaultPosition, defaultTarget);
  }, [defaultPosition, defaultTarget, moveTo]);

  // 줌 버튼 — 타깃(화면 중앙 표면) 기준 거리 배율. 탑뷰(직교)도 같은 식이고
  // applyPose 가 거리로 프러스텀을 다시 잡는다.
  const zoomByFactor = useCallback(
    (factor: number) => {
      const controls = controlsRef.current;
      if (!controls) return;
      const cam = controls.object;
      const distance = cam.position.distanceTo(controls.target);
      if (!(distance > 0)) return;
      const nextDistance = Math.max(MIN_CAMERA_DISTANCE, distance * factor);
      const pose = scalePoseAboutPoint(
        {
          position: cam.position.toArray(),
          target: controls.target.toArray(),
        },
        controls.target.toArray(),
        nextDistance / distance,
      );
      applyPose(pose.position, pose.target);
    },
    [applyPose],
  );

  const zoomIn = useCallback(() => {
    zoomByFactor(1 / ZOOM_STEP);
  }, [zoomByFactor]);

  const zoomOut = useCallback(() => {
    zoomByFactor(ZOOM_STEP);
  }, [zoomByFactor]);

  const exitTopView = useCallback(() => {
    exit();
  }, [exit]);

  const getPose = useCallback((): {
    position: Vector3Tuple;
    target: Vector3Tuple;
  } | null => {
    const controls = controlsRef.current;
    if (!controls) return null;
    return {
      position: controls.object.position.toArray(),
      target: controls.target.toArray(),
    };
  }, []);

  useEffect(() => {
    onControllerChange({
      reset,
      zoomIn,
      zoomOut,
      toggleTopView: toggle,
      exitTopView,
      moveTo,
      panTo: applyPose,
      getPose,
    });
    return () => {
      onControllerChange(null);
    };
  }, [
    onControllerChange,
    reset,
    zoomIn,
    zoomOut,
    toggle,
    exitTopView,
    moveTo,
    applyPose,
    getPose,
  ]);

  // 초기 시점, 그리고 프리셋이 바뀔 때(모델 로드 뒤 정면 뷰를 주입하는 작은
  // 뷰어) 다시 — reset 의 의존성은 프리셋뿐이라 탑뷰 카메라 교체로는 돌지
  // 않는다.
  useEffect(() => {
    reset();
  }, [reset]);

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
      // 회전/팬 반경 clamp만 — 표면 피벗이 확대 하한(MIN_CAMERA_DISTANCE)보다
      // 가까울 때(경사면·크레인 상부) 튕겨 나가지 않게 그보다 작게, 표면
      // 레이캐스트 near 와 같은 값으로 둔다. 확대 하한은 SceneSurfaceCamera가
      // 지킨다.
      minDistance={1}
      // 무한 줌 아웃 방지 상한(camera far보다 작게). SceneCameraLimits 가 없는
      // 작은 뷰어(far 기본 5000)의 안전값이며, features 의 SceneCameraLimits
      // 가 마운트된 화면에선 첫 프레임부터 지도 크기(상한 CAMERA_MAX_DISTANCE
      // 30000)로 덮어쓴다.
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
  fullscreenTopRightOverlay,
  toolbarExtras,
  toolbarPlacement = 'bottom-left',
  dockRight,
  cameraControlsDisabledLabel,
  onTopViewActiveChange,
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
  // 탑뷰 버튼의 눌림 표시 — 상태는 Canvas 안 브리지(useOrthoTopView)가 소유한다.
  const [topViewActive, setTopViewActive] = useState(false);
  const clip = cameraClip ?? DEFAULT_CAMERA_CLIP;

  const handleTopViewActiveChange = useCallback(
    (active: boolean) => {
      setTopViewActive(active);
      onTopViewActiveChange?.(active);
    },
    [onTopViewActiveChange],
  );

  const setController = useCallback(
    (controller: SceneController | null) => {
      controllerRef.current = controller;
      onControllerReady?.(controller);
    },
    [onControllerReady],
  );

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

  // 툴바 아이콘 순서: 원래위치 / 탑뷰 / 확대 / 축소 / 전체화면. 레일에서는
  // 툴팁을 왼쪽으로 연다.
  const tooltipSide: SceneToolbarTooltipSide = isDock ? 'left' : 'top';
  const cameraDisabled = cameraControlsDisabledLabel !== undefined;
  const cameraToolbarButtons = (
    <>
      <SceneToolbarButton
        label={t('common:viewer3d.resetView')}
        side={tooltipSide}
        disabled={cameraDisabled}
        disabledLabel={cameraControlsDisabledLabel}
        onClick={() => {
          controllerRef.current?.reset();
        }}
      >
        <House />
      </SceneToolbarButton>
      {/* 탑뷰 하나 — 2D(평면도)·3D 전환은 탑뷰 중 우상단 토글이 맡는다
          (호출자가 onTopViewActiveChange 로 그린다). 독 레일에서는 켜짐을
          에디터 도구 모음처럼 아이콘 아래 점으로 표시한다. */}
      <SceneToolbarButton
        label={
          topViewActive
            ? t('common:viewer3d.topViewExit')
            : t('common:viewer3d.topView')
        }
        side={tooltipSide}
        pressed={topViewActive}
        pressedDot={isDock}
        disabled={cameraDisabled}
        disabledLabel={cameraControlsDisabledLabel}
        onClick={() => {
          controllerRef.current?.toggleTopView();
        }}
      >
        <Binoculars />
      </SceneToolbarButton>
      <SceneToolbarButton
        label={t('common:viewer3d.zoomIn')}
        side={tooltipSide}
        disabled={cameraDisabled}
        disabledLabel={cameraControlsDisabledLabel}
        onClick={() => {
          controllerRef.current?.zoomIn();
        }}
      >
        <ZoomIn />
      </SceneToolbarButton>
      <SceneToolbarButton
        label={t('common:viewer3d.zoomOut')}
        side={tooltipSide}
        disabled={cameraDisabled}
        disabledLabel={cameraControlsDisabledLabel}
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
  // 영역의 오버레이(충돌 도움말·고정 뷰 줄 등)가 그만큼 안쪽으로 비켜야 한다
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
          에 잘리지 않고 floating-ui가 루트 안쪽으로 밀어준다. 컨테이너를
          도중에 바꾸면(body↔root)
          안 된다 — 닫히는 중인 팝업이 새 컨테이너로 리마운트되는데, base-ui는
          리마운트되지 않는 Root에서 옛 요소의 퇴장 애니메이션 완료를
          기다리다(useAnimationsFinished, abort를 완료로 안 침) unmount를 영영
          놓쳐 툴팁이 화면에 남는다. */}
      <PortalContainerProvider container={rootRef}>
        {/* 도킹 프레임: [캔버스 행: [캔버스 영역][우측 독 placeholder]].
            placeholder 는 고정된 독의 크기만 차지하는 빈 요소다 — 독 내용은
            루트의 absolute 자식으로 한 곳에만 있고 CSS 로 그 자리에 겹친다.
            Canvas 의 부모 체인은 고정 여부와 무관하게 같아야 한다(리마운트되면
            씬이 다시 로드된다). placeholder 는 항상 형제 뒤에만 붙인다. */}
        <div className="flex h-full w-full flex-col">
          {/* 캔버스 행 */}
          <div className="flex min-h-0 flex-1">
            {/* 3D 캔버스 영역 */}
            <div
              className="relative h-full min-w-0 flex-1"
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
                  ...clip,
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
                  cameraFar={clip.far}
                  onControllerChange={setController}
                  onTopViewActiveChange={handleTopViewActiveChange}
                />
                {children}
              </Canvas>

              {overlay ? (
                <div className="pointer-events-none absolute inset-0 z-10">
                  {overlay}
                </div>
              ) : null}

              {/* 독 배치의 우측 상단 슬롯(고정 뷰 줄·방위 표시·2D/3D 전환).
                  다른 배치와 달리 전체화면 여부를 가리지 않는다 — 독 배치의
                  목표가 전체화면과 평소의 UI 를 같게 하는 것이다. 캔버스 영역
                  기준이라 레일이 고정되면 자동으로 안쪽으로 온다. 슬롯 자체는
                  포인터를 받지 않는다 — 폭이 다른 줄 사이 빈 곳이 캔버스
                  조작을 먹지 않게, 누를 것은 각자 pointer-events-auto 다. */}
              {isDock && fullscreenTopRightOverlay ? (
                <div
                  className="pointer-events-none absolute top-1.5 z-50"
                  style={{
                    right: 'calc(0.375rem + var(--dock-right-inset))',
                  }}
                >
                  {fullscreenTopRightOverlay}
                </div>
              ) : null}
            </div>

            {rightDockPinned ? (
              <div
                aria-hidden
                className="shrink-0"
                style={{ width: SCENE_DOCK_RAIL_COLUMN_WIDTH }}
              />
            ) : null}
          </div>
        </div>

        {/* 화면 조작 툴바.
            'dock': 우측 독 레일 안에 세로로 — 카메라 버튼(원래위치·탑뷰·
            확대·축소·전체화면), 그 아래 toolbarExtras.
            'bottom-left': 좌측 하단 가로 한 줄. 분할 전체화면에서도 루트의
            좌측 하단은 곧 3D 캔버스의 좌측 하단이라 캔버스 밖으로 나가지 않는다. */}
        <TooltipProvider delay={150}>
          {isDock ? (
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
                      <SceneDockRailSeparator />
                      {toolbarExtras}
                    </>
                  ) : null}
                </SceneDockRail>
              ) : null}
            </>
          ) : (
            <>
              {isFullscreen && fullscreenTopRightOverlay ? (
                <div className="pointer-events-auto absolute top-1.5 right-1.5 z-50">
                  {fullscreenTopRightOverlay}
                </div>
              ) : null}
              <div className="pointer-events-none absolute inset-x-1.5 bottom-1.5 z-1 flex items-end">
                <div className="pointer-events-auto flex max-w-full items-center gap-2">
                  {toolbarExtras}
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
