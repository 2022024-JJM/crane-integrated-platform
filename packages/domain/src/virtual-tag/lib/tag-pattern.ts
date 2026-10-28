import type {
  VirtualTagDefinition,
  VirtualTagKeyframe,
  VirtualTagPattern,
} from '../model/types';

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

/** 0 에서 상승 시작하는 정규화 사인(0.5 − 0.5cos). */
function sineWave(t: number): number {
  return 0.5 - 0.5 * Math.cos(2 * Math.PI * t);
}

/**
 * initial 이 파형의 시작점이 되도록 위상을 옮긴다 — 재생 버튼을 누른 순간
 * 값이 initial 에서 점프하지 않고 이어진다.
 */
function phaseForInitial(
  kind: 'sine' | 'sawtooth',
  normalized: number,
): number {
  const n = Math.min(1, Math.max(0, normalized));
  if (kind === 'sawtooth') return n;
  return Math.acos(1 - 2 * n) / (2 * Math.PI);
}

function normalizedInitial(def: VirtualTagDefinition): number {
  const range = def.max - def.min;
  if (range <= 0) return 0;
  return (clampToTag(def, def.initial) - def.min) / range;
}

/** 파형 주기를 ms 로 — 저장본은 초, 러너 시계는 ms. 0 이하는 1ms(폭주 방지). */
function periodOf(pattern: VirtualTagPattern): number {
  return 'periodSec' in pattern && pattern.periodSec > 0
    ? pattern.periodSec * 1000
    : 1;
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
    case 'sine':
    case 'sawtooth': {
      const period = periodOf(pattern);
      const phase = phaseForInitial(pattern.kind, normalizedInitial(def));
      const t = (((elapsed / period + phase) % 1) + 1) % 1;
      const u = pattern.kind === 'sine' ? sineWave(t) : t;
      return { value: clampToTag(def, def.min + u * range) };
    }
    case 'square': {
      const period = periodOf(pattern);
      const duty = Math.min(100, Math.max(0, pattern.dutyPct ?? 50)) / 100;
      const t = (((elapsed / period) % 1) + 1) % 1;
      return { value: t < duty ? def.max : def.min };
    }
    case 'keyframes':
      return {
        value: clampToTag(
          def,
          evaluateKeyframes(
            pattern.points,
            elapsed / 1000,
            pattern.loop === true,
            def.dataType === 'bool',
            pattern.ease === 'smooth',
          ),
        ),
      };
    default:
      return state;
  }
}

/**
 * 키프레임 값 — 점은 `atSec` 오름차순이어야 한다(sanitize 보장). 점이 없으면
 * 0. `loop` 면 마지막 점의 시각을 주기로 되감고(마지막 시각이 0 이면 되감지
 * 않는다), `step` 이면 보간 없이 앞 점의 값을 유지한다(불리언). `smooth` 는
 * 구간마다 smoothstep(3u²−2u³)으로 가감속한다 — 점에서 속도 0.
 */
export function evaluateKeyframes(
  points: readonly VirtualTagKeyframe[],
  atSec: number,
  loop: boolean,
  step: boolean,
  smooth = false,
): number {
  if (points.length === 0) return 0;
  const first = points[0];
  const last = points[points.length - 1];
  let t = Number.isFinite(atSec) ? atSec : 0;
  if (loop && last.atSec > 0) {
    t = ((t % last.atSec) + last.atSec) % last.atSec;
  }
  if (t <= first.atSec) return first.value;
  if (t >= last.atSec) return last.value;
  // 선형 탐색 — 점이 수십 개라 이분 탐색이 이득이 없다.
  for (let i = 1; i < points.length; i += 1) {
    const b = points[i];
    if (t > b.atSec) continue;
    const a = points[i - 1];
    // 계단은 점의 시각에 그 점의 값으로 뛴다 — 경계 정확값은 새 값.
    if (step) return t === b.atSec ? b.value : a.value;
    const span = b.atSec - a.atSec;
    if (span <= 0) return b.value;
    const u = (t - a.atSec) / span;
    const w = smooth ? u * u * (3 - 2 * u) : u;
    return a.value + (b.value - a.value) * w;
  }
  return last.value;
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
