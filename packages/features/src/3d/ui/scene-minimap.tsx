import { GripHorizontal, X } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type PointerEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Box3, Vector3, type Object3D } from 'three';
import {
  isOverlayDrag,
  modelObjectRegistry,
  type SavedSceneInfo,
  type SavedSceneView,
} from '@crane/domain/3d';
import type { AlarmSeverity } from '@crane/domain/alarm';
import type { Vector3Tuple } from '@crane/core/types/math';
import { cn } from '@crane/core/lib/utils';
import { Button } from '@crane/ui/atoms/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@crane/ui/molecules/tooltip';
import {
  cameraFootprint,
  cameraGlyphPolygon,
  clampPanelPosition,
  isSameViewPose,
  minimapToWorld,
  nearestMarkerIndex,
  panPoseToPoint,
  panelPositionToRatio,
  panelRatioToPosition,
  viewPinHead,
  worldToMinimap,
  type MinimapFrame,
} from '../lib/minimap';
import { zoneColorWithAlpha } from '../lib/scene-zones';
import { useSceneMinimapStore } from '../model/use-scene-minimap-store';

/**
 * 모니터링 2D 미니맵 — 캔버스 좌하단 오버레이.
 *
 * 배경은 SceneMinimapCapture 가 찍어 둔 탑뷰 스냅샷이고, 그 위에 매 폴링
 * 틱마다 고정 뷰 핀, 장비 마커(레지스트리의 현재 월드 위치 — 리그·태그로
 * 움직인 자세를 따라간다), 카메라(시선 방향으로 도는 카메라 픽토그램 + 같은
 * 색의 시야 부채꼴, 강조색 CAMERA_COLOR 흰색)를 그린다. 순서는 핀 → 마커 →
 * 부채꼴 → 픽토그램 → 호버 라벨 — 알람 색 마커가 핀에 가려지지 않고 카메라는
 * 마커에 가려지지 않는다(부채꼴은 반투명이라 안의 마커가 비친다). 부채꼴은
 * 방향 표시일 뿐이라
 * 각·길이가 고정이고 카메라 fov·타깃 거리를 따라가지 않는다. 영역 원은
 * 그리지 않는다 — 3D 링과
 * HUD 가 담당하고 미니맵에선 마커를 가린다. 그리기는 setInterval 로 2D
 * 캔버스에 직접 하고 React 상태를 건드리지 않는다 — 카메라·장비는 프레임
 * 속도로 바뀌므로 setState 로 따라가면 커밋이 그 속도로 돈다(perf HUD 와
 * 같은 규칙).
 *
 * 조작: 누르면 그 지점으로, 누른 채 끌면 끄는 대로 카메라 타깃이 옮겨진다.
 * 장비 마커 위를 눌러도 같다. 높이·시선 방향·거리는 그대로(팬과 같다 —
 * lib/minimap panPoseToPoint). 포인터 캡처로 미니맵 밖까지 끌어도 이어지고,
 * 픽셀은 이미지 안으로 클램프되어 지도 밖으로 튀지 않는다. 이동 자체는 뷰어
 * 컨트롤러 경로라 카메라 이동 제한(SceneCameraLimits)이 그대로 걸린다.
 *
 * 고정 뷰 핀: 우상단 고정 줄과 같은 뷰다. 핀 끝이 뷰 타깃(보는 곳)이고
 * 머리에 고정 줄 순서의 번호를 쓴다. 핀 머리를 눌렀다 놓으면 `onSelectView` 로 그
 * 뷰에 간다(고정 줄 버튼과 같은 경로) — 누른 채 클릭 허용 범위(domain
 * isOverlayDrag)를 넘게 끌면 팬으로 바뀐다. 포인터를 올리면 그 뷰의 카메라
 * 위치·시야 부채꼴과 타깃까지의 점선, 이름을 보인다. 지금 카메라의 위치·
 * 시선 방향이 그 뷰와 같으면 핀을 흰색으로 채운다 — 회전·팬으로 벗어나면
 * 풀린다.
 * 타깃이 지도 밖인 뷰는 장비 마커처럼 그리지 않는다.
 *
 * 장비 마커 위에 포인터를 올리면 장비 이름을 그 옆에 그린다. 마커 색은 알람
 * severity(critical·high·medium·info) 를 따르고 없으면 노랑(MARKER_COLOR —
 * 운전 상태 색은 HUD·3D 라벨이 담당한다).
 *
 * 패널 자체는 상단 헤더 바(그립)를 끌어 캔버스 영역 안 어디든 놓을 수 있다.
 * 끄는 동안은 스타일을 직접 써서 리렌더하지 않고, 놓을 때 컨테이너 여유
 * 공간 대비 **비율**(lib/minimap PanelRatio)로 스토어에 저장한다
 * (localStorage 영속, 리전 무관). 마운트·리사이즈 때는 그 비율로 px 를 다시
 * 계산한다 — 전체화면으로 컨테이너가 커져도 우하단에 둔 패널이 우하단에
 * 머물고, 큰 창에서 두고 작은 창에서 열어도 밖으로 나가지 않는다. 위치가
 * 없으면(기본) 좌하단이다.
 */

