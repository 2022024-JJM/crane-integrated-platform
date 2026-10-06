// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  GRAPHICS_SETTINGS_DEFAULTS,
  GRAPHICS_SETTINGS_STORAGE_KEY,
  RENDER_SCALE_OPTIONS,
  isRenderScale,
  readGraphicsSettings,
  renderScalePercent,
  sanitizeGraphicsSettings,
  writeGraphicsSettings,
} from '../graphics-settings-storage';

beforeEach(() => {
  window.localStorage.clear();
});

describe('RENDER_SCALE_OPTIONS', () => {
  it('기본값(1)이 첫 항목이고 전부 (0, 1] 안의 내림차순이다', () => {
    expect(RENDER_SCALE_OPTIONS[0]).toBe(
      GRAPHICS_SETTINGS_DEFAULTS.renderScale,
    );
    for (const option of RENDER_SCALE_OPTIONS) {
      expect(option).toBeGreaterThan(0);
      expect(option).toBeLessThanOrEqual(1);
    }
    expect([...RENDER_SCALE_OPTIONS]).toEqual(
      [...RENDER_SCALE_OPTIONS].sort((a, b) => b - a),
    );
  });
});

describe('isRenderScale', () => {
  it('목록의 값만 통과한다', () => {
    for (const option of RENDER_SCALE_OPTIONS) {
      expect(isRenderScale(option)).toBe(true);
    }
  });

  it('목록 사이·밖의 숫자와 숫자가 아닌 값은 거부한다', () => {
    for (const value of [
      0.6,
      0.75,
      0.49,
      1.01,
      1.5,
      0,
      -0.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      '0.7',
      '1',
      true,
      null,
      undefined,
      [0.7],
    ]) {
      expect(isRenderScale(value)).toBe(false);
    }
  });
});

describe('renderScalePercent', () => {
  it('정수 백분율로 바꾼다 (0.85·0.7 의 부동소수 오차를 반올림)', () => {
    expect(RENDER_SCALE_OPTIONS.map(renderScalePercent)).toEqual([
      100, 85, 70, 50,
    ]);
  });
});

describe('sanitizeGraphicsSettings', () => {
  it('객체가 아니면(배열·숫자·null·문자열) 기본값', () => {
    for (const raw of [[], 0.7, null, '0.7', undefined, true]) {
      expect(sanitizeGraphicsSettings(raw)).toEqual(GRAPHICS_SETTINGS_DEFAULTS);
    }
  });

  it('목록의 배율은 그대로 유지한다', () => {
    for (const renderScale of RENDER_SCALE_OPTIONS) {
      expect(sanitizeGraphicsSettings({ renderScale })).toEqual({
        renderScale,
      });
    }
  });

  it("목록에 없는 배율·타입 오염('0.7'·NaN·Infinity·null)은 기본값으로 돌린다", () => {
    for (const renderScale of [
      0.6,
      2,
      0,
      -1,
      '0.7',
      Number.NaN,
      Number.POSITIVE_INFINITY,
      null,
    ]) {
      expect(sanitizeGraphicsSettings({ renderScale })).toEqual(
        GRAPHICS_SETTINGS_DEFAULTS,
      );
    }
  });

  it('결손 필드는 기본값으로 채우고 모르는 필드는 버린다', () => {
    expect(sanitizeGraphicsSettings({})).toEqual(GRAPHICS_SETTINGS_DEFAULTS);
    expect(sanitizeGraphicsSettings({ renderScale: 0.5, extra: 1 })).toEqual({
      renderScale: 0.5,
    });
  });

  it('기본값 객체를 변형하지 않는다(사본 반환)', () => {
    const result = sanitizeGraphicsSettings(null);
    result.renderScale = 0.5;
    expect(GRAPHICS_SETTINGS_DEFAULTS.renderScale).toBe(1);
  });
});

describe('readGraphicsSettings', () => {
  it('저장값이 없으면 기본값 — 배율 1', () => {
    expect(readGraphicsSettings()).toEqual({ renderScale: 1 });
  });

  it('저장된 값을 읽는다', () => {
    window.localStorage.setItem(
      GRAPHICS_SETTINGS_STORAGE_KEY,
      JSON.stringify({ renderScale: 0.7 }),
    );
    expect(readGraphicsSettings()).toEqual({ renderScale: 0.7 });
  });

  it('손상 JSON 은 기본값이고 저장소를 건드리지 않는다', () => {
    window.localStorage.setItem(GRAPHICS_SETTINGS_STORAGE_KEY, '{renderScale');
    expect(readGraphicsSettings()).toEqual(GRAPHICS_SETTINGS_DEFAULTS);
    expect(window.localStorage.getItem(GRAPHICS_SETTINGS_STORAGE_KEY)).toBe(
      '{renderScale',
    );
  });

  it('목록에 없는 저장값은 기본값으로 읽는다', () => {
    window.localStorage.setItem(
      GRAPHICS_SETTINGS_STORAGE_KEY,
      JSON.stringify({ renderScale: 0.6 }),
    );
    expect(readGraphicsSettings()).toEqual(GRAPHICS_SETTINGS_DEFAULTS);
  });

  it('매번 새 객체를 돌려준다', () => {
    expect(readGraphicsSettings()).not.toBe(readGraphicsSettings());
  });
});

describe('writeGraphicsSettings', () => {
  it('배율을 저장하고 다시 읽힌다', () => {
    writeGraphicsSettings({ renderScale: 0.85 });
    expect(readGraphicsSettings()).toEqual({ renderScale: 0.85 });
    expect(
      JSON.parse(window.localStorage.getItem(GRAPHICS_SETTINGS_STORAGE_KEY)!),
    ).toEqual({ renderScale: 0.85 });
  });

  it('빈 patch 는 기존 값을 유지한다', () => {
    writeGraphicsSettings({ renderScale: 0.5 });
    writeGraphicsSettings({});
    expect(readGraphicsSettings()).toEqual({ renderScale: 0.5 });
  });

  it('손상된 저장값 위에 쓰면 기본값에서 시작해 patch 만 반영한다', () => {
    window.localStorage.setItem(GRAPHICS_SETTINGS_STORAGE_KEY, 'not json');
    writeGraphicsSettings({ renderScale: 0.7 });
    expect(readGraphicsSettings()).toEqual({ renderScale: 0.7 });
  });

  it('목록에 없는 배율을 쓰면 기본값으로 정규화돼 저장된다', () => {
    writeGraphicsSettings({ renderScale: 0.5 });
    writeGraphicsSettings({ renderScale: 0.6 as never });
    expect(readGraphicsSettings()).toEqual(GRAPHICS_SETTINGS_DEFAULTS);
  });
});
