import { GripHorizontal, X } from 'lucide-react';
import { useCallback, useEffect, useRef, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Box3, Vector3, type Object3D } from 'three';
import { modelObjectRegistry, type SavedSceneInfo } from '@crane/domain/3d';
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
  minimapToWorld,
  nearestMarkerIndex,
  panPoseToPoint,
  worldToMinimap,
  type MinimapFrame,
} from '../lib/minimap';
import { zoneColorWithAlpha } from '../lib/scene-zones';
import { useObjectFocusStore } from '../model/use-object-focus-store';
import { useSceneMinimapStore } from '../model/use-scene-minimap-store';

/**
 * 모니터링 2D 미니맵 — 캔버스 좌하단 오버레이.
 *
 * 배경은 SceneMinimapCapture 가 찍어 둔 탑뷰 스냅샷이고, 그 위에 매 폴링
 * 틱마다 장비 마커(레지스트리의 현재 월드 위치 — 리그·태그로 움직인 자세를
 * 따라간다)와 카메라(시선 방향으로 도는 카메라 픽토그램 + 같은 색의 시야
 * 부채꼴, 강조색 CAMERA_COLOR 청록)를 그린다. 부채꼴은 방향 표시일 뿐이라
 * 각·길이가 고정이고 카메라 fov·타깃 거리를 따라가지 않는다. 영역 원은
 * 그리지 않는다 — 3D 링과
 * HUD 가 담당하고 미니맵에선 마커를 가린다. 그리기는 setInterval 로 2D
 * 캔버스에 직접 하고 React 상태를 건드리지 않는다 — 카메라·장비는 프레임
 * 속도로 바뀌므로 setState 로 따라가면 커밋이 그 속도로 돈다(perf HUD 와
 * 같은 규칙).
 *
 * 조작: 누르면 그 지점으로, 누른 채 끌면 끄는 대로 카메라 타깃이 옮겨진다.
 * 높이·시선 방향·거리는 그대로(팬과 같다 — lib/minimap panPoseToPoint).
 * 포인터 캡처로 미니맵 밖까지 끌어도 이어지고, 픽셀은 이미지 안으로 클램프
 * 되어 지도 밖으로 튀지 않는다. 이동 자체는 뷰어 컨트롤러 moveTo(북마크·
 * 포커스 복귀와 같은 경로)라 카메라 이동 제한(SceneCameraLimits)이 그대로
 * 걸린다.
 *
 * 마커 위에 포인터를 올리면 장비 이름을 그 옆에 그린다. 마커 색은 알람
 * severity(critical·high·medium·info) 를 따르고 없으면 노랑(MARKER_COLOR —
 * 운전 상태 색은 HUD·3D 라벨이 담당한다), 포커스 중인 모델은 흰 테두리다.
 *
 * 패널 자체는 상단 헤더 바(그립)를 끌어 캔버스 영역 안 어디든 놓을 수 있다.
 * 끄는 동안은 스타일을 직접 써서 리렌더하지 않고, 놓을 때 스토어에 저장한다
 * (localStorage 영속, 리전 무관). 저장 위치는 마운트·리사이즈 때 컨테이너
 * 안으로 클램프한다 — 큰 창에서 우하단에 두고 작은 창에서 열어도 밖으로
 * 나가지 않는다. 위치가 없으면(기본) 좌하단이다.
 */

/** 미니맵 표시 폭(CSS px). 높이는 스냅샷 종횡비를 따른다. */
const MINIMAP_CSS_WIDTH = 224;
const DRAW_INTERVAL_MS = 66;
const MARKER_RADIUS_PX = 2;
const MARKER_HIT_RADIUS_PX = 8;
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
/** 카메라 픽토그램·시야 부채꼴 공통 색. */
const CAMERA_COLOR = '#22d3ee';
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

