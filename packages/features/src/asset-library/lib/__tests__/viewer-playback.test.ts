import { describe, expect, it, vi } from 'vitest';
import {
  clampPlaybackSpeed,
  createPlaybackClock,
  DEFAULT_PLAYBACK_SPEED,
  formatClipTime,
  isPlaybackSpeed,
  listPlaybackClips,
  matchPlaybackClip,
  PLAYBACK_MAX_FRAME_DELTA_SEC,
  PLAYBACK_SPEED_MAX,
  PLAYBACK_SPEED_MIN,
  resolvePlaybackClip,
  REST_POSE_CLIP,
  wrapPlaybackTime,
  type PlaybackClip,
} from '../viewer-playback';

const clip = (index: number, name: string, durationSec = 1): PlaybackClip => ({
  index,
  name,
  durationSec,
});

describe('listPlaybackClips', () => {
  it('클립이 없으면 빈 목록', () => {
    expect(listPlaybackClips([])).toEqual([]);
  });

  it('이름·길이·자리를 그대로 옮긴다', () => {
    expect(
      listPlaybackClips([
        { name: 'Walk', duration: 1 },
        { name: 'Person_Bike', duration: 4 },
      ]),
    ).toEqual([clip(0, 'Walk', 1), clip(1, 'Person_Bike', 4)]);
  });

  it('빈 이름은 순번으로 대신한다', () => {
    expect(
      listPlaybackClips([
        { name: '', duration: 1 },
        { name: '   ', duration: 1 },
      ]),
    ).toEqual([clip(0, '#1'), clip(1, '#2')]);
  });

  it('겹치는 이름은 뒤에 번호를 붙여 키가 겹치지 않게 한다', () => {
    const names = listPlaybackClips([
      { name: 'Action', duration: 1 },
      { name: 'Action', duration: 1 },
      { name: 'Action', duration: 1 },
      { name: 'Idle', duration: 1 },
    ]).map((item) => item.name);
    expect(names).toEqual(['Action', 'Action (2)', 'Action (3)', 'Idle']);
    expect(new Set(names).size).toBe(names.length);
  });

  it('기본 자세 항목과 같은 이름의 클립은 번호를 붙여 구분한다', () => {
    const names = listPlaybackClips([
      { name: REST_POSE_CLIP, duration: 1 },
      { name: 'Walk', duration: 1 },
    ]).map((item) => item.name);
    expect(names).not.toContain(REST_POSE_CLIP);
    expect(names).toEqual([`${REST_POSE_CLIP} (2)`, 'Walk']);
  });

  it('길이가 없거나 오염된 클립은 0초', () => {
    expect(
      listPlaybackClips([
        { name: 'a', duration: -1 },
        { name: 'b', duration: 0 },
        { name: 'c', duration: Number.NaN },
        { name: 'd', duration: Number.POSITIVE_INFINITY },
      ]).map((item) => item.durationSec),
    ).toEqual([0, 0, 0, 0]);
  });
});

describe('resolvePlaybackClip / matchPlaybackClip', () => {
  const clips = [clip(0, 'Idle'), clip(1, 'Walk')];

  it('요청이 없으면 첫 클립', () => {
    expect(resolvePlaybackClip(clips, null)).toBe(clips[0]);
    expect(matchPlaybackClip(clips, null)).toBe(clips[0]);
  });

  it('요청한 이름의 클립을 돌려준다', () => {
    expect(resolvePlaybackClip(clips, 'Walk')).toBe(clips[1]);
    expect(matchPlaybackClip(clips, 'Walk')).toBe(clips[1]);
  });

  it('요청한 이름이 없으면 resolve 는 첫 클립, match 는 null', () => {
    expect(resolvePlaybackClip(clips, 'Run')).toBe(clips[0]);
    expect(matchPlaybackClip(clips, 'Run')).toBeNull();
  });

  it('클립이 없으면 둘 다 null', () => {
    expect(resolvePlaybackClip([], null)).toBeNull();
    expect(resolvePlaybackClip([], 'Walk')).toBeNull();
    expect(matchPlaybackClip([], null)).toBeNull();
    expect(matchPlaybackClip([], 'Walk')).toBeNull();
  });

  it('이름은 정확히 같아야 한다', () => {
    expect(matchPlaybackClip(clips, 'walk')).toBeNull();
    expect(matchPlaybackClip(clips, 'Walk ')).toBeNull();
  });

  it('기본 자세를 고르면 클립이 있어도 둘 다 null', () => {
    expect(resolvePlaybackClip(clips, REST_POSE_CLIP)).toBeNull();
    expect(matchPlaybackClip(clips, REST_POSE_CLIP)).toBeNull();
  });
});

