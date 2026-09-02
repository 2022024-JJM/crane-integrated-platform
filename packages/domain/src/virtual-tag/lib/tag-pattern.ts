import type { VirtualTagDefinition, VirtualTagPattern } from '../model/types';

/**
 * 가상 태그 값 계산 — 순수 함수. 러너가 틱마다 `stepVirtualTag` 를 부르고
 * 상태를 되돌려 받는다. 시간 기반 파형은 `elapsedMs` 만으로 결정되고, manual
 * 은 슬라이더가 넣은 값을 그대로 든다. `Math.random`·`Date.now` 를 여기서
 * 부르지 않는다 — 테스트가 결정론이어야 한다.
 */
export interface VirtualTagRuntimeState {
  value: number;
}

export function clampToTag(def: VirtualTagDefinition, value: number): number {
  if (!Number.isFinite(value)) return def.min;
  return Math.min(def.max, Math.max(def.min, value));
}

export function initVirtualTagState(
  def: VirtualTagDefinition,
): VirtualTagRuntimeState {
  return { value: clampToTag(def, def.initial) };
}

/** 0→1→0 삼각파(0 에서 상승 시작). */
function triangle(t: number): number {
  return t < 0.5 ? 2 * t : 2 - 2 * t;
}

/** 0 에서 상승 시작하는 정규화 사인(0.5 − 0.5cos). */
function sineWave(t: number): number {
  return 0.5 - 0.5 * Math.cos(2 * Math.PI * t);
}

/**
 * initial 이 파형의 시작점이 되도록 위상을 옮긴다 — 재생 버튼을 누른 순간
 * 값이 initial 에서 점프하지 않고 이어진다.
 */
function phaseForInitial(
  kind: 'triangle' | 'sine' | 'sawtooth',
  normalized: number,
): number {
  const n = Math.min(1, Math.max(0, normalized));
  if (kind === 'sawtooth') return n;
  if (kind === 'triangle') return n / 2;
  return Math.acos(1 - 2 * n) / (2 * Math.PI);
}

function normalizedInitial(def: VirtualTagDefinition): number {
  const range = def.max - def.min;
  if (range <= 0) return 0;
  return (clampToTag(def, def.initial) - def.min) / range;
}

function periodOf(pattern: VirtualTagPattern): number {
  return 'periodMs' in pattern && pattern.periodMs > 0 ? pattern.periodMs : 1;
}

/**
 * 한 틱 진행. `elapsedMs` 는 재생 시작 이후 누적 시간. 반환된 상태를 다음
 * 호출에 그대로 넘긴다. manual 은 상태를 바꾸지 않는다(같은 참조 반환).
 */
export function stepVirtualTag(
  def: VirtualTagDefinition,
  elapsedMs: number,
  state: VirtualTagRuntimeState,
): VirtualTagRuntimeState {
  const { pattern } = def;
  const range = def.max - def.min;
  const elapsed = Number.isFinite(elapsedMs) && elapsedMs > 0 ? elapsedMs : 0;

  switch (pattern.kind) {
    case 'manual':
      return state;
    case 'triangle':
    case 'sine':
    case 'sawtooth': {
      const period = periodOf(pattern);
      const phase = phaseForInitial(pattern.kind, normalizedInitial(def));
      const t = (((elapsed / period + phase) % 1) + 1) % 1;
      const u =
        pattern.kind === 'triangle'
          ? triangle(t)
          : pattern.kind === 'sine'
            ? sineWave(t)
            : t;
      return { value: clampToTag(def, def.min + u * range) };
    }
    case 'square': {
      const period = periodOf(pattern);
      const duty = Math.min(100, Math.max(0, pattern.dutyPct ?? 50)) / 100;
      const t = (((elapsed / period) % 1) + 1) % 1;
      return { value: t < duty ? def.max : def.min };
    }
    default:
      return state;
  }
}

/** manual 값 설정(슬라이더). 클램프해서 돌려준다. */
export function setVirtualTagManualValue(
  def: VirtualTagDefinition,
  state: VirtualTagRuntimeState,
  value: number,
): VirtualTagRuntimeState {
  const next = clampToTag(def, value);
  return next === state.value ? state : { value: next };
}
