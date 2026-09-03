// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SCENE_SNAP_STEP_OPTIONS,
  SCENE_TRANSFORM_SNAP,
  SNAP_STEP_STORAGE_KEY,
  isSnapStepOption,
  readSnapStep,
  sanitizeSnapStep,
  writeSnapStep,
} from '../snap-storage';

const DEG = Math.PI / 180;

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SCENE_SNAP_STEP_OPTIONS / 기본값', () => {
  it('이동 0.1/0.25/1m · 회전 5/15/45° · 크기 0.1/0.25 를 제공한다', () => {
    expect(SCENE_SNAP_STEP_OPTIONS.translation).toEqual([0.1, 0.25, 1]);
    const degrees = SCENE_SNAP_STEP_OPTIONS.rotation.map((r) => r / DEG);
    expect(degrees).toHaveLength(3);
    expect(degrees[0]).toBeCloseTo(5, 9);
    expect(degrees[1]).toBeCloseTo(15, 9);
    expect(degrees[2]).toBeCloseTo(45, 9);
    expect(SCENE_SNAP_STEP_OPTIONS.scale).toEqual([0.1, 0.25]);
  });

  it('기본값 1m · 15° · 0.1 은 각 채널 옵션 안에 있다', () => {
    expect(
      isSnapStepOption('translation', SCENE_TRANSFORM_SNAP.translation),
    ).toBe(true);
    expect(isSnapStepOption('rotation', SCENE_TRANSFORM_SNAP.rotation)).toBe(
      true,
    );
    expect(isSnapStepOption('scale', SCENE_TRANSFORM_SNAP.scale)).toBe(true);
  });
});

describe('isSnapStepOption', () => {
  it('목록의 정확값만 통과하고 근처 값은 거부한다', () => {
    expect(isSnapStepOption('translation', 0.25)).toBe(true);
    expect(isSnapStepOption('translation', 0.3)).toBe(false);
    expect(isSnapStepOption('translation', 0.25 + 1e-6)).toBe(false);
  });

  it('라디안 부동소수 오차(1e-9 미만)는 같은 값으로 본다', () => {
    expect(isSnapStepOption('rotation', 15 * DEG + 1e-12)).toBe(true);
  });

  it('숫자가 아니거나 NaN/Infinity 면 거부한다', () => {
    expect(isSnapStepOption('scale', '0.1')).toBe(false);
    expect(isSnapStepOption('scale', Number.NaN)).toBe(false);
    expect(isSnapStepOption('scale', Number.POSITIVE_INFINITY)).toBe(false);
    expect(isSnapStepOption('scale', null)).toBe(false);
  });
});

describe('sanitizeSnapStep', () => {
  it('null·비객체·빈 객체는 전부 기본값', () => {
    expect(sanitizeSnapStep(null)).toEqual(SCENE_TRANSFORM_SNAP);
    expect(sanitizeSnapStep('1m')).toEqual(SCENE_TRANSFORM_SNAP);
    expect(sanitizeSnapStep(42)).toEqual(SCENE_TRANSFORM_SNAP);
    expect(sanitizeSnapStep({})).toEqual(SCENE_TRANSFORM_SNAP);
    expect(sanitizeSnapStep([])).toEqual(SCENE_TRANSFORM_SNAP);
  });

  it('채널별로 검사한다 — 멀쩡한 채널은 살리고 손상된 채널만 기본값', () => {
    const step = sanitizeSnapStep({
      translation: 0.25,
      rotation: 'fast',
      scale: 0.3,
    });
    expect(step.translation).toBe(0.25);
    expect(step.rotation).toBe(SCENE_TRANSFORM_SNAP.rotation);
    expect(step.scale).toBe(SCENE_TRANSFORM_SNAP.scale);
  });

  it('결손 필드는 기본값으로 채운다', () => {
    const step = sanitizeSnapStep({ scale: 0.25 });
    expect(step).toEqual({
      translation: SCENE_TRANSFORM_SNAP.translation,
      rotation: SCENE_TRANSFORM_SNAP.rotation,
      scale: 0.25,
    });
  });

  it('NaN·Infinity·음수는 기본값으로 되돌린다', () => {
    expect(sanitizeSnapStep({ translation: Number.NaN }).translation).toBe(1);
    expect(
      sanitizeSnapStep({ rotation: Number.POSITIVE_INFINITY }).rotation,
    ).toBe(SCENE_TRANSFORM_SNAP.rotation);
    expect(sanitizeSnapStep({ scale: -0.1 }).scale).toBe(0.1);
  });

  it('오차 안의 값은 목록의 정규 값으로 치환한다', () => {
    const step = sanitizeSnapStep({ rotation: 45 * DEG + 1e-12 });
    expect(step.rotation).toBe(SCENE_SNAP_STEP_OPTIONS.rotation[2]);
  });

  it('알 수 없는 필드는 무시한다', () => {
    const step = sanitizeSnapStep({ translation: 1, extra: 99 });
    expect(step).toEqual(SCENE_TRANSFORM_SNAP);
    expect('extra' in step).toBe(false);
  });
});

describe('readSnapStep / writeSnapStep', () => {
  it('키가 없으면 기본값', () => {
    expect(readSnapStep()).toEqual(SCENE_TRANSFORM_SNAP);
  });

  it('저장 후 다시 읽으면 같은 값', () => {
    const step = { translation: 0.1, rotation: 5 * DEG, scale: 0.25 };
    writeSnapStep(step);
    expect(window.localStorage.getItem(SNAP_STEP_STORAGE_KEY)).not.toBeNull();
    expect(readSnapStep()).toEqual(step);
  });

  it('손상된 JSON 은 기본값이고 예외를 내지 않는다', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    window.localStorage.setItem(SNAP_STEP_STORAGE_KEY, '{not json');
    expect(() => readSnapStep()).not.toThrow();
    expect(readSnapStep()).toEqual(SCENE_TRANSFORM_SNAP);
  });

  it('storage 접근이 던져도 기본값을 돌려주고 예외를 내지 않는다', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => writeSnapStep(SCENE_TRANSFORM_SNAP)).not.toThrow();
    expect(readSnapStep()).toEqual(SCENE_TRANSFORM_SNAP);
  });
});