/** 미니맵 표시 폭(CSS px). 높이는 스냅샷 종횡비를 따른다. */
const MINIMAP_CSS_WIDTH = 224;
const DRAW_INTERVAL_MS = 66;
const MARKER_RADIUS_PX = 2;
const MARKER_HIT_RADIUS_PX = 8;
/** 마커와 호버 라벨 상자 사이(CSS px). */
const MARKER_LABEL_GAP_PX = 8;
/**
 * 시야 부채꼴의 벌어짐 각(도)·길이(CSS px) — 카메라 fov·타깃 거리와 무관한
 * 고정값이다. 방향만 읽는 표시라 실제 절단면을 따라가면 탑뷰 근처에서
 * 사라지고 멀리서 낮게 보면 지도를 덮어 오히려 눈에 안 띈다.
 */
const FOOTPRINT_ANGLE_DEG = 60;
const FOOTPRINT_LENGTH_PX = 28;
/**
 * 카메라→타깃 XZ 거리가 이 CSS px 보다 짧으면 시선 방향이 정의되지 않은
 * 것(정수직 탑뷰)으로 보고 부채꼴·픽토그램 대신 점을 찍는다.
 */
const HEADING_MIN_DISTANCE_PX = 2;

const SEVERITY_COLORS: Record<AlarmSeverity, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#f59e0b',
  info: '#3b82f6',
};
const MARKER_COLOR = '#fde047';
/**
 * 카메라 픽토그램·시야 부채꼴 공통 색 — 흰색. 픽토그램은 검은 외곽선을
 * 둘러 밝은 지도 위에서도 읽힌다.
 */
const CAMERA_COLOR = '#ffffff';
/**
 * 시야 부채꼴 — 픽토그램과 같은 색, 카메라에서 멀어질수록 투명해지는
 * 그라데이션 채움. 테두리는 호 없이 양쪽 모서리 직선만 그린다.
 */
const FOOTPRINT_FILL_NEAR = zoneColorWithAlpha(CAMERA_COLOR, 0.7);
const FOOTPRINT_FILL_MID = zoneColorWithAlpha(CAMERA_COLOR, 0.4);
const FOOTPRINT_FILL_FAR = zoneColorWithAlpha(CAMERA_COLOR, 0);
const FOOTPRINT_EDGE = zoneColorWithAlpha(CAMERA_COLOR, 0.9);
/** 모서리 직선 굵기(CSS px). */
const FOOTPRINT_EDGE_WIDTH_PX = 1;
const CAMERA_GLYPH_SIZE_PX = 5;
/** 고정 뷰 핀 — 머리 반지름, 핀 끝(타깃)에서 머리 중심까지(CSS px). */
const VIEW_PIN_RADIUS_PX = 6;
const VIEW_PIN_STEM_PX = 11;
/** 핀 머리와 호버 라벨 사이(CSS px). */
const VIEW_PIN_LABEL_GAP_PX = VIEW_PIN_RADIUS_PX + 4;
const VIEW_PIN_FILL = 'rgba(10, 12, 14, 0.82)';
const VIEW_PIN_FILL_HOVER = 'rgba(40, 46, 52, 0.92)';
const VIEW_PIN_NUMBER_CURRENT = '#0a0c0e';
/**
 * 핀 번호·호버 라벨 서체 — 셸의 `--font-sans` 와 같은 스택. 캔버스는 CSS
 * 변수를 읽지 못해 여기 적는다.
 */
const LABEL_FONT_FAMILY =
  "'IBM Plex Sans', 'Noto Sans KR Variable', sans-serif";
/**
 * 지금 카메라가 그 뷰에 있다고 보는 카메라 위치 차이(씬 단위)·시선 각
 * 차이(rad). 뷰로 옮긴 직후의 포즈는 OrbitControls update() 의 부동소수
 * 오차만큼만 다르다. 타깃 거리는 비교하지 않는다(lib isSameViewPose).
 */