describe('isPlaybackSpeed', () => {
  it('경계 정확값은 통과한다', () => {
    expect(isPlaybackSpeed(PLAYBACK_SPEED_MIN)).toBe(true);
    expect(isPlaybackSpeed(PLAYBACK_SPEED_MAX)).toBe(true);
    expect(isPlaybackSpeed(DEFAULT_PLAYBACK_SPEED)).toBe(true);
  });

  it('경계 밖은 거부한다', () => {
    expect(isPlaybackSpeed(PLAYBACK_SPEED_MIN - 0.01)).toBe(false);
    expect(isPlaybackSpeed(PLAYBACK_SPEED_MAX + 0.01)).toBe(false);
    expect(isPlaybackSpeed(0)).toBe(false);
    expect(isPlaybackSpeed(-1)).toBe(false);
  });

  it('숫자가 아니거나 비정상이면 거부한다', () => {
    for (const value of [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      '1',
      null,
      undefined,
      true,
      [1],
    ]) {
      expect(isPlaybackSpeed(value)).toBe(false);
    }
  });
});

describe('clampPlaybackSpeed', () => {
  it('범위 안의 값은 그대로', () => {
    expect(clampPlaybackSpeed(PLAYBACK_SPEED_MIN)).toBe(PLAYBACK_SPEED_MIN);
    expect(clampPlaybackSpeed(PLAYBACK_SPEED_MAX)).toBe(PLAYBACK_SPEED_MAX);
    expect(clampPlaybackSpeed(0.5)).toBe(0.5);
  });

  it('범위 밖은 경계로 자른다', () => {
    expect(clampPlaybackSpeed(0)).toBe(PLAYBACK_SPEED_MIN);
    expect(clampPlaybackSpeed(-3)).toBe(PLAYBACK_SPEED_MIN);
    expect(clampPlaybackSpeed(PLAYBACK_SPEED_MAX + 0.01)).toBe(
      PLAYBACK_SPEED_MAX,
    );
    expect(clampPlaybackSpeed(100)).toBe(PLAYBACK_SPEED_MAX);
  });

  it('숫자가 아니면 기본 배속', () => {
    expect(clampPlaybackSpeed(Number.NaN)).toBe(DEFAULT_PLAYBACK_SPEED);
    expect(clampPlaybackSpeed(Number.POSITIVE_INFINITY)).toBe(
      DEFAULT_PLAYBACK_SPEED,
    );
    expect(clampPlaybackSpeed(Number.NEGATIVE_INFINITY)).toBe(
      DEFAULT_PLAYBACK_SPEED,
    );
  });

  it('부동소수 찌꺼기를 턴다', () => {
    expect(clampPlaybackSpeed(0.1 + 0.2)).toBe(0.3);
    expect(clampPlaybackSpeed(1.0000000001)).toBe(1);
  });
});

describe('wrapPlaybackTime', () => {
  it('길이 안의 시각은 그대로', () => {
    expect(wrapPlaybackTime(0, 1)).toBe(0);
    expect(wrapPlaybackTime(0.5, 1)).toBe(0.5);
  });

  it('길이에 닿으면 0 으로, 넘으면 감는다', () => {
    expect(wrapPlaybackTime(1, 1)).toBe(0);
    expect(wrapPlaybackTime(2.5, 1)).toBeCloseTo(0.5);
    expect(wrapPlaybackTime(7.3, 4)).toBeCloseTo(3.3);
  });

  it('음수는 끝에서부터 감는다', () => {
    expect(wrapPlaybackTime(-0.25, 1)).toBeCloseTo(0.75);
  });

  it('길이가 없거나 시각이 비정상이면 0', () => {
    expect(wrapPlaybackTime(0.5, 0)).toBe(0);
    expect(wrapPlaybackTime(0.5, -1)).toBe(0);
    expect(wrapPlaybackTime(0.5, Number.NaN)).toBe(0);
    expect(wrapPlaybackTime(Number.NaN, 1)).toBe(0);
    expect(wrapPlaybackTime(Number.POSITIVE_INFINITY, 1)).toBe(0);
  });
});