interface SceneMinimapProps {
  sceneInfo: SavedSceneInfo | null;
  alarmsByCraneId: Record<string, AlarmSeverity>;
  /** 현재 카메라 포즈. 컨트롤러 준비 전이면 null. */
  getPose: () => { position: Vector3Tuple; target: Vector3Tuple } | null;
  /** 카메라를 즉시 옮긴다 — 북마크·포커스 복귀와 같은 경로. */
  onMoveTo: (position: Vector3Tuple, target: Vector3Tuple) => void;
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
  modelId: string;
}

export function SceneMinimap({
  sceneInfo,
  alarmsByCraneId,
  getPose,
  onMoveTo,
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
      markersRef.current = drawMarkers(
        context,
        drawFrame,
        scale,
        sceneInfo,
        alarmsByCraneId,
        useObjectFocusStore.getState().focusedModelId,
        cacheRef.current,
      );
      drawCamera(context, drawFrame, scale, getPose());
      const hit = resolveHover(markersRef.current, hoverRef.current, scale);
      drawHoverLabel(context, scale, hit);
      // 마커 위에서는 클릭이 포커스라 커서로 알려 준다.
      canvas.style.cursor = hit ? 'pointer' : 'crosshair';
    };

    // prop 이 바뀌면 인터벌을 다시 건다 — 씬·알람·getPose 는 드물게 바뀌어
    // 재등록 비용이 무시할 만하고, 렌더 중 ref 미러(react-hooks/refs 금지)를
    // 피한다.
    draw();
    const timer = window.setInterval(draw, DRAW_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [visible, snapshot, sceneInfo, alarmsByCraneId, getPose]);

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
    // 마커를 누르면 카메라 팬이 아니라 그 모델 포커스(씬 안 클릭과 같은
    // 경로 — 포커스 중인 모델을 다시 누르면 돌아가기). 드래그는 시작하지
    // 않는다.
    const hit = resolveHover(
      markersRef.current,
      pixel,
      frame.pxWidth / MINIMAP_CSS_WIDTH,
    );
    if (hit) {
      const focus = useObjectFocusStore.getState();
      if (focus.focusedModelId === hit.modelId) focus.exitFocus();
      else if (focus.focusedModelId === null) {
        focus.enterFocus(hit.modelId, getPose());
      }
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    draggingRef.current = true;
    moveCameraTo(pixel.px, pixel.py);
  };

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const pixel = localPixel(event);
    hoverRef.current = pixel;
    if (draggingRef.current && pixel) {
      moveCameraTo(pixel.px, pixel.py);
    }
  };

  const endDrag = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  // 저장 위치 복원·리사이즈 클램프. 컨테이너는 오버레이 슬롯(캔버스 영역
  // inset-0)이다.
  useEffect(() => {
    if (!visible || !snapshot || position === null) return;
    const panel = panelRef.current;
    const container = panel?.parentElement;
    if (!panel || !container) return;
    const clamp = () => {
      const next = clampPanelPosition(
        useSceneMinimapStore.getState().position ?? position,
        panel.offsetWidth,
        panel.offsetHeight,
        container.clientWidth,
        container.clientHeight,
      );
      panel.style.left = `${next.x}px`;
      panel.style.top = `${next.y}px`;
    };
    clamp();
    const observer = new ResizeObserver(clamp);
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
    if (!drag) return;
    panelDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setPosition(drag.last);
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
        position === null && 'bottom-3 left-3',
        className,
      )}
      style={
        position === null
          ? { width: MINIMAP_CSS_WIDTH }
          : { width: MINIMAP_CSS_WIDTH, left: position.x, top: position.y }
      }
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
  focusedModelId: string | null,
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
    const isFocused = focusedModelId === model.id;
    context.beginPath();
    context.arc(px, py, isFocused ? radius * 1.4 : radius, 0, Math.PI * 2);
    // 알람 > 기본.
    context.fillStyle = severity ? SEVERITY_COLORS[severity] : MARKER_COLOR;
    context.fill();
    context.lineWidth = (isFocused ? 2 : 1) * scale;
    context.strokeStyle = isFocused ? '#ffffff' : 'rgba(0, 0, 0, 0.7)';
    context.stroke();
    drawn.push({
      px,
      py,
      name: model.equipName || model.id,
      modelId: model.id,
    });
  }
  return drawn;
}