const VIEW_POSE_EPSILON = 1e-3;
const VIEW_DIRECTION_EPSILON_RAD = 1e-3;

interface SceneMinimapProps {
  sceneInfo: SavedSceneInfo | null;
  alarmsByCraneId: Record<string, AlarmSeverity>;
  /** 고정한 뷰 — 고정 줄과 같은 순서로 넘긴다. 번호는 순서 + 1. */
  views: readonly SavedSceneView[];
  /** 현재 카메라 포즈. 컨트롤러 준비 전이면 null. */
  getPose: () => { position: Vector3Tuple; target: Vector3Tuple } | null;
  /** 카메라를 즉시 옮긴다(팬). */
  onMoveTo: (position: Vector3Tuple, target: Vector3Tuple) => void;
  /** 핀을 눌러 그 뷰로 간다 — 고정 줄 버튼과 같은 핸들러. */
  onSelectView: (view: SavedSceneView) => void;
  className?: string;
}

interface MarkerCache {
  /** 모델 루트 월드 위치 → 바운딩 박스 중심 XZ 오프셋(첫 관측 때 한 번). */
  offsetByUuid: Map<string, { dx: number; dz: number }>;
  box: Box3;
  center: Vector3;
  position: Vector3;
}

interface DrawnMarker {
  px: number;
  py: number;
  name: string;
}

/** 고정 뷰 핀 — px·py 는 머리 중심(누르기·라벨 기준), tip 은 뷰 타깃. */
interface DrawnViewPin {
  view: SavedSceneView;
  /** 고정 줄 순서의 번호(1부터). */
  number: number;
  px: number;
  py: number;
  tipPx: number;
  tipPy: number;
  flipped: boolean;
}

interface HoverLabel {
  px: number;
  py: number;
  name: string;
  /** 기준점과 라벨 상자 사이(CSS px). */
  gapPx: number;
}

