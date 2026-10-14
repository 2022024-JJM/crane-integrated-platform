import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Vector3 } from 'three';
import type { Vector3Tuple } from '@crane/core/types/math';
import type { EquipmentLabelState } from '@crane/core/types/status';
import {
  LABEL_TONE_DOT_CLASS,
  getSceneMetersPerUnit,
  isBehindCamera,
  modelObjectRegistry,
  projectToScreen,
  setSceneDim,
  setSceneLookPlanView,
  type SavedSceneInfo,
  type ScreenPoint,
} from '@crane/domain/3d';
import {
  PLAN_ENV_DIM,
  PLAN_LABEL_GAP_PX,
  PLAN_STACK_INTERVAL_MS,
  isPlanLabelVisible,
  visibleExtentM,
  equipmentFocusPose,
  isPlanView,
  stackMarkerRows,
  type MarkerBox,
} from '../lib/plan-view';
import { dangerModelIds, proximityModelIds } from '../lib/scene-proximity';
import { isEquipment } from '../model/use-scene-proximity';
import { useSceneLookStore } from '../model/use-scene-look-store';
import { useSceneProximityStore } from '../model/use-scene-proximity-store';

/**
 * 평면(탑뷰) 장비 마커 — Canvas 안 null 컴포넌트, DOM 은 캔버스 옆에 직접
 * 붙인다(모델 라벨·화면 밖 화살표와 같은 방식). 카메라가 충분히 내려다보면
 * (lib/plan-view isPlanView) 장비마다 화면 고정 크기의 점(운전 상태 색) +
 * id 칩을 장비 위치에 띄우고, 그 동안 모델 라벨은 알람 중인 것만 남는다
 * (sceneLookSettings.planView). 겹친 칩은 주기적으로 아래로 밀어낸다. 위험
 * 쌍의 점은 적색 테두리. 누르면 그 장비의 비스듬한 뷰로 내려간다.
 */
const ROOT_CLASS =
  'pointer-events-auto absolute flex cursor-pointer items-center gap-1';
/** 근접 거리 라벨(drei Html, z 5~6) 아래, 모델 라벨 위 — 위험 정보가 마커에 가리지 않게. */
const ROOT_Z_INDEX = '4';
/**
 * 데이터 블록은 작게 — 항공관제처럼 평상시엔 점 + 반투명 작은 글자만 두어
 * 장면(크레인·거리 선)을 덮지 않고, 근접·위험에 든 장비만 큰 칩으로 올린다.
 */
const DOT_BASE = 'inline-block shrink-0 rounded-full ring-1 ring-black/70';
const DOT_SIZE = 'size-2.5';
const DOT_SIZE_WARN = 'size-3.5 ring-2 ring-[#ffd400]';
const DOT_SIZE_DANGER = 'size-3.5 ring-2 ring-[#ff2d2d]';
const DOT_TONE_FALLBACK = 'bg-zinc-500';
const CHIP_BASE =
  'rounded px-1 py-px font-mono leading-tight font-semibold whitespace-nowrap';
const CHIP_QUIET = 'bg-black/50 text-[10px] text-white/85';
const CHIP_WARN =
  'bg-[#ffd400] text-[12px] font-bold text-black ring-1 ring-black/60';
const CHIP_DANGER =
  'bg-[#ff2d2d] text-[12px] font-bold text-white ring-1 ring-black/60';
/** 점 반지름(px) — 점 중심이 투영점에 오도록 루트를 이만큼 당긴다. */
const DOT_HALF_PX = 5;

interface MarkerEntry {
  id: string;
  root: HTMLDivElement;
  dot: HTMLSpanElement;
  chip: HTMLSpanElement;
  tone: EquipmentLabelState['tone'] | null;
  alert: MarkerAlert;
  shown: boolean;
  x: number;
  y: number;
  offsetY: number;
  chipMargin: number;
  /** 평상시 칩 표시(높이 게이트·호버) — 바뀔 때만 display 를 쓴다. */
  chipShown: boolean;
  hover: boolean;
}

const _pos = new Vector3();
const _dir = new Vector3();
const _pt: ScreenPoint = { x: 0, y: 0 };

type MarkerAlert = 'none' | 'warn' | 'danger';

