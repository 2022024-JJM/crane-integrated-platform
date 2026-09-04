import { describe, expect, it } from 'vitest';
import { SCENE_TRANSFORM_SNAP } from '@crane/features/3d';
import {
  formatSnapRotation,
  formatSnapScale,
  formatSnapStep,
  formatSnapTranslation,
} from '../format-snap-step';

const DEG = Math.PI / 180;

describe('formatSnapStep', () => {
  it('기본값은 "1m · 15° · 0.1"', () => {
    expect(formatSnapStep(SCENE_TRANSFORM_SNAP)).toBe('1m · 15° · 0.1');
  });

  it('모든 옵션 조합이 소수 그대로 나온다', () => {
    expect(
      formatSnapStep({ translation: 0.25, rotation: 45 * DEG, scale: 0.25 }),
    ).toBe('0.25m · 45° · 0.25');
    expect(
      formatSnapStep({ translation: 0.1, rotation: 5 * DEG, scale: 0.1 }),
    ).toBe('0.1m · 5° · 0.1');
  });
});

describe('개별 포맷', () => {
  it('이동은 m 단위, 뒤따르는 0 은 지운다', () => {
    expect(formatSnapTranslation(1)).toBe('1m');
    expect(formatSnapTranslation(0.1)).toBe('0.1m');
    expect(formatSnapTranslation(0.1 + 0.2)).toBe('0.3m');
  });

  it('회전은 라디안을 도로 바꾸고 소수 1자리로 반올림한다', () => {
    expect(formatSnapRotation(15 * DEG)).toBe('15°');
    expect(formatSnapRotation(Math.PI / 36)).toBe('5°');
    expect(formatSnapRotation(7.5 * DEG)).toBe('7.5°');
    expect(formatSnapRotation(7.56 * DEG)).toBe('7.6°');
    expect(formatSnapRotation(7.54 * DEG)).toBe('7.5°');
  });

  it('크기는 단위 없이 소수만', () => {
    expect(formatSnapScale(0.1)).toBe('0.1');
    expect(formatSnapScale(0.25)).toBe('0.25');
  });

  it('옵션 밖 값도 그대로 포맷한다 — 방어는 storage 가 맡는다', () => {
    expect(formatSnapTranslation(3)).toBe('3m');
    expect(formatSnapRotation(0)).toBe('0°');
    expect(formatSnapScale(1)).toBe('1');
  });
});