export function SceneMinimap({
  sceneInfo,
  alarmsByCraneId,
  views,
  getPose,
  onMoveTo,
  onSelectView,
  className,
}: SceneMinimapProps) {
  const { t } = useTranslation();
  const snapshot = useSceneMinimapStore((s) => s.snapshot);
  const visible = useSceneMinimapStore((s) => s.visible);
  const setVisible = useSceneMinimapStore((s) => s.setVisible);
  const position = useSceneMinimapStore((s) => s.position);
  const setPosition = useSceneMinimapStore((s) => s.setPosition);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const panelDragRef = useRef<{
    offsetX: number;
    offsetY: number;
    last: { x: number; y: number };
  } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const draggingRef = useRef(false);
  const hoverRef = useRef<{ px: number; py: number } | null>(null);
  const markersRef = useRef<DrawnMarker[]>([]);
  const pinsRef = useRef<DrawnViewPin[]>([]);
  /** 핀을 누른 채 아직 끌지 않은 상태 — 놓으면 그 뷰로 간다. */
  const pinPressRef = useRef<{
    view: SavedSceneView;
    clientX: number;
    clientY: number;
  } | null>(null);
  const cacheRef = useRef<MarkerCache>({
    offsetByUuid: new Map(),
    box: new Box3(),
    center: new Vector3(),
    position: new Vector3(),
  });
  const frame = snapshot?.frame ?? null;
  const cssHeight = frame
    ? Math.round((MINIMAP_CSS_WIDTH * frame.pxHeight) / frame.pxWidth)
    : 0;

  useEffect(() => {
    if (!visible || !snapshot) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    const draw = () => {
      const { image, frame: drawFrame } = snapshot;
      const scale = drawFrame.pxWidth / MINIMAP_CSS_WIDTH;
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0);
      const pose = getPose();
      const hover = hoverRef.current;
      // 고정 뷰 핀 → 장비 마커 → 카메라(부채꼴·픽토그램). 알람 색 마커가
      // 핀에 가려지지 않고, 카메라가 마커에 가려지지 않는다 — 부채꼴은
      // 반투명 그라데이션이라 안의 마커가 비쳐 보인다.
      const pins = resolveViewPins(drawFrame, scale, views);
      pinsRef.current = pins;
      const hoveredPin = pickViewPin(pins, hover, scale);
      const currentPin = pose
        ? (pins.find((pin) =>
            isSameViewPose(
              pose,
              pin.view,
              VIEW_POSE_EPSILON,
              VIEW_DIRECTION_EPSILON_RAD,
            ),
          ) ?? null)
        : null;
      drawViewPins(context, drawFrame, scale, pins, hoveredPin, currentPin);
      markersRef.current = drawMarkers(
        context,
        drawFrame,
        scale,
        sceneInfo,
        alarmsByCraneId,
        cacheRef.current,
      );
      const camera = resolveCameraDraw(drawFrame, scale, pose);
      if (camera) {
        drawCameraFootprint(context, scale, camera);
        drawCameraGlyph(context, scale, camera);
      }
      // 핀이 장비 마커보다 먼저다 — 누르면 핀은 뷰 이동, 마커는 팬이라
      // 라벨이 누를 때 일어날 일을 말해야 한다.
      const marker = hoveredPin
        ? null
        : resolveHover(markersRef.current, hover, scale);
      drawHoverLabel(
        context,
        scale,
        hoveredPin
          ? {
              px: hoveredPin.px,
              py: hoveredPin.py,
              name: hoveredPin.view.name,
              gapPx: VIEW_PIN_LABEL_GAP_PX,
            }
          : marker
            ? { ...marker, gapPx: MARKER_LABEL_GAP_PX }
            : null,
      );
    };

    // prop 이 바뀌면 인터벌을 다시 건다 — 씬·알람·뷰·getPose 는 드물게
    // 바뀌어 재등록 비용이 무시할 만하고, 렌더 중 ref 미러(react-hooks/refs
    // 금지)를 피한다.
    draw();
    const timer = window.setInterval(draw, DRAW_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [visible, snapshot, sceneInfo, alarmsByCraneId, views, getPose]);

  const localPixel = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || !frame) return null;
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      return {
        px: ((event.clientX - rect.left) / rect.width) * frame.pxWidth,
        py: ((event.clientY - rect.top) / rect.height) * frame.pxHeight,
      };
    },
    [frame],
  );

  const moveCameraTo = useCallback(
    (px: number, py: number) => {
      if (!frame) return;
      const pose = getPose();
      if (!pose) return;
      const { x, z } = minimapToWorld(frame, px, py);
      const next = panPoseToPoint(pose, x, z);
      onMoveTo(next.position, next.target);
    },
    [frame, getPose, onMoveTo],
  );

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return;
    const pixel = localPixel(event);
    if (!pixel || !frame) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const pin = pickViewPin(
      pinsRef.current,
      pixel,
      frame.pxWidth / MINIMAP_CSS_WIDTH,
    );
    if (pin) {
      // 핀은 놓을 때 그 뷰로 간다 — 그 전에 끌면 팬으로 바뀐다.
      pinPressRef.current = {
        view: pin.view,
        clientX: event.clientX,
        clientY: event.clientY,
      };
      return;
    }
    draggingRef.current = true;
    moveCameraTo(pixel.px, pixel.py);
  };

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const pixel = localPixel(event);
    hoverRef.current = pixel;
    const press = pinPressRef.current;
    if (
      press &&
      isOverlayDrag(press.clientX, press.clientY, event.clientX, event.clientY)
    ) {
      pinPressRef.current = null;
      draggingRef.current = true;
    }
    if (draggingRef.current && pixel) {
      moveCameraTo(pixel.px, pixel.py);
    }
    // 핀 위에서만 손가락 커서 — 나머지는 클래스의 crosshair.
    const overPin =
      !draggingRef.current &&
      pixel !== null &&
      frame !== null &&
      pickViewPin(pinsRef.current, pixel, frame.pxWidth / MINIMAP_CSS_WIDTH) !==
        null;
    event.currentTarget.style.cursor = overPin ? 'pointer' : '';
  };

  const endDrag = (event: PointerEvent<HTMLCanvasElement>) => {
    const press = pinPressRef.current;
    if (!press && !draggingRef.current) return;
    pinPressRef.current = null;
    draggingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    // 끌지 않고 놓은 핀만 그 뷰로 — 취소(pointercancel)는 옮기지 않는다.
    if (press && event.type === 'pointerup') onSelectView(press.view);
  };

  // 저장 비율 → px 복원. 컨테이너는 오버레이 슬롯(캔버스 영역 inset-0)이고
  // 전체화면 전환도 컨테이너 리사이즈로 들어와 같은 경로를 탄다. 비율은
  // 컨테이너 크기를 알아야 px 가 되므로 레이아웃 effect 로 첫 페인트 전에
  // 놓는다 — 좌상단에서 튀는 한 프레임을 없앤다.
  useLayoutEffect(() => {
    if (!visible || !snapshot || position === null) return;
    const panel = panelRef.current;
    const container = panel?.parentElement;
    if (!panel || !container) return;
    const place = () => {
      const next = panelRatioToPosition(
        useSceneMinimapStore.getState().position ?? position,
        panel.offsetWidth,
        panel.offsetHeight,
        container.clientWidth,
        container.clientHeight,
      );
      panel.style.left = `${next.x}px`;
      panel.style.top = `${next.y}px`;
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(container);
    return () => observer.disconnect();
  }, [visible, snapshot, position]);

  const handlePanelPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const panel = panelRef.current;
    const container = panel?.parentElement;
    if (!panel || !container) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const panelRect = panel.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    panelDragRef.current = {
      offsetX: event.clientX - panelRect.left,
      offsetY: event.clientY - panelRect.top,
      last: {
        x: panelRect.left - containerRect.left,
        y: panelRect.top - containerRect.top,
      },
    };
    // 기본 자리(bottom/left 클래스)에서 끌기 시작하면 절대 좌표로 전환한다.
    panel.style.bottom = 'auto';
    panel.style.left = `${panelDragRef.current.last.x}px`;
    panel.style.top = `${panelDragRef.current.last.y}px`;
  };

  const handlePanelPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = panelDragRef.current;
    const panel = panelRef.current;
    const container = panel?.parentElement;
    if (!drag || !panel || !container) return;
    const containerRect = container.getBoundingClientRect();
    const next = clampPanelPosition(
      {
        x: event.clientX - containerRect.left - drag.offsetX,
        y: event.clientY - containerRect.top - drag.offsetY,
      },
      panel.offsetWidth,
      panel.offsetHeight,
      container.clientWidth,
      container.clientHeight,
    );
    drag.last = next;
    panel.style.left = `${next.x}px`;
    panel.style.top = `${next.y}px`;
  };

  const endPanelDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = panelDragRef.current;
    const panel = panelRef.current;
    const container = panel?.parentElement;
    if (!drag) return;
    panelDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!panel || !container) return;
    // 놓는 순간의 컨테이너 크기로 비율을 만들어 저장한다.
    setPosition(
      panelPositionToRatio(
        drag.last,
        panel.offsetWidth,
        panel.offsetHeight,
        container.clientWidth,
        container.clientHeight,
      ),
    );
  };

  if (!visible || !snapshot || !frame) return null;

  const moveLabel = t('common:viewer3d.minimapMove', {
    defaultValue: '끌어서 미니맵 위치 이동',
  });
  const hideLabel = t('common:viewer3d.minimapHide', {
    defaultValue: '미니맵 숨기기',
  });

  return (
    <div
      ref={panelRef}
      data-slot="scene-minimap"
      className={cn(
        'pointer-events-auto absolute z-20 overflow-hidden rounded-md border border-white/20 bg-black/50 shadow-md backdrop-blur-sm',
        position === null && 'bottom-1.5 left-1.5',
        className,
      )}
      // 비율 위치의 left/top 은 위 레이아웃 effect 가 px 로 놓는다.
      style={{ width: MINIMAP_CSS_WIDTH }}
    >
      <div
        className="flex h-5 cursor-move touch-none items-center justify-between bg-black/40 pl-1 select-none"
        title={moveLabel}
        onPointerDown={handlePanelPointerDown}
        onPointerMove={handlePanelPointerMove}
        onPointerUp={endPanelDrag}
        onPointerCancel={endPanelDrag}
      >
        <GripHorizontal className="size-3.5 text-white/60" aria-hidden />
        <div
          className="flex gap-0.5"
          // 버튼 클릭이 패널 드래그를 시작하지 않게 한다.
          onPointerDown={(event) => event.stopPropagation()}
        >
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={hideLabel}
                  className="size-5 rounded-none text-white/80 hover:bg-white/20 hover:text-white"
                />
              }
              onClick={() => setVisible(false)}
            >
              <X className="size-3" />
            </TooltipTrigger>
            <TooltipContent side="top">{hideLabel}</TooltipContent>
          </Tooltip>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        width={frame.pxWidth}
        height={frame.pxHeight}
        aria-label={t('common:viewer3d.minimap', { defaultValue: '미니맵' })}
        title={t('common:viewer3d.minimapHint', {
          defaultValue: '누르거나 끌어서 카메라 이동',
        })}
        className="block cursor-crosshair touch-none select-none"
        style={{ width: MINIMAP_CSS_WIDTH, height: cssHeight }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={() => {
          hoverRef.current = null;
        }}
      />
    </div>
  );
}