function dotClass(
  tone: EquipmentLabelState['tone'] | null,
  alert: MarkerAlert,
) {
  const color =
    tone && tone !== 'offline' && tone !== 'unknown'
      ? LABEL_TONE_DOT_CLASS[tone]
      : DOT_TONE_FALLBACK;
  const size =
    alert === 'danger'
      ? DOT_SIZE_DANGER
      : alert === 'warn'
        ? DOT_SIZE_WARN
        : DOT_SIZE;
  return `${DOT_BASE} ${size} ${color}`;
}

function chipClass(alert: MarkerAlert) {
  const look =
    alert === 'danger'
      ? CHIP_DANGER
      : alert === 'warn'
        ? CHIP_WARN
        : CHIP_QUIET;
  return `${CHIP_BASE} ${look}`;
}

export function ScenePlanMarkers({
  sceneInfo,
  regionId,
  labelStates,
  onMoveTo,
}: {
  sceneInfo: SavedSceneInfo | null;
  regionId: string | undefined;
  labelStates: Record<string, EquipmentLabelState>;
  onMoveTo: (position: Vector3Tuple, target: Vector3Tuple) => void;
}) {
  const canvas = useThree((s) => s.gl.domElement);
  const invalidate = useThree((s) => s.invalidate);
  const controlRoom = useSceneLookStore((s) => s.controlRoom);
  const equipment = useMemo(
    () =>
      (sceneInfo?.models ?? [])
        .filter(isEquipment)
        .map((m) => ({ id: m.id, name: m.equipName || m.id })),
    [sceneInfo],
  );
  const pairs = useSceneProximityStore((s) => s.outlinePairs);
  // 근접(주의·위험) 쌍에 든 장비가 큰 칩 — 평상시엔 점과 작은 글자만.
  const nearIds = useMemo(() => proximityModelIds(pairs), [pairs]);
  const dangerIds = useMemo(() => dangerModelIds(pairs), [pairs]);
  const entriesRef = useRef(new Map<string, MarkerEntry>());
  const stateRef = useRef({ plan: false, lastStackAt: 0 });
  const controlRoomRef = useRef(controlRoom);
  useEffect(() => {
    controlRoomRef.current = controlRoom;
    // 평면 모드 중 관제 모드를 토글하면 바탕 어둡힘도 따라간다.
    if (stateRef.current.plan) {
      setSceneDim(controlRoom ? PLAN_ENV_DIM : 0);
      invalidate();
    }
  }, [controlRoom, invalidate]);
  const moveToRef = useRef(onMoveTo);
  useEffect(() => {
    moveToRef.current = onMoveTo;
  }, [onMoveTo]);
  const mpu = getSceneMetersPerUnit(regionId);

  // 장비 목록이 바뀔 때만 DOM 을 만들고 지운다.
  useEffect(() => {
    const container = canvas.parentElement;
    if (!container) return;
    const entries = entriesRef.current;
    const alive = new Set<string>();
    for (const { id, name } of equipment) {
      alive.add(id);
      let entry = entries.get(id);
      if (!entry) {
        const root = document.createElement('div');
        root.className = ROOT_CLASS;
        root.style.display = 'none';
        // absolute 의 기준점을 컨테이너 원점에 — 이게 없으면 흐름상 캔버스
        // 아래에서 시작해 transform 이 화면 밖을 가리킨다.
        root.style.left = '0';
        root.style.top = '0';
        root.style.zIndex = ROOT_Z_INDEX;
        const dot = document.createElement('span');
        const chip = document.createElement('span');
        root.append(dot, chip);
        container.appendChild(root);
        entry = {
          id,
          root,
          dot,
          chip,
          tone: null,
          alert: 'none',
          shown: false,
          x: 0,
          y: 0,
          offsetY: 0,
          chipMargin: -1,
          chipShown: true,
          hover: false,
        };
        const created = entry;
        root.onmouseenter = () => {
          created.hover = true;
        };
        root.onmouseleave = () => {
          created.hover = false;
        };
        entries.set(id, entry);
      }
      entry.chip.textContent = name;
      entry.root.onclick = () => {
        const object = modelObjectRegistry.get(id);
        if (!object) return;
        object.getWorldPosition(_pos);
        const pose = equipmentFocusPose([_pos.x, _pos.y, _pos.z], mpu);
        moveToRef.current(pose.position, pose.target);
      };
    }
    for (const [id, entry] of entries) {
      if (alive.has(id)) continue;
      entry.root.remove();
      entries.delete(id);
    }
  }, [equipment, canvas, mpu]);

  // 상태 색·위험 테두리 — 바뀔 때만 클래스를 다시 쓴다.
  useEffect(() => {
    for (const entry of entriesRef.current.values()) {
      const tone = labelStates[entry.id]?.tone ?? null;
      const alert: MarkerAlert = dangerIds.has(entry.id)
        ? 'danger'
        : nearIds.has(entry.id)
          ? 'warn'
          : 'none';
      if (tone === entry.tone && alert === entry.alert) continue;
      entry.tone = tone;
      entry.alert = alert;
      entry.dot.className = dotClass(tone, alert);
      entry.chip.className = chipClass(alert);
    }
  }, [labelStates, nearIds, dangerIds, equipment]);

  useEffect(() => {
    const entries = entriesRef.current;
    return () => {
      for (const entry of entries.values()) entry.root.remove();
      entries.clear();
      setSceneLookPlanView(false);
      setSceneDim(0);
    };
  }, [canvas]);

  useFrame(({ camera, size }) => {
    const entries = entriesRef.current;
    const state = stateRef.current;
    camera.getWorldDirection(_dir);
    const plan = isPlanView(_dir.y);
    if (plan !== state.plan) {
      state.plan = plan;
      setSceneLookPlanView(plan);
      // 관제 모드의 평면 바탕은 더 어둡게 — 기호·칩이 뜬다.
      setSceneDim(plan && controlRoomRef.current ? PLAN_ENV_DIM : 0);
      invalidate();
      if (!plan) {
        for (const entry of entries.values()) {
          if (entry.shown) {
            entry.root.style.display = 'none';
            entry.shown = false;
          }
        }
      }
    }
    if (!plan || entries.size === 0) return;
    // 높이 게이트 — 야드 전체가 보이는 높이에선 평상시 칩을 숨기고 점만 둔다.
    const fov = (camera as { fov?: number }).fov ?? 75;
    const labelsOn = isPlanLabelVisible(
      visibleExtentM(camera.position.y, fov, mpu),
    );
    for (const entry of entries.values()) {
      const chipShown = entry.alert !== 'none' || labelsOn || entry.hover;
      if (chipShown !== entry.chipShown) {
        entry.chipShown = chipShown;
        entry.chip.style.display = chipShown ? '' : 'none';
      }
      const object = modelObjectRegistry.get(entry.id);
      if (!object) continue;
      object.getWorldPosition(_pos);
      const visible = !isBehindCamera(_pos, camera);
      if (visible !== entry.shown) {
        entry.root.style.display = visible ? '' : 'none';
        entry.shown = visible;
      }
      if (!visible) continue;
      projectToScreen(_pos, camera, size.width, size.height, _pt);
      entry.x = _pt.x;
      entry.y = _pt.y;
      if (entry.chipMargin !== PLAN_LABEL_GAP_PX) {
        entry.chipMargin = PLAN_LABEL_GAP_PX;
        entry.chip.style.marginLeft = `${PLAN_LABEL_GAP_PX}px`;
      }
    }
    const now = performance.now();
    if (now - state.lastStackAt >= PLAN_STACK_INTERVAL_MS) {
      state.lastStackAt = now;
      const shown = [...entries.values()].filter((e) => e.shown);
      const boxes: MarkerBox[] = shown.map((e) => ({
        x: e.x + e.root.offsetWidth / 2 - DOT_HALF_PX,
        y: e.y,
        w: e.root.offsetWidth,
        h: e.root.offsetHeight,
      }));
      const offsets = stackMarkerRows(boxes);
      shown.forEach((e, i) => {
        e.offsetY = offsets[i] ?? 0;
      });
    }
    for (const entry of entries.values()) {
      if (!entry.shown) continue;
      entry.root.style.transform = `translate(${entry.x - DOT_HALF_PX}px, ${entry.y + entry.offsetY}px) translateY(-50%)`;
    }
  });

  return null;
}
