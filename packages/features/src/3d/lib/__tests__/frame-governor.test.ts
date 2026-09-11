import { describe, expect, it } from 'vitest';
import {
  ANIMATING_FPS,
  ANIMATION_GRACE_MS,
  SLOW_FPS,
  extendAnimationGrace,
  governorIntervalMs,
  resolveGovernorFps,
} from '../frame-governor';

describe('resolveGovernorFps', () => {
  it('애니메이션 중이면 ANIMATING_FPS — slow 여부와 무관', () => {
    expect(
      resolveGovernorFps({ animating: true, slow: false, hidden: false }),
    ).toBe(ANIMATING_FPS);
    expect(
      resolveGovernorFps({ animating: true, slow: true, hidden: false }),
    ).toBe(ANIMATING_FPS);
  });

  it('정지 화면 + 느린 소스(태양)면 SLOW_FPS', () => {
    expect(
      resolveGovernorFps({ animating: false, slow: true, hidden: false }),
    ).toBe(SLOW_FPS);
  });

  it('아무것도 없으면 0 — 틱을 걸지 않는다 (demand 만으로 충분)', () => {
    expect(
      resolveGovernorFps({ animating: false, slow: false, hidden: false }),
    ).toBe(0);
  });

  it('탭이 숨겨졌으면 무조건 0', () => {
    expect(
      resolveGovernorFps({ animating: true, slow: true, hidden: true }),
    ).toBe(0);
  });

  it('30fps 는 모니터 주사율(60/120)보다 낮다 — 발열 감소의 근거', () => {
    expect(ANIMATING_FPS).toBeLessThanOrEqual(30);
    expect(SLOW_FPS).toBeLessThan(1);
  });
});

describe('governorIntervalMs', () => {
  it('fps → ms 반올림, 0·음수·NaN 은 null', () => {
    expect(governorIntervalMs(30)).toBe(33);
    expect(governorIntervalMs(0.2)).toBe(5000);
    expect(governorIntervalMs(0)).toBeNull();
    expect(governorIntervalMs(-5)).toBeNull();
    expect(governorIntervalMs(Number.NaN)).toBeNull();
  });

  it('아주 큰 fps 도 최소 1ms', () => {
    expect(governorIntervalMs(5000)).toBe(1);
  });
});

describe('extendAnimationGrace', () => {
  it('활성이면 now + GRACE 로 연장, 비활성이면 유지', () => {
    expect(extendAnimationGrace(0, true, 1000)).toBe(1000 + ANIMATION_GRACE_MS);
    expect(extendAnimationGrace(4200, false, 9000)).toBe(4200);
  });

  it('유예는 스무딩 정착 시간(0.35s)보다 넉넉하다', () => {
    expect(ANIMATION_GRACE_MS).toBeGreaterThan(350 * 2);
  });
});