/**
 * 모델 루트의 바운딩 박스 중심 XZ 오프셋. 루트 원점이 모델 한쪽 끝에 있는
 * 자산(선박 등)의 마커가 치우치지 않게 첫 관측 때 한 번 재고 캐시한다 —
 * 매 틱 Box3.setFromObject 는 노드 수 비례라 피한다. 루트가 태그로 회전하면
 * 오프셋이 약간 어긋나지만(드묾) 마커 용도엔 무해하다.
 */
function markerOffset(
  object: Object3D,
  cache: MarkerCache,
): { dx: number; dz: number } {
  const cached = cache.offsetByUuid.get(object.uuid);
  if (cached) return cached;
  cache.box.setFromObject(object);
  object.getWorldPosition(cache.position);
  const offset = cache.box.isEmpty()
    ? { dx: 0, dz: 0 }
    : (() => {
        cache.box.getCenter(cache.center);
        return {
          dx: cache.center.x - cache.position.x,
          dz: cache.center.z - cache.position.z,
        };
      })();
  cache.offsetByUuid.set(object.uuid, offset);
  return offset;
}

function drawMarkers(
  context: CanvasRenderingContext2D,
  frame: MinimapFrame,
  scale: number,
  sceneInfo: SavedSceneInfo | null,
  alarms: Record<string, AlarmSeverity>,
  cache: MarkerCache,
): DrawnMarker[] {
  const drawn: DrawnMarker[] = [];
  const radius = MARKER_RADIUS_PX * scale;
  for (const model of sceneInfo?.models ?? []) {
    const object = modelObjectRegistry.get(model.id);
    if (!object) continue;
    const offset = markerOffset(object, cache);
    object.getWorldPosition(cache.position);
    const { px, py } = worldToMinimap(
      frame,
      cache.position.x + offset.dx,
      cache.position.z + offset.dz,
    );
    if (px < 0 || py < 0 || px > frame.pxWidth || py > frame.pxHeight) {
      continue;
    }
    const severity = model.craneId ? alarms[model.craneId] : undefined;
    context.beginPath();
    context.arc(px, py, radius, 0, Math.PI * 2);
    // 알람 > 기본.
    context.fillStyle = severity ? SEVERITY_COLORS[severity] : MARKER_COLOR;
    context.fill();
    context.lineWidth = scale;
    context.strokeStyle = 'rgba(0, 0, 0, 0.7)';
    context.stroke();
    drawn.push({ px, py, name: model.equipName || model.id });
  }
  return drawn;
}

