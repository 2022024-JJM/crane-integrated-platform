// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  DETECTION_SETTINGS_DEFAULTS,
  DETECTION_SETTINGS_STORAGE_KEY,
  readDetectionSettings,
  sanitizeDetectionSettings,
  writeDetectionSettings,
} from '../detection-settings-storage';

beforeEach(() => {
  window.localStorage.clear();
});

const ALL_OFF = {
  collisionEnabled: false,
  pauseOnCollision: false,
  zoneEnabled: false,
  zoneLabelsVisible: false,
  stopOnIntrusion: false,
};

describe('sanitizeDetectionSettings', () => {
  it('객체가 아니면(배열·숫자·null·문자열) 전부 기본값', () => {
    for (const raw of [[], 1, null, 'true', undefined]) {
      expect(sanitizeDetectionSettings(raw)).toEqual(
        DETECTION_SETTINGS_DEFAULTS,
      );
    }
  });

  it('boolean 이 아닌 필드만 기본값으로 돌리고 나머지는 유지한다', () => {
    expect(
      sanitizeDetectionSettings({
        ...ALL_OFF,
        collisionEnabled: 'true',
        zoneEnabled: 1,
      }),
    ).toEqual({ ...ALL_OFF, collisionEnabled: true, zoneEnabled: true });
  });

  it('결손 필드는 기본값으로 채우고 모르는 필드는 버린다', () => {
    expect(
      sanitizeDetectionSettings({ zoneLabelsVisible: false, extra: 1 }),
    ).toEqual({ ...DETECTION_SETTINGS_DEFAULTS, zoneLabelsVisible: false });
  });

  it('입력 기본값 객체를 변형하지 않는다(사본 반환)', () => {
    const result = sanitizeDetectionSettings(null);
    result.collisionEnabled = false;
    expect(DETECTION_SETTINGS_DEFAULTS.collisionEnabled).toBe(true);
  });
});

describe('readDetectionSettings', () => {
  it('저장값이 없으면 기본값', () => {
    expect(readDetectionSettings()).toEqual(DETECTION_SETTINGS_DEFAULTS);
  });

  it('손상된 JSON 이면 기본값', () => {
    window.localStorage.setItem(DETECTION_SETTINGS_STORAGE_KEY, '{oops');
    expect(readDetectionSettings()).toEqual(DETECTION_SETTINGS_DEFAULTS);
  });

  it('저장된 boolean 필드를 읽는다', () => {
    window.localStorage.setItem(
      DETECTION_SETTINGS_STORAGE_KEY,
      JSON.stringify({ pauseOnCollision: false, stopOnIntrusion: false }),
    );
    expect(readDetectionSettings()).toEqual({
      ...DETECTION_SETTINGS_DEFAULTS,
      pauseOnCollision: false,
      stopOnIntrusion: false,
    });
  });
});

describe('writeDetectionSettings', () => {
  it('빈 저장소에 partial 을 쓰면 전체 봉투가 기록된다', () => {
    writeDetectionSettings({ collisionEnabled: false });
    expect(
      JSON.parse(window.localStorage.getItem(DETECTION_SETTINGS_STORAGE_KEY)!),
    ).toEqual({ ...DETECTION_SETTINGS_DEFAULTS, collisionEnabled: false });
  });

  it('기존 값과 merge 한다 — 다른 스토어의 필드를 덮지 않는다', () => {
    writeDetectionSettings({ collisionEnabled: false });
    writeDetectionSettings({ zoneEnabled: false });
    expect(readDetectionSettings()).toEqual({
      ...DETECTION_SETTINGS_DEFAULTS,
      collisionEnabled: false,
      zoneEnabled: false,
    });
  });

  it('손상된 기존 봉투 위에 써도 기본값 + patch 로 복구된다', () => {
    window.localStorage.setItem(DETECTION_SETTINGS_STORAGE_KEY, '[1,2]');
    writeDetectionSettings({ zoneLabelsVisible: false });
    expect(readDetectionSettings()).toEqual({
      ...DETECTION_SETTINGS_DEFAULTS,
      zoneLabelsVisible: false,
    });
  });
});