describe('formatClipTime', () => {
  it('1분 미만은 소수 둘째 자리 초', () => {
    expect(formatClipTime(1.07)).toBe('1.07');
    expect(formatClipTime(0)).toBe('0.00');
    expect(formatClipTime(59.999)).toBe('60.00');
  });

  it('1분 이상은 분:초.십분의일', () => {
    expect(formatClipTime(60)).toBe('1:00.0');
    expect(formatClipTime(62.5)).toBe('1:02.5');
    expect(formatClipTime(605.25)).toBe('10:05.3');
  });

  it('비정상 값은 0', () => {
    expect(formatClipTime(Number.NaN)).toBe('0.00');
    expect(formatClipTime(-3)).toBe('0.00');
    expect(formatClipTime(Number.POSITIVE_INFINITY)).toBe('0.00');
  });
});

describe('createPlaybackClock', () => {
  it('0 에서 시작한다', () => {
    expect(createPlaybackClock().getTime()).toBe(0);
  });

  it('delta × 배속만큼 나아가고 새 시각을 돌려준다', () => {
    const clock = createPlaybackClock();
    expect(clock.advance(0.02, 1, 1)).toBeCloseTo(0.02);
    expect(clock.advance(0.02, 2, 1)).toBeCloseTo(0.06);
    expect(clock.advance(0.02, 0.5, 1)).toBeCloseTo(0.07);
    expect(clock.getTime()).toBeCloseTo(0.07);
  });

  it('클립 길이에서 감는다', () => {
    const clock = createPlaybackClock();
    clock.setTime(0.95);
    expect(clock.advance(0.1, 1, 1)).toBeCloseTo(0.05);
  });

  it('멈춰 있던 시간이 길어도 한 프레임 상한만큼만 나아간다', () => {
    const clock = createPlaybackClock();
    expect(clock.advance(5, 1, 100)).toBe(PLAYBACK_MAX_FRAME_DELTA_SEC);
    // 상한은 벽시계 delta 에 걸리고 배속은 그 뒤에 곱한다.
    expect(clock.advance(5, 2, 100)).toBeCloseTo(
      PLAYBACK_MAX_FRAME_DELTA_SEC * 3,
    );
  });

  it('음수·비정상 delta 와 배속은 움직이지 않는다', () => {
    const clock = createPlaybackClock();
    clock.setTime(0.5);
    for (const delta of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(clock.advance(delta, 1, 1)).toBe(0.5);
    }
    for (const speed of [0, -1, Number.NaN]) {
      expect(clock.advance(0.02, speed, 1)).toBe(0.5);
    }
  });

  it('길이가 없는 클립에서는 0 에 머문다', () => {
    const clock = createPlaybackClock();
    expect(clock.advance(0.02, 1, 0)).toBe(0);
    clock.setTime(3);
    expect(clock.advance(0.02, 1, 0)).toBe(0);
  });

  it('setTime 은 바로 놓고 음수·비정상 값은 0', () => {
    const clock = createPlaybackClock();
    clock.setTime(0.75);
    expect(clock.getTime()).toBe(0.75);
    for (const value of [-1, Number.NaN, Number.NEGATIVE_INFINITY]) {
      clock.setTime(value);
      expect(clock.getTime()).toBe(0);
    }
  });

  it('setTime 만 구독자에게 알리고 advance 는 알리지 않는다', () => {
    const clock = createPlaybackClock();
    const listener = vi.fn();
    const unsubscribe = clock.subscribe(listener);
    clock.advance(0.02, 1, 1);
    expect(listener).not.toHaveBeenCalled();
    clock.setTime(0.3);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    clock.setTime(0.4);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('시계 하나를 둘이 읽으면 같은 시각을 본다', () => {
    const clock = createPlaybackClock();
    const driver = () => clock.advance(0.02, 1, 1);
    const follower = () => clock.getTime();
    driver();
    expect(follower()).toBeCloseTo(0.02);
    driver();
    expect(follower()).toBeCloseTo(0.04);
  });
});