/** 고정 뷰 → 핀 픽셀. 타깃이 지도 밖인 뷰는 뺀다(번호는 그대로). */
function resolveViewPins(
  frame: MinimapFrame,
  scale: number,
  views: readonly SavedSceneView[],
): DrawnViewPin[] {
  const pins: DrawnViewPin[] = [];
  views.forEach((view, index) => {
    const tip = worldToMinimap(frame, view.target[0], view.target[2]);
    if (
      tip.px < 0 ||
      tip.py < 0 ||
      tip.px > frame.pxWidth ||
      tip.py > frame.pxHeight
    ) {
      return;
    }
    const head = viewPinHead(
      tip.px,
      tip.py,
      VIEW_PIN_STEM_PX * scale,
      VIEW_PIN_RADIUS_PX * scale,
    );
    pins.push({
      view,
      number: index + 1,
      px: head.px,
      py: head.py,
      tipPx: tip.px,
      tipPy: tip.py,
      flipped: head.flipped,
    });
  });
  return pins;
}

/** 포인터 아래의 핀(머리 기준, 장비 마커와 같은 반경). 없으면 null. */
function pickViewPin(
  pins: DrawnViewPin[],
  pointer: { px: number; py: number } | null,
  scale: number,
): DrawnViewPin | null {
  if (!pointer) return null;
  const index = nearestMarkerIndex(
    pins,
    pointer.px,
    pointer.py,
    MARKER_HIT_RADIUS_PX * scale,
  );
  return index >= 0 ? pins[index] : null;
}

/**
 * 고정 뷰 핀들 — 평소 → 현재 → 호버 순으로 그려 강조한 핀이 위에 온다.
 * 호버한 핀은 그 뷰의 카메라 위치(점)·시야 부채꼴과 타깃까지의 점선을 먼저
 * 깐다. 현재 핀이면 지금 카메라가 그 자리라 점·부채꼴은 생략한다.
 */
