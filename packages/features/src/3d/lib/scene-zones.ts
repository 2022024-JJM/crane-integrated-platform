import { SEPARATION_MARGIN } from './scene-collision-pairs';

/**
 * 모델 영역(침범 감지)의 상수·순수 헬퍼. 런타임(scene-zone-runtime)·링
 * (scene-zone-rings)·미니맵이 공유하는 숫자 계산은 전부 여기 — `ui/*.tsx`
 * 안에서 수치 계산을 하지 않는다는 규칙.
 */

/** 스캔 주기 — 충돌 감지와 같은 20Hz. */
export const ZONE_SCAN_INTERVAL_MS = 50;
/** 한 스캔의 시간 예산(ms). job(영역×모델) 사이에서만 검사한다. */
export const ZONE_SCAN_BUDGET_MS = 2;
/** BVH 가 아직 없는 메쉬를 다시 볼 때까지의 대기. */
export const ZONE_BVH_RETRY_MS = 1000;
/**
 * 이탈 히스테리시스 비율. 진입은 반경 r, 이탈은 r + margin 에서. 충돌의
 * SEPARATION_MARGIN(0.05 unit)은 메쉬 접촉용이라 여기 그대로 쓸 수 없다 —
 * 영역 경계 떨림의 원인은 PLC 주행값 노이즈(0.1~0.5 m)라 반경에 비례시킨다.
 * r=60(골리앗급) → 1.8 unit. 작은 영역은 0.05 바닥값.
 */
export const ZONE_EXIT_MARGIN_RATIO = 0.03;

export function zoneExitMargin(radius: number): number {
  if (!Number.isFinite(radius) || radius <= 0) return SEPARATION_MARGIN;
  return Math.max(SEPARATION_MARGIN, radius * ZONE_EXIT_MARGIN_RATIO);
}

/** 런타임·링·스토어가 영역 하나를 가리키는 키. 모델 id 와 영역 id 를 합친다. */
export function zoneKey(modelId: string, zoneId: string): string {
  return `${modelId}#${zoneId}`;
}

/** 테두리 선 두께(반경 비율) — 가드 링(DetectionZoneRing)과 같은 값. */
export const ZONE_RING_WIDTH_RATIO = 0.0085;

/** z-fighting 방지용 바닥 띄움 — 반경 비례, 최소 0.03 unit. */
export function zoneGroundLift(radius: number): number {
  if (!Number.isFinite(radius) || radius <= 0) return 0.03;
  return Math.max(0.03, radius * 0.005);
}

/** 침범 펄스 주기(Hz) — 가드의 위험 펄스와 같은 박자. */
export const ZONE_PULSE_HZ = 2;

export interface ZoneRingOpacity {
  fill: number;
  ring: number;
}

/**
 * 채움·테두리 불투명도. idle 은 얇은 테두리 + 희미한 면, 침범 중엔 면이
 * 차오르며 맥동한다(`pulse01` = sin 위상 0~1). reduced-motion 이면 맥동
 * 없이 상단값 고정 — 침범 자체는 계속 표시.
 */
export function zoneRingOpacity(
  intruded: boolean,
  pulse01: number,
  reducedMotion: boolean,
): ZoneRingOpacity {
  if (!intruded) return { fill: 0.05, ring: 0.8 };
  if (reducedMotion) return { fill: 0.26, ring: 1 };
  const p = Number.isFinite(pulse01) ? Math.min(1, Math.max(0, pulse01)) : 0;
  return { fill: 0.14 + 0.16 * p, ring: 1 };
}

/** 시각(초) → 펄스 위상 0~1. */
export function zonePulsePhase(elapsedSeconds: number): number {
  return 0.5 + 0.5 * Math.sin(elapsedSeconds * Math.PI * 2 * ZONE_PULSE_HZ);
}

/**
 * `#rrggbb` → `rgba(r, g, b, a)` (미니맵 2D 캔버스용). 형식이 아니면 회색
 * 폴백 — sanitize 가 이미 정규화하므로 런타임에 올 일은 거의 없다.
 */
export function zoneColorWithAlpha(hex: string, alpha: number): string {
  const a = Number.isFinite(alpha) ? Math.min(1, Math.max(0, alpha)) : 1;
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return `rgba(148, 163, 184, ${a})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
