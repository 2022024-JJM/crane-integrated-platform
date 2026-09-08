import { describe, expect, it } from 'vitest';
import {
  FOCUS_GHOST_OPACITY,
  isFocusGhosted,
  resolveFocusOpacity,
} from '../focus-ghost';

describe('isFocusGhosted', () => {
  it('포커스가 없으면 아무 모델도 흐려지지 않는다', () => {
    expect(isFocusGhosted('m1', null)).toBe(false);
  });

  it('포커스 대상 자신은 흐려지지 않고, 나머지는 흐려진다', () => {
    expect(isFocusGhosted('m1', 'm1')).toBe(false);
    expect(isFocusGhosted('m2', 'm1')).toBe(true);
  });

  it('빈 문자열 id 가 포커스 대상이면 그 모델만 제외된다(특성화)', () => {
    expect(isFocusGhosted('', '')).toBe(false);
    expect(isFocusGhosted('m1', '')).toBe(true);
  });
});

describe('resolveFocusOpacity', () => {
  it('포커스가 없으면 원래 값 그대로', () => {
    expect(resolveFocusOpacity('m1', null, 1)).toBe(1);
    expect(resolveFocusOpacity('m1', null, 0.5)).toBe(0.5);
  });

  it('포커스 대상은 원래 값을 유지한다(반투명 모델도 진해지지 않음)', () => {
    expect(resolveFocusOpacity('m1', 'm1', 1)).toBe(1);
    expect(resolveFocusOpacity('m1', 'm1', 0.5)).toBe(0.5);
  });

  it('나머지 모델은 상한(0.1)으로 내려간다', () => {
    expect(resolveFocusOpacity('m2', 'm1', 1)).toBe(FOCUS_GHOST_OPACITY);
    expect(resolveFocusOpacity('m2', 'm1', 0.5)).toBe(FOCUS_GHOST_OPACITY);
  });

  it('경계: 원래 값이 상한과 같으면 그대로, 더 낮으면 낮은 값을 유지한다', () => {
    expect(resolveFocusOpacity('m2', 'm1', FOCUS_GHOST_OPACITY)).toBe(
      FOCUS_GHOST_OPACITY,
    );
    expect(resolveFocusOpacity('m2', 'm1', 0.05)).toBe(0.05);
    expect(resolveFocusOpacity('m2', 'm1', 0)).toBe(0);
  });

  it('NaN 은 min 이 NaN 을 돌려준다(특성화 — 씬 로드 시 sanitize 가 막는다)', () => {
    expect(Number.isNaN(resolveFocusOpacity('m2', 'm1', Number.NaN))).toBe(
      true,
    );
  });
});