function drawViewPins(
  context: CanvasRenderingContext2D,
  frame: MinimapFrame,
  scale: number,
  pins: DrawnViewPin[],
  hovered: DrawnViewPin | null,
  current: DrawnViewPin | null,
): void {
  for (const pin of pins) {
    if (pin !== hovered && pin !== current) {
      drawViewPin(context, scale, pin, 'normal');
    }
  }
  if (current && current !== hovered) {
    drawViewPin(context, scale, current, 'current');
  }
  if (!hovered) return;
  const isCurrent = hovered === current;
  const camera = resolveCameraDraw(frame, scale, hovered.view);
  if (camera) {
    if (!isCurrent) drawCameraFootprint(context, scale, camera);
    context.save();
    context.setLineDash([2.5 * scale, 2 * scale]);
    context.beginPath();
    context.moveTo(camera.px, camera.py);
    context.lineTo(hovered.tipPx, hovered.tipPy);
    context.lineWidth = 2.4 * scale;
    context.strokeStyle = 'rgba(0, 0, 0, 0.45)';
    context.stroke();
    context.lineWidth = scale;
    context.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    context.stroke();
    context.restore();
    if (!isCurrent) {
      context.beginPath();
      context.arc(camera.px, camera.py, 2.4 * scale, 0, Math.PI * 2);
      context.fillStyle = 'rgba(0, 0, 0, 0.5)';
      context.fill();
      strokeWithHalo(context, scale, 1.2);
    }
  }
  drawViewPin(context, scale, hovered, isCurrent ? 'current' : 'hover');
}

/** 핀 하나 — 끝이 타깃에 닿는 물방울 모양, 머리에 번호. */
function drawViewPin(
  context: CanvasRenderingContext2D,
  scale: number,
  pin: DrawnViewPin,
  state: 'normal' | 'hover' | 'current',
): void {
  const radius = VIEW_PIN_RADIUS_PX * scale;
  const stem = VIEW_PIN_STEM_PX * scale;
  // 머리 원에서 핀 끝 쪽으로 열린 호 — 양 끝이 끝점에서 그은 접선의 접점.
  const tipAngle = pin.flipped ? -Math.PI / 2 : Math.PI / 2;
  const spread = Math.acos(radius / stem);
  context.save();
  context.beginPath();
  context.moveTo(pin.tipPx, pin.tipPy);
  context.arc(
    pin.px,
    pin.py,
    radius,
    tipAngle + spread,
    tipAngle + Math.PI * 2 - spread,
  );
  context.closePath();
  context.fillStyle =
    state === 'current'
      ? CAMERA_COLOR
      : state === 'hover'
        ? VIEW_PIN_FILL_HOVER
        : VIEW_PIN_FILL;
  context.fill();
  strokeWithHalo(context, scale, state === 'hover' ? 1.8 : 1.3);
  context.fillStyle =
    state === 'current' ? VIEW_PIN_NUMBER_CURRENT : CAMERA_COLOR;
  context.font = `600 ${8 * scale}px ${LABEL_FONT_FAMILY}`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(String(pin.number), pin.px, pin.py + 0.4 * scale);
  context.restore();
}

/** 현재 경로를 검은 바깥선 + 흰 안선으로 — 밝은 지도·어두운 바다 모두 읽힌다. */
function strokeWithHalo(
  context: CanvasRenderingContext2D,
  scale: number,
  widthPx: number,
): void {
  context.save();
  context.lineJoin = 'round';
  context.lineWidth = (widthPx + 1.7) * scale;
  context.strokeStyle = 'rgba(0, 0, 0, 0.55)';
  context.stroke();
  context.lineWidth = widthPx * scale;
  context.strokeStyle = CAMERA_COLOR;
  context.stroke();
  context.restore();
}

/** 카메라 그리기에 필요한 픽셀 값 — 부채꼴·픽토그램이 같은 값을 쓴다. */
interface CameraDraw {
  px: number;
  py: number;
  heading: number;
  halfAngle: number;
  /** 시선 방향이 정의되는가(정수직 탑뷰가 아닌가). */
  hasHeading: boolean;
  lengthPx: number;
}

