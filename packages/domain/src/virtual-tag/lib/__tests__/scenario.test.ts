import { describe, expect, it } from 'vitest';
import type { ScenarioTrack, VirtualScenario } from '../../model/types';
import {
  evaluateScenarioTrack,
  isScenarioFinished,
  normalizeKeyframes,
  scenarioDurationMs,
  scenarioTimeMs,
} from '../scenario';

const track: ScenarioTrack = {
  key: 'A:x',
  keyframes: [
    { atMs: 0, value: 0 },
    { atMs: 1000, value: 10 },
    { atMs: 2000, value: 10, ease: 'hold' },
    { atMs: 3000, value: 0, ease: 'smooth' },
  ],
};

describe('evaluateScenarioTrack', () => {
  it('첫 키프레임 전·마지막 뒤는 양 끝 값, 빈 트랙은 undefined', () => {
    expect(evaluateScenarioTrack(track, -5)).toBe(0);
    expect(evaluateScenarioTrack(track, 0)).toBe(0);
    expect(evaluateScenarioTrack(track, 3000)).toBe(0);
    expect(evaluateScenarioTrack(track, 99_999)).toBe(0);
    expect(
      evaluateScenarioTrack({ key: 'k', keyframes: [] }, 0),
    ).toBeUndefined();
  });

  it('linear 는 선형, hold 는 이전 값 유지(도착 시각 정확값에서 점프), smooth 는 중간에서 절반', () => {
    expect(evaluateScenarioTrack(track, 500)).toBeCloseTo(5, 10);
    expect(evaluateScenarioTrack(track, 1000)).toBe(10);
    // 1000~2000 구간(hold): 10 유지, 2000 에서 10(같은 값).
    expect(evaluateScenarioTrack(track, 1999)).toBe(10);
    // 2000~3000 구간(smooth): 중점 5, 1/4 지점은 선형(7.5)보다 10 에 가깝다.
    expect(evaluateScenarioTrack(track, 2500)).toBeCloseTo(5, 10);
    expect(evaluateScenarioTrack(track, 2250)!).toBeGreaterThan(7.5);
  });

  it('hold 구간은 도착 값이 달라도 이전 값을 유지한다', () => {
    const step: ScenarioTrack = {
      key: 'k',
      keyframes: [
        { atMs: 0, value: 1 },
        { atMs: 100, value: 9, ease: 'hold' },
      ],
    };
    expect(evaluateScenarioTrack(step, 99)).toBe(1);
    expect(evaluateScenarioTrack(step, 100)).toBe(9);
  });

  it('NaN 시각은 0 으로 본다', () => {
    expect(evaluateScenarioTrack(track, NaN)).toBe(0);
  });
});

describe('scenarioDurationMs / scenarioTimeMs / isScenarioFinished', () => {
  const scenario: VirtualScenario = {
    id: 's',
    name: '',
    loop: false,
    tracks: [track, { key: 'B:y', keyframes: [{ atMs: 4500, value: 1 }] }],
  };

  it('길이는 가장 늦은 키프레임, 트랙 없음은 0', () => {
    expect(scenarioDurationMs(scenario)).toBe(4500);
    expect(scenarioDurationMs({ ...scenario, tracks: [] })).toBe(0);
  });

  it('loop 는 나머지, 아니면 길이에서 멈춤, 길이 0·음수·NaN 은 0', () => {
    expect(scenarioTimeMs(5000, 4500, false)).toBe(4500);
    expect(scenarioTimeMs(5000, 4500, true)).toBe(500);
    expect(scenarioTimeMs(4500, 4500, true)).toBe(0);
    expect(scenarioTimeMs(-3, 4500, true)).toBe(0);
    expect(scenarioTimeMs(NaN, 4500, false)).toBe(0);
    expect(scenarioTimeMs(10, 0, false)).toBe(0);
  });

  it('끝 판정 — 경계 정확값 포함, loop 는 절대 끝나지 않음', () => {
    expect(isScenarioFinished(4499, 4500, false)).toBe(false);
    expect(isScenarioFinished(4500, 4500, false)).toBe(true);
    expect(isScenarioFinished(999_999, 4500, true)).toBe(false);
    expect(isScenarioFinished(0, 0, false)).toBe(true);
  });
});

describe('normalizeKeyframes', () => {
  it('정렬·같은 시각 중복(첫 항목)·비유한수 제거, 입력 불변', () => {
    const input = [
      { atMs: 300, value: 3 },
      { atMs: 100, value: 1 },
      { atMs: 100, value: 99 },
      { atMs: NaN, value: 5 },
      { atMs: 200, value: Infinity },
    ];
    const out = normalizeKeyframes(input);
    expect(out).toEqual([
      { atMs: 100, value: 1 },
      { atMs: 300, value: 3 },
    ]);
    expect(input[0].atMs).toBe(300);
  });
});
