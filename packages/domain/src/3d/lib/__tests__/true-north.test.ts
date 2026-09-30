import { describe, expect, it } from 'vitest';
import { bearingToWorldAzimuth, resolveTrueNorth } from '../true-north';
import {
  SCENE_TRUE_NORTH_DEFAULT,
  type SavedSceneInfo,
} from '../../model/types';

function withTrueNorth(trueNorth: unknown): Pick<SavedSceneInfo, 'trueNorth'> {
  return { trueNorth } as unknown as Pick<SavedSceneInfo, 'trueNorth'>;
}

describe('resolveTrueNorth', () => {
  it('유효한 값은 그대로 돌려준다', () => {
    expect(resolveTrueNorth(withTrueNorth(50.6))).toBe(50.6);
    expect(resolveTrueNorth(withTrueNorth(359.9))).toBe(359.9);
  });

  it('씬·필드가 없으면 기본값(−Z 가 북)', () => {
    expect(resolveTrueNorth(null)).toBe(SCENE_TRUE_NORTH_DEFAULT);
    expect(resolveTrueNorth(undefined)).toBe(SCENE_TRUE_NORTH_DEFAULT);
    expect(resolveTrueNorth({})).toBe(SCENE_TRUE_NORTH_DEFAULT);
  });

  it('sanitize 를 거치지 않은 범위 밖 값은 [0,360) 로 랩한다', () => {
    expect(resolveTrueNorth(withTrueNorth(360))).toBe(0);
    expect(resolveTrueNorth(withTrueNorth(410))).toBe(50);
    expect(resolveTrueNorth(withTrueNorth(-90))).toBe(270);
  });

  it('숫자가 아닌 오염값은 기본값으로 방어한다', () => {
    for (const raw of [
      '50',
      null,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ]) {
      expect(resolveTrueNorth(withTrueNorth(raw))).toBe(
        SCENE_TRUE_NORTH_DEFAULT,
      );
    }
  });
});

describe('bearingToWorldAzimuth', () => {
  it('진북 0 이면 지리 방위가 곧 월드 방위다', () => {
    expect(bearingToWorldAzimuth(0, 0)).toBe(0);
    expect(bearingToWorldAzimuth(135, 0)).toBe(135);
  });

  it('진북만큼 돌린다 — 북은 진북 자리, 남은 그 반대편', () => {
    expect(bearingToWorldAzimuth(0, 50.6)).toBe(50.6);
    expect(bearingToWorldAzimuth(180, 50.6)).toBeCloseTo(230.6, 10);
  });

  it('360 을 넘거나 음수면 [0,360) 로 랩한다', () => {
    expect(bearingToWorldAzimuth(350, 20)).toBe(10);
    expect(bearingToWorldAzimuth(270, 90)).toBe(0);
    expect(bearingToWorldAzimuth(-10, 5)).toBe(355);
  });

  it('비유한 입력은 0 으로 방어한다', () => {
    expect(bearingToWorldAzimuth(Number.NaN, 10)).toBe(0);
    expect(bearingToWorldAzimuth(10, Number.POSITIVE_INFINITY)).toBe(0);
  });
});