function resolveCameraDraw(
  frame: MinimapFrame,
  scale: number,
  pose: { position: Vector3Tuple; target: Vector3Tuple } | null,
): CameraDraw | null {
  if (!pose) return null;
  const footprint = cameraFootprint(pose, FOOTPRINT_ANGLE_DEG);
  const origin = worldToMinimap(frame, footprint.x, footprint.z);
  const unitsPerPx = frame.worldWidth / frame.pxWidth;
  // 카메라→타깃 거리는 이 판정에만 쓰고 부채꼴 길이는 고정 픽셀이다.
  return {
    px: origin.px,
    py: origin.py,
    heading: footprint.heading,
    halfAngle: footprint.halfAngle,
    hasHeading: footprint.length / unitsPerPx > HEADING_MIN_DISTANCE_PX * scale,
    lengthPx: FOOTPRINT_LENGTH_PX * scale,
  };
}

/** 시야 부채꼴 — 정수직 탑뷰면 그리지 않는다. */
function drawCameraFootprint(
  context: CanvasRenderingContext2D,
  scale: number,
  camera: CameraDraw,
): void {
  if (!camera.hasHeading) return;
  const { px, py, heading, halfAngle, lengthPx } = camera;
  const gradient = context.createRadialGradient(px, py, 0, px, py, lengthPx);
  gradient.addColorStop(0, FOOTPRINT_FILL_NEAR);
  gradient.addColorStop(0.45, FOOTPRINT_FILL_MID);
  gradient.addColorStop(1, FOOTPRINT_FILL_FAR);
  context.beginPath();
  context.moveTo(px, py);
  context.arc(px, py, lengthPx, heading - halfAngle, heading + halfAngle);
  context.closePath();
  context.fillStyle = gradient;
  context.fill();
  // 모서리 직선 — 호는 그리지 않는다.
  context.beginPath();
  for (const angle of [heading - halfAngle, heading + halfAngle]) {
    context.moveTo(px, py);
    context.lineTo(
      px + Math.cos(angle) * lengthPx,
      py + Math.sin(angle) * lengthPx,
    );
  }
  context.lineWidth = FOOTPRINT_EDGE_WIDTH_PX * scale;
  context.strokeStyle = FOOTPRINT_EDGE;
  context.stroke();
}

/** 카메라 위치 — 시선 방향으로 돌린 카메라 픽토그램. 탑뷰(방향 없음)면 점. */
function drawCameraGlyph(
  context: CanvasRenderingContext2D,
  scale: number,
  camera: CameraDraw,
): void {
  const { px, py, heading, hasHeading } = camera;
  context.beginPath();
  if (hasHeading) {
    const points = cameraGlyphPolygon(
      px,
      py,
      heading,
      CAMERA_GLYPH_SIZE_PX * scale,
    );
    context.moveTo(points[0].px, points[0].py);
    for (let i = 1; i < points.length; i += 1) {
      context.lineTo(points[i].px, points[i].py);
    }
    context.closePath();
  } else {
    context.arc(px, py, 2 * scale, 0, Math.PI * 2);
  }
  context.fillStyle = CAMERA_COLOR;
  context.fill();
  context.lineWidth = 1 * scale;
  context.strokeStyle = 'rgba(0, 0, 0, 0.7)';
  context.stroke();
}

/** 포인터 아래의 마커(반경 안 최근접). 없으면 null. */
function resolveHover(
  markers: DrawnMarker[],
  hover: { px: number; py: number } | null,
  scale: number,
): DrawnMarker | null {
  if (!hover) return null;
  const index = nearestMarkerIndex(
    markers,
    hover.px,
    hover.py,
    MARKER_HIT_RADIUS_PX * scale,
  );
  return index >= 0 ? markers[index] : null;
}

function drawHoverLabel(
  context: CanvasRenderingContext2D,
  scale: number,
  label: HoverLabel | null,
): void {
  if (!label) return;
  const text = label.name;
  const { px, py } = label;
  const gap = label.gapPx * scale;
  const fontPx = 11 * scale;
  context.font = `${fontPx}px ${LABEL_FONT_FAMILY}`;
  context.textBaseline = 'middle';
  const paddingX = 4 * scale;
  const textWidth = context.measureText(text).width;
  const boxWidth = textWidth + paddingX * 2;
  const boxHeight = fontPx + 4 * scale;
  // 오른쪽에 자리가 없으면 왼쪽에 그린다.
  const fitsRight = px + gap + boxWidth <= context.canvas.width;
  const boxX = fitsRight ? px + gap : px - gap - boxWidth;
  const boxY = py - boxHeight / 2;
  context.fillStyle = 'rgba(0, 0, 0, 0.75)';
  context.fillRect(boxX, boxY, boxWidth, boxHeight);
  context.fillStyle = '#ffffff';
  context.fillText(text, boxX + paddingX, py);
}
