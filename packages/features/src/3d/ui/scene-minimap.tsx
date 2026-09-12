import { GripHorizontal, RefreshCw, X } from 'lucide-react';
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
  RUNTIME_STATUS_COLORS,
  type RuntimeStatusRecord,
} from '../lib/model-runtime-status';
import {
  cameraFootprint,
  clampPanelPosition,
  horizontalFovDeg,
  minimapToWorld,
  nearestMarkerIndex,
  panPoseToPoint,
  worldToMinimap,
  type MinimapFrame,
} from '../lib/minimap';
import { useObjectFocusStore } from '../model/use-object-focus-store';
import {
  minimapCameraInfo,
  useSceneMinimapStore,
} from '../model/use-scene-minimap-store';

/**
 * 모니터링 2D 미니맵 — 캔버스 좌하단 오버레이.
 *
 * 배경은 SceneMinimapCapture 가 찍어 둔 탑뷰 스냅샷이고, 그 위에 매 폴링
 * 틱마다 장비 마커(레지스트리의 현재 월드 위치 — 리그·태그로 움직인 자세를
 * 따라간다)와 카메라 발자국(부채꼴)을 그린다. 그리기는 setInterval 로 2D
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
 * severity(critical·high·medium·info) 를 따르고 없으면 청록, 포커스 중인
 * 모델은 흰 테두리다.
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
const MARKER_RADIUS_PX = 3.5;
const MARKER_HIT_RADIUS_PX = 8;
/** 부채꼴을 카메라→타깃 거리보다 이만큼 더 그린다 — 타깃 너머도 보인다. */
const FOOTPRINT_LENGTH_RATIO = 1.6;

const SEVERITY_COLORS: Record<AlarmSeverity, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#f59e0b',
  info: '#3b82f6',
};
const MARKER_COLOR = '#22d3ee';
const FOOTPRINT_FILL = 'rgba(255, 255, 255, 0.22)';
const FOOTPRINT_STROKE = 'rgba(255, 255, 255, 0.85)';

interface SceneMinimapProps {
  sceneInfo: SavedSceneInfo | null;
  alarmsByCraneId: Record<string, AlarmSeverity>;
  /** 모델별 운전 상태 — 알람이 없는 마커의 색(running·idle·offline). */
  runtimeStatuses?: RuntimeStatusRecord;
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
}

const NO_STATUSES: RuntimeStatusRecord = Object.freeze({});

