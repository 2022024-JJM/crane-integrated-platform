import { describe, expect, it } from 'vitest';
import type { SunDayEvents } from '@crane/domain/3d';
import {
  SCENE_CLOCK_PRESET_KEYS,
  buildSceneClockPresets,
  findActiveClockPreset,
  type SceneClockPreset,
} from '../scene-clock-presets';

const MINUTE = 60_000;
// 2026-09-30 00:00 KST
const DAY_START = Date.UTC(2026, 8, 29, 15, 0, 0);
const EVENTS: SunDayEvents = {
  sunrise: DAY_START + (6 * 60 + 23) * MINUTE + 17_000,
  solarNoon: DAY_START + (12 * 60 + 18) * MINUTE + 42_000,
  sunset: DAY_START + (18 * 60 + 13) * MINUTE + 5_000,
  noonElevation: 52,
};

describe('buildSceneClockPresets', () => {
  it('일출·정오·일몰·자정 순서이고 자정은 현장 날짜의 시작이다', () => {
    const presets = buildSceneClockPresets(EVENTS, DAY_START);
    expect(presets.map((p) => p.key)).toEqual([...SCENE_CLOCK_PRESET_KEYS]);
    expect(presets).toEqual([
      { key: 'sunrise', ms: EVENTS.sunrise },
      { key: 'noon', ms: EVENTS.solarNoon },
      { key: 'sunset', ms: EVENTS.sunset },
      { key: 'midnight', ms: DAY_START },
    ]);
  });

  it('사건 계산이 없으면(null) 자정만 남는다', () => {
    expect(buildSceneClockPresets(null, DAY_START)).toEqual([
      { key: 'sunrise', ms: null },
      { key: 'noon', ms: null },
      { key: 'sunset', ms: null },
      { key: 'midnight', ms: DAY_START },
    ]);
  });

  it('극야·백야(일출·일몰 null)여도 정오·자정은 그대로다', () => {
    const presets = buildSceneClockPresets(
      { ...EVENTS, sunrise: null, sunset: null },
      DAY_START,
    );
    expect(presets.map((p) => p.ms)).toEqual([
      null,
      EVENTS.solarNoon,
      null,
      DAY_START,
    ]);
  });

  it('비유한 시각(NaN·Infinity)은 null 로 막는다', () => {
    const presets = buildSceneClockPresets(
      { ...EVENTS, solarNoon: Number.NaN, sunset: Number.POSITIVE_INFINITY },
      Number.NaN,
    );
    expect(presets.map((p) => p.ms)).toEqual([
      EVENTS.sunrise,
      null,
      null,
      null,
    ]);
  });
});

describe('findActiveClockPreset', () => {
  const presets = buildSceneClockPresets(EVENTS, DAY_START);

  it('프리셋을 누른 시각(정확히 같은 값)이면 그 프리셋', () => {
    expect(findActiveClockPreset(EVENTS.sunrise!, presets)).toBe('sunrise');
    expect(findActiveClockPreset(EVENTS.solarNoon, presets)).toBe('noon');
    expect(findActiveClockPreset(EVENTS.sunset!, presets)).toBe('sunset');
    expect(findActiveClockPreset(DAY_START, presets)).toBe('midnight');
  });

  it('같은 분이면 초가 달라도 선택된다 — 분의 시작·끝 경계', () => {
    const minuteStart = Math.floor(EVENTS.sunrise! / MINUTE) * MINUTE;
    expect(findActiveClockPreset(minuteStart, presets)).toBe('sunrise');
    expect(findActiveClockPreset(minuteStart + MINUTE - 1, presets)).toBe(
      'sunrise',
    );
  });

  it('앞뒤 분은 선택되지 않는다', () => {
    const minuteStart = Math.floor(EVENTS.sunrise! / MINUTE) * MINUTE;
    expect(findActiveClockPreset(minuteStart - 1, presets)).toBeNull();
    expect(findActiveClockPreset(minuteStart + MINUTE, presets)).toBeNull();
  });

  it('어느 프리셋과도 다른 분이면 null', () => {
    expect(findActiveClockPreset(DAY_START + 15 * 60 * MINUTE, presets)).toBe(
      null,
    );
  });

  it('ms 가 null 인 프리셋은 건너뛴다', () => {
    const polar = buildSceneClockPresets(
      { ...EVENTS, sunrise: null },
      DAY_START,
    );
    expect(findActiveClockPreset(EVENTS.sunrise!, polar)).toBeNull();
    expect(findActiveClockPreset(DAY_START, polar)).toBe('midnight');
  });

  it('빈 목록은 null', () => {
    expect(findActiveClockPreset(DAY_START, [])).toBeNull();
  });

  it('비유한 시각은 아무것도 고르지 않는다', () => {
    expect(findActiveClockPreset(Number.NaN, presets)).toBeNull();
    expect(findActiveClockPreset(Number.POSITIVE_INFINITY, presets)).toBeNull();
  });

  it('같은 분에 프리셋이 둘이면 목록 앞쪽', () => {
    const same: SceneClockPreset[] = [
      { key: 'noon', ms: DAY_START + 10_000 },
      { key: 'midnight', ms: DAY_START },
    ];
    expect(findActiveClockPreset(DAY_START + 30_000, same)).toBe('noon');
  });

  it('1970 년 이전(음수 epoch)도 같은 분 규칙이다', () => {
    const before: SceneClockPreset[] = [{ key: 'midnight', ms: -MINUTE }];
    expect(findActiveClockPreset(-1, before)).toBe('midnight');
    expect(findActiveClockPreset(-MINUTE - 1, before)).toBeNull();
    expect(findActiveClockPreset(0, before)).toBeNull();
  });
});
