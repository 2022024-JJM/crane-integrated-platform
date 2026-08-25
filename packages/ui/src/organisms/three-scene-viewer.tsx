import { OrbitControls } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import {
  Map,
  Maximize2,
  Minimize2,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  type ComponentProps,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Box3, Vector3, type PerspectiveCamera } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { Button } from '../atoms/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../molecules/tooltip';
import { cn } from '@crane/core/lib/utils';
import type { Vector3Tuple } from '@crane/core/types/math';

interface ThreeSceneViewerCameraPreset {
  defaultPosition: Vector3Tuple;
  defaultTarget: Vector3Tuple;
  topViewPosition?: Vector3Tuple;
  topViewTarget?: Vector3Tuple;
  /**
   * 탑뷰가 한 화면에 담을 영역(보통 지도 bounds). 있으면 topViewPosition/
   * Target 대신 이 박스가 세로 fov·종횡비 기준으로 꽉 차는 높이에서
   * 정수직으로 내려다본다. 없거나 비어 있으면 기존 프리셋 경로.
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
  // 전체화면일 때 우측 상단(툴바 좌측 옆)에 떠있는 플로팅 슬롯. 도메인 무관.
  fullscreenTopRightOverlay?: ReactNode;
  // 전체화면일 때 화면 상단 중앙(노치 위치)에 떠있는 슬롯. critical 알림 배너 등.
  fullscreenTopCenterOverlay?: ReactNode;
  // 전체화면일 때 3D 캔버스 하단 중앙에 떠있는 슬롯. 씬 뷰 북마크 바 등.
  // 루트가 아닌 캔버스 영역에 앵커링 — 분할 레이아웃에서도 3D 뷰 중앙에 온다.
  fullscreenBottomCenterOverlay?: ReactNode;
  // 우측 툴바 상단에 외부 버튼을 주입하는 슬롯. 도메인 무관.
  toolbarExtras?: ReactNode;
  // 우측 툴바 컨테이너에 추가되는 클래스(top offset 등 페이지별 조정용).
  toolbarClassName?: string;
  showZoomIndicator?: boolean;
  onControllerReady?: (controller: SceneController | null) => void;
  onFullscreenChange?: (isFullscreen: boolean) => void;
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
  onZoomPercentChange: (zoomPercent: number) => void;
}

const ZOOM_STEP = 1.2;
/**
 * 툴바 줌 버튼의 카메라-타깃 최소 거리. 타깃은 SceneSurfaceCamera(features)가
 * 화면 중앙 표면에 붙여 두므로 "표면까지 60m"가 된다 — 휠 줌의 표면 최소
 * 거리(MIN_SURFACE_DISTANCE)와 같은 값. 크레인 50~100m 씬에서 5·20은 트롤리
 * 안까지 파고들어 60으로 올렸다.
 */
const MIN_CAMERA_DISTANCE = 60;
const DEFAULT_CAMERA_UP = new Vector3(0, 1, 0);
const TOP_VIEW_CAMERA_UP = new Vector3(0, 0, -1);
/** 탑뷰 fit 여백 — 지도 가장자리가 화면 끝에 닿지 않게 8%. */
const TOP_VIEW_PADDING = 1.08;
/**
 * 탑뷰 fit 높이 상한. OrbitControls maxDistance(3000)와 같은 값 — 더 높이
 * 올리면 다음 update()에서 반경이 잘려 카메라가 튄다.
 */
const TOP_VIEW_MAX_DISTANCE = 3000;

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
  onZoomPercentChange,
}: SceneControlsBridgeProps) {
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  const defaultPosition = useMemo(
    () => toVector3(cameraPreset.defaultPosition),
    [cameraPreset.defaultPosition],
  );
  const defaultTarget = useMemo(
    () => toVector3(cameraPreset.defaultTarget),
    [cameraPreset.defaultTarget],
  );
  const defaultDistance = useMemo(() => {
    const distance = defaultPosition.distanceTo(defaultTarget);
    return distance > 0 ? distance : 1;
  }, [defaultPosition, defaultTarget]);
  const topViewTarget = useMemo(
    () => toVector3(cameraPreset.topViewTarget ?? cameraPreset.defaultTarget),
    [cameraPreset.defaultTarget, cameraPreset.topViewTarget],
  );
  const topViewPosition = useMemo(() => {
    if (cameraPreset.topViewPosition) {
      return toVector3(cameraPreset.topViewPosition);
    }

    return new Vector3(
      topViewTarget.x,
      topViewTarget.y + defaultDistance,
      topViewTarget.z,
    );
  }, [cameraPreset.topViewPosition, defaultDistance, topViewTarget]);

  const syncZoomPercent = useCallback(() => {
    const controls = controlsRef.current;

    if (!controls) {
      return;
    }

    const currentDistance = camera.position.distanceTo(controls.target);
    const zoomPercent = Math.max(
      1,
      Math.round((defaultDistance / Math.max(currentDistance, 0.0001)) * 100),
    );

    onZoomPercentChange(zoomPercent);
  }, [camera.position, defaultDistance, onZoomPercentChange]);

  const applyCameraState = useCallback(
    (position: Vector3, target: Vector3, up: Vector3) => {
      const controls = controlsRef.current;

      if (!controls) {
        return;
      }

      camera.position.copy(position);
      camera.up.copy(up);
      controls.target.copy(target);
      camera.lookAt(target);

      // OrbitControls는 극각을 camera.up 기준으로 잰다. 탑뷰(up=-Z)에서는
      // 타깃 위의 카메라가 phi 90°라, 직전 프레임에 +Y 기준으로 계산된
      // maxPolarAngle(features CameraAboveSea)이 남아 있으면 아래 update()가
      // 그 각도로 잘라 카메라가 기운다(타깃이 지하일수록 크게). up이 +Y가
      // 아닌 포즈에는 극각 제한을 풀고 적용한다 — 이후 프레임은 CameraAboveSea가
      // up≠+Y를 보고 π를 유지한다.
      if (Math.abs(up.y - 1) > 1e-6) {
        controls.minPolarAngle = 0;
        controls.maxPolarAngle = Math.PI;
      }

      // 감쇠(damping)를 잠시 끄고 update() 한다. 켠 채로 부르면 직전 드래그의
      // 잔여 관성이 남아 있다가 이후 프레임에서 계속 적용돼, 방금 맞춘 포즈가
      // 조금씩 흘러간다("리셋을 눌렀는데 카메라가 미끄러진다"). three-stdlib는
      // damping이 꺼져 있을 때만 update()에서 델타를 0으로 리셋한다.
      const previousDamping = controls.enableDamping;
      controls.enableDamping = false;
      controls.update();
      controls.enableDamping = previousDamping;

      invalidate();
      syncZoomPercent();
    },
    [camera, invalidate, syncZoomPercent],
  );

  const reset = useCallback(() => {
    applyCameraState(defaultPosition, defaultTarget, DEFAULT_CAMERA_UP);
  }, [applyCameraState, defaultPosition, defaultTarget]);

  const getTopViewBounds = cameraPreset.getTopViewBounds;
  const moveToTopView = useCallback(() => {
    const bounds = getTopViewBounds?.();
    const perspective = camera as PerspectiveCamera;
    if (bounds && !bounds.isEmpty() && perspective.isPerspectiveCamera) {
      // 지도 XZ가 세로 fov 기준으로 화면에 꽉 차는 높이. 가로는 종횡비로
      // 환산해 둘 중 큰 쪽을 쓴다.
      const center = bounds.getCenter(new Vector3());
      const size = bounds.getSize(new Vector3());
      const halfHeight = Math.max(size.z / 2, size.x / (2 * perspective.aspect));
      const halfFov = (perspective.fov * Math.PI) / 360;
      const distance = Math.min(
        (halfHeight / Math.tan(halfFov)) * TOP_VIEW_PADDING,
        TOP_VIEW_MAX_DISTANCE,
      );
      applyCameraState(
        new Vector3(center.x, bounds.max.y + distance, center.z),
        center,
        TOP_VIEW_CAMERA_UP,
      );
      return;
    }
    applyCameraState(topViewPosition, topViewTarget, TOP_VIEW_CAMERA_UP);
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
      syncZoomPercent();
    },
    [camera.position, invalidate, syncZoomPercent],
  );

  const zoomIn = useCallback(() => {
    zoomByFactor(1 / ZOOM_STEP);
  }, [zoomByFactor]);

  const zoomOut = useCallback(() => {
    zoomByFactor(ZOOM_STEP);
  }, [zoomByFactor]);

  const moveTo = useCallback(
    (position: Vector3Tuple, target: Vector3Tuple) => {
      applyCameraState(
        toVector3(position),
        toVector3(target),
        DEFAULT_CAMERA_UP,
      );
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

    const handleChange = () => {
      syncZoomPercent();
    };

    controls.addEventListener('change', handleChange);

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
      controls.removeEventListener('change', handleChange);
      onControllerChange(null);
    };
  }, [
    onControllerChange,
    reset,
    syncZoomPercent,
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

interface ToolbarButtonProps {
  label: string;
  onClick: () => void;
  children: ReactNode;
}

function ToolbarButton({ label, onClick, children }: ToolbarButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="outline"
            size="icon-sm"
            className="bg-background/85 border-border/70 shadow-sm backdrop-blur-sm"
            aria-label={label}
          />
        }
        onClick={onClick}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="left">{label}</TooltipContent>
    </Tooltip>
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
  fullscreenBottomCenterOverlay,
  toolbarExtras,
  toolbarClassName,
  showZoomIndicator = true,
  onControllerReady,
  onFullscreenChange,
}: ThreeSceneViewerProps) {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<SceneController | null>(null);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const setController = useCallback(
    (controller: SceneController | null) => {
      controllerRef.current = controller;
      onControllerReady?.(controller);
    },
    [onControllerReady],
  );

  const toggleFullscreen = useCallback(async () => {
    const root = rootRef.current;

    if (!root) {
      return;
    }

    if (document.fullscreenElement === root) {
      await document.exitFullscreen();
      return;
    }

    await root.requestFullscreen();
  }, []);

  const onFullscreenChangeRef = useRef(onFullscreenChange);
  onFullscreenChangeRef.current = onFullscreenChange;

  useEffect(() => {
    const handleFullscreenChange = () => {
      const next = document.fullscreenElement === rootRef.current;
      setIsFullscreen(next);
      onFullscreenChangeRef.current?.(next);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const showSplitPanel = isFullscreen && fullscreenOverlay;
  const webglSupported = isWebGLSupported();

  if (!webglSupported) {
    return (
      <div
        ref={rootRef}
        role="alert"
        className="relative flex h-full min-h-0 w-full flex-col items-center justify-center gap-2 overflow-hidden bg-muted/40 p-6 text-center"
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

  return (
    <div
      ref={rootRef}
      className="relative h-full min-h-0 w-full overflow-hidden"
    >
      {/* 전체화면 + CMMS 패널 동시 표시 시 좌우 분할 레이아웃 */}
      <div className={showSplitPanel ? 'flex h-full w-full' : 'h-full w-full'}>
        {/* 3D 캔버스 영역 */}
        <div className={`relative ${showSplitPanel ? 'w-1/2 shrink-0' : 'h-full w-full'}`}>
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
              onZoomPercentChange={setZoomPercent}
            />
            {children}
          </Canvas>

          {overlay ? (
            <div className="pointer-events-none absolute inset-0 z-10">
              {overlay}
            </div>
          ) : null}

          {isFullscreen && fullscreenBottomCenterOverlay ? (
            <div className="pointer-events-auto absolute bottom-4 left-1/2 z-50 max-w-[calc(100%-1.5rem)] -translate-x-1/2">
              {fullscreenBottomCenterOverlay}
            </div>
          ) : null}
        </div>

        {/* CMMS 패널 (전체화면 시에만) */}
        {showSplitPanel ? (
          <div className="relative h-full w-1/2 shrink-0 overflow-hidden">
            {fullscreenOverlay}
          </div>
        ) : null}
      </div>

      {isFullscreen && fullscreenTopCenterOverlay ? (
        <div className="pointer-events-auto absolute top-3 left-1/2 z-50 -translate-x-1/2">
          {fullscreenTopCenterOverlay}
        </div>
      ) : null}

      {isFullscreen && fullscreenTopRightOverlay ? (
        <div className="pointer-events-auto absolute top-3 right-14 z-50">
          {fullscreenTopRightOverlay}
        </div>
      ) : null}

      <TooltipProvider delay={150}>
        <div
          className={cn(
            'pointer-events-none absolute top-3 right-3 z-1 flex flex-col items-end gap-2',
            toolbarClassName,
          )}
        >
          {showZoomIndicator ? (
            <div className="bg-background/85 text-foreground border-border/70 pointer-events-auto rounded-md border px-2.5 py-1 text-xs font-medium shadow-sm backdrop-blur-sm">
              {zoomPercent}%
            </div>
          ) : null}

          <div className="pointer-events-auto flex flex-col gap-2">
            {toolbarExtras}
            <ToolbarButton
              label={t('common:viewer3d.zoomIn')}
              onClick={() => {
                controllerRef.current?.zoomIn();
              }}
            >
              <ZoomIn />
            </ToolbarButton>
            <ToolbarButton
              label={t('common:viewer3d.zoomOut')}
              onClick={() => {
                controllerRef.current?.zoomOut();
              }}
            >
              <ZoomOut />
            </ToolbarButton>
            <ToolbarButton
              label={t('common:viewer3d.resetView')}
              onClick={() => {
                controllerRef.current?.reset();
              }}
            >
              <RotateCcw />
            </ToolbarButton>
            <ToolbarButton
              label={t('common:viewer3d.topView')}
              onClick={() => {
                controllerRef.current?.moveToTopView();
              }}
            >
              <Map />
            </ToolbarButton>
            <ToolbarButton
              label={
                isFullscreen
                  ? t('common:viewer3d.exitFullscreen')
                  : t('common:viewer3d.fullscreen')
              }
              onClick={() => {
                void toggleFullscreen();
              }}
            >
              {isFullscreen ? <Minimize2 /> : <Maximize2 />}
            </ToolbarButton>
          </div>
        </div>
      </TooltipProvider>
    </div>
  );
}