export function SceneMinimap({
  sceneInfo,
  alarmsByCraneId,
  runtimeStatuses = NO_STATUSES,
  getPose,
  onMoveTo,
  className,
}: SceneMinimapProps) {
  const { t } = useTranslation();
  const snapshot = useSceneMinimapStore((s) => s.snapshot);
  const visible = useSceneMinimapStore((s) => s.visible);
  const setVisible = useSceneMinimapStore((s) => s.setVisible);
  const requestCapture = useSceneMinimapStore((s) => s.requestCapture);
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
        runtimeStatuses,
        useObjectFocusStore.getState().focusedModelId,
        cacheRef.current,
      );
      drawCamera(context, drawFrame, scale, getPose());
      drawHoverLabel(context, scale, markersRef.current, hoverRef.current);
    };

    // prop 이 바뀌면 인터벌을 다시 건다 — 씬·알람·getPose 는 드물게 바뀌어
    // 재등록 비용이 무시할 만하고, 렌더 중 ref 미러(react-hooks/refs 금지)를
    // 피한다.
    draw();
    const timer = window.setInterval(draw, DRAW_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [visible, snapshot, sceneInfo, alarmsByCraneId, runtimeStatuses, getPose]);

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
    if (!pixel) return;
    event.preventDefault();
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
  const refreshLabel = t('common:viewer3d.minimapRefresh', {
    defaultValue: '미니맵 새로 고침',
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
        className="flex h-6 cursor-move touch-none items-center justify-between bg-black/40 px-1 select-none"
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
                  aria-label={refreshLabel}
                  className="text-white/80 hover:bg-white/20 hover:text-white"
                />
              }
              onClick={requestCapture}
            >
              <RefreshCw className="size-3" />
            </TooltipTrigger>
            <TooltipContent side="top">{refreshLabel}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={hideLabel}
                  className="text-white/80 hover:bg-white/20 hover:text-white"
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
  statuses: RuntimeStatusRecord,
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
    // 알람 > 운전 상태 > 기본(상태 미확인).
    const statusColor = RUNTIME_STATUS_COLORS[statuses[model.id] ?? 'unknown'];
    context.fillStyle = severity
      ? SEVERITY_COLORS[severity]
      : (statusColor ?? MARKER_COLOR);
    context.fill();
    context.lineWidth = (isFocused ? 2 : 1) * scale;
    context.strokeStyle = isFocused ? '#ffffff' : 'rgba(0, 0, 0, 0.7)';
    context.stroke();
    drawn.push({ px, py, name: model.equipName || model.id });
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
  const footprint = cameraFootprint(
    pose,
    horizontalFovDeg(minimapCameraInfo.fovDeg, minimapCameraInfo.aspect),
  );
  const origin = worldToMinimap(frame, footprint.x, footprint.z);
  const unitsPerPx = frame.worldWidth / frame.pxWidth;
  const lengthPx = (footprint.length * FOOTPRINT_LENGTH_RATIO) / unitsPerPx;

  if (lengthPx > 2 * scale) {
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
    context.fillStyle = FOOTPRINT_FILL;
    context.fill();
    context.lineWidth = 1 * scale;
    context.strokeStyle = FOOTPRINT_STROKE;
    context.stroke();
  }

  // 타깃(화면 중앙이 보는 지점) 십자.
  const target = worldToMinimap(frame, pose.target[0], pose.target[2]);
  const arm = 4 * scale;
  context.beginPath();
  context.moveTo(target.px - arm, target.py);
  context.lineTo(target.px + arm, target.py);
  context.moveTo(target.px, target.py - arm);
  context.lineTo(target.px, target.py + arm);
  context.lineWidth = 1.5 * scale;
  context.strokeStyle = FOOTPRINT_STROKE;
  context.stroke();

  // 카메라 위치 점.
  context.beginPath();
  context.arc(origin.px, origin.py, 3 * scale, 0, Math.PI * 2);
  context.fillStyle = '#ffffff';
  context.fill();
  context.lineWidth = 1 * scale;
  context.strokeStyle = 'rgba(0, 0, 0, 0.7)';
  context.stroke();
}

function drawHoverLabel(
  context: CanvasRenderingContext2D,
  scale: number,
  markers: DrawnMarker[],
  hover: { px: number; py: number } | null,
): void {
  if (!hover) return;
  const index = nearestMarkerIndex(
    markers,
    hover.px,
    hover.py,
    MARKER_HIT_RADIUS_PX * scale,
  );
  if (index < 0) return;
  const marker = markers[index];
  const fontPx = 11 * scale;
  context.font = `${fontPx}px system-ui, sans-serif`;
  context.textBaseline = 'middle';
  const paddingX = 4 * scale;
  const textWidth = context.measureText(marker.name).width;
  const boxWidth = textWidth + paddingX * 2;
  const boxHeight = fontPx + 4 * scale;
  // 오른쪽에 자리가 없으면 왼쪽에 그린다.
  const fitsRight = marker.px + 8 * scale + boxWidth <= context.canvas.width;
  const boxX = fitsRight
    ? marker.px + 8 * scale
    : marker.px - 8 * scale - boxWidth;
  const boxY = marker.py - boxHeight / 2;
  context.fillStyle = 'rgba(0, 0, 0, 0.75)';
  context.fillRect(boxX, boxY, boxWidth, boxHeight);
  context.fillStyle = '#ffffff';
  context.fillText(marker.name, boxX + paddingX, marker.py);
}