function drawCamera(
  context: CanvasRenderingContext2D,
  frame: MinimapFrame,
  scale: number,
  pose: { position: Vector3Tuple; target: Vector3Tuple } | null,
): void {
  if (!pose) return;
  const footprint = cameraFootprint(pose, FOOTPRINT_ANGLE_DEG);
  const origin = worldToMinimap(frame, footprint.x, footprint.z);
  const unitsPerPx = frame.worldWidth / frame.pxWidth;

  // 시선 방향이 정의되는(정수직 탑뷰가 아닌) 경우에만 부채꼴·픽토그램.
  // 카메라→타깃 거리는 이 판정에만 쓰고 부채꼴 길이는 고정 픽셀이다.
  const hasHeading =
    footprint.length / unitsPerPx > HEADING_MIN_DISTANCE_PX * scale;
  const lengthPx = FOOTPRINT_LENGTH_PX * scale;
  if (hasHeading) {
    const gradient = context.createRadialGradient(
      origin.px,
      origin.py,
      0,
      origin.px,
      origin.py,
      lengthPx,
    );
    gradient.addColorStop(0, FOOTPRINT_FILL_NEAR);
    gradient.addColorStop(0.45, FOOTPRINT_FILL_MID);
    gradient.addColorStop(1, FOOTPRINT_FILL_FAR);
    context.beginPath();
    context.moveTo(origin.px, origin.py);
    context.arc(
      origin.px,
      origin.py,
      lengthPx,
      footprint.heading - footprint.halfAngle,
      footprint.heading + footprint.halfAngle,
    );
    context.closePath();
    context.fillStyle = gradient;
    context.fill();
    // 모서리 직선 — 호는 그리지 않는다.
    context.beginPath();
    for (const angle of [
      footprint.heading - footprint.halfAngle,
      footprint.heading + footprint.halfAngle,
    ]) {
      context.moveTo(origin.px, origin.py);
      context.lineTo(
        origin.px + Math.cos(angle) * lengthPx,
        origin.py + Math.sin(angle) * lengthPx,
      );
    }
    context.lineWidth = FOOTPRINT_EDGE_WIDTH_PX * scale;
    context.strokeStyle = FOOTPRINT_EDGE;
    context.stroke();
  }

  // 카메라 위치 — 시선 방향으로 돌린 카메라 픽토그램. 탑뷰(방향 없음)면 점.
  context.beginPath();
  if (hasHeading) {
    const points = cameraGlyphPolygon(
      origin.px,
      origin.py,
      footprint.heading,
      CAMERA_GLYPH_SIZE_PX * scale,
    );
    context.moveTo(points[0].px, points[0].py);
    for (let i = 1; i < points.length; i += 1) {
      context.lineTo(points[i].px, points[i].py);
    }
    context.closePath();
  } else {
    context.arc(origin.px, origin.py, 2 * scale, 0, Math.PI * 2);
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
  hit: DrawnMarker | null,
): void {
  if (!hit) return;
  const text = hit.name;
  const { px, py } = hit;
  const fontPx = 11 * scale;
  context.font = `${fontPx}px system-ui, sans-serif`;
  context.textBaseline = 'middle';
  const paddingX = 4 * scale;
  const textWidth = context.measureText(text).width;
  const boxWidth = textWidth + paddingX * 2;
  const boxHeight = fontPx + 4 * scale;
  // 오른쪽에 자리가 없으면 왼쪽에 그린다.
  const fitsRight = px + 8 * scale + boxWidth <= context.canvas.width;
  const boxX = fitsRight ? px + 8 * scale : px - 8 * scale - boxWidth;
  const boxY = py - boxHeight / 2;
  context.fillStyle = 'rgba(0, 0, 0, 0.75)';
  context.fillRect(boxX, boxY, boxWidth, boxHeight);
  context.fillStyle = '#ffffff';
  context.fillText(text, boxX + paddingX, py);
}
