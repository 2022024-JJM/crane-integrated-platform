import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Vector3 } from 'three';
import type { Vector3Tuple } from '@crane/core/types/math';
import {
  getSceneMetersPerUnit,
  isBehindCamera,
  projectToScreen,
  type SavedSceneInfo,
  type ScreenPoint,
} from '@crane/domain/3d';
import {
  EDGE_TRANSFORM,
  OFFSCREEN_STACK_INTERVAL_MS,
  resolveEdgeIndicator,
} from '../lib/offscreen-indicator';
import { stackMarkerRows, type MarkerBox } from '../lib/plan-view';
import {
  PROXIMITY_LINE_COLORS,
  formatProximityGap,
  proximityFocusPose,
  type ProximityPair,
} from '../lib/scene-proximity';
import { useSceneProximityStore } from '../model/use-scene-proximity-store';

/**
 * 화면 밖 근접 쌍 화살표 — Canvas 안 null 컴포넌트, DOM 은 캔버스 옆에 직접
 * 붙인다(모델 라벨과 같은 방식, drei Html 금지 이유도 같다). 쌍마다 요소
 * 하나: 가장자리로 당긴 자리에 화살표 + "A ↔ B · 거리". 누르면 그 쌍으로
 * 이동. 화면 안에 있는 쌍은 숨긴다(거리 선이 보인다).
 */
const BOX_CLASS =
  'pointer-events-auto absolute z-50 flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[12px] leading-none font-bold whitespace-nowrap text-black shadow';
const ARROW_CLASS =
  'inline-block size-0 border-y-[6px] border-l-[9px] border-y-transparent border-l-current';

interface IndicatorEntry {
  el: HTMLDivElement;
  arrow: HTMLSpanElement;
  text: HTMLSpanElement;
  pair: ProximityPair;
  shown: boolean;
  x: number;
  y: number;
  /** 아래쪽 가장자리에 붙은 것 — 겹치면 위로 밀어낸다(아래로 밀면 화면 밖). */
  bottom: boolean;
  /** 겹침 밀어내기(세로, px) — 주기마다 다시 잰다. */
  offsetY: number;
}

const _mid = new Vector3();
const _pt: ScreenPoint = { x: 0, y: 0 };

export function SceneOffscreenIndicators({
  sceneInfo,
  regionId,
  overlapLabel,
  onMoveTo,
}: {
  sceneInfo: SavedSceneInfo | null;
  regionId: string | undefined;
  overlapLabel: string;
  onMoveTo: (position: Vector3Tuple, target: Vector3Tuple) => void;
}) {
  const canvas = useThree((s) => s.gl.domElement);
  const pairs = useSceneProximityStore((s) => s.pairs);
  const names = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of sceneInfo?.models ?? []) map.set(m.id, m.equipName || m.id);
    return map;
  }, [sceneInfo]);
  const entriesRef = useRef(new Map<string, IndicatorEntry>());
  const moveToRef = useRef(onMoveTo);
  useEffect(() => {
    moveToRef.current = onMoveTo;
  }, [onMoveTo]);
  const mpu = getSceneMetersPerUnit(regionId);

  // 쌍 목록이 바뀔 때만 DOM 을 만들고 지운다(내용은 여기서, 위치는 useFrame).
  useEffect(() => {
    const container = canvas.parentElement;
    if (!container) return;
    const entries = entriesRef.current;
    const alive = new Set<string>();
    for (const pair of pairs) {
      alive.add(pair.key);
      let entry = entries.get(pair.key);
      if (!entry) {
        const el = document.createElement('div');
        el.className = BOX_CLASS;
        el.style.display = 'none';
        const arrow = document.createElement('span');
        arrow.className = ARROW_CLASS;
        const text = document.createElement('span');
        el.append(arrow, text);
        container.appendChild(el);
        entry = {
          el,
          arrow,
          text,
          pair,
          shown: false,
          x: 0,
          y: 0,
          bottom: false,
          offsetY: 0,
        };
        entries.set(pair.key, entry);
      }
      entry.pair = pair;
      entry.el.style.background = PROXIMITY_LINE_COLORS[pair.level];
      entry.text.textContent = `${names.get(pair.a) ?? pair.a} ↔ ${names.get(pair.b) ?? pair.b} · ${formatProximityGap(pair.gapM, overlapLabel)}`;
      entry.el.onclick = () => {
        const p = entry!.pair;
        const pose = proximityFocusPose(p.from, p.to, p.gapM, mpu);
        moveToRef.current(pose.position, pose.target);
      };
    }
    for (const [key, entry] of entries) {
      if (alive.has(key)) continue;
      entry.el.remove();
      entries.delete(key);
    }
  }, [pairs, names, canvas, mpu, overlapLabel]);

  useEffect(() => {
    const entries = entriesRef.current;
    return () => {
      for (const entry of entries.values()) entry.el.remove();
      entries.clear();
    };
  }, [canvas]);

  const stackAtRef = useRef(0);
  useFrame(({ camera, size }) => {
    const entries = entriesRef.current;
    if (entries.size === 0) return;
    for (const entry of entries.values()) {
      const { from, to } = entry.pair;
      _mid.set(
        (from[0] + to[0]) / 2,
        (from[1] + to[1]) / 2,
        (from[2] + to[2]) / 2,
      );
      const behind = isBehindCamera(_mid, camera);
      projectToScreen(_mid, camera, size.width, size.height, _pt);
      const ind = resolveEdgeIndicator(
        _pt.x,
        _pt.y,
        size.width,
        size.height,
        behind,
      );
      if (!ind.offscreen) {
        if (entry.shown) {
          entry.el.style.display = 'none';
          entry.shown = false;
        }
        continue;
      }
      if (!entry.shown) {
        entry.el.style.display = '';
        entry.shown = true;
      }
      entry.x = ind.x;
      entry.y = ind.y;
      entry.bottom = ind.side === 'bottom';
      entry.el.style.transform = EDGE_TRANSFORM[ind.side];
      entry.arrow.style.transform = `rotate(${ind.angleDeg}deg)`;
    }
    // 한 모서리에 몰린 화살표는 세로로 밀어낸다(마커와 같은 greedy).
    const now = performance.now();
    if (now - stackAtRef.current >= OFFSCREEN_STACK_INTERVAL_MS) {
      stackAtRef.current = now;
      // 아래쪽 가장자리 것은 y 를 뒤집어 쌓고 오프셋을 반대로 — 위로 쌓인다.
      const shown = [...entries.values()].filter((e) => e.shown);
      const boxes: MarkerBox[] = shown.map((e) => ({
        x: e.x,
        y: e.bottom ? -e.y : e.y,
        w: e.el.offsetWidth,
        h: e.el.offsetHeight,
      }));
      const offsets = stackMarkerRows(boxes);
      shown.forEach((e, i) => {
        const off = offsets[i] ?? 0;
        e.offsetY = e.bottom ? -off : off;
      });
    }
    for (const entry of entries.values()) {
      if (!entry.shown) continue;
      entry.el.style.left = `${entry.x}px`;
      entry.el.style.top = `${entry.y + entry.offsetY}px`;
    }
  });

  return null;
}
