import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getActiveTagSource,
  hasTagIngest,
  publishTagNull,
  publishTagValue,
  readTagLiveNumber,
  readTagLiveValue,
  setActiveTagSource,
  setTagIngest,
  subscribeTagValues,
  tagLiveValues,
} from '../tag-value-bus';

beforeEach(() => {
  tagLiveValues.clear();
  setTagIngest(null);
  setActiveTagSource(null);
});

afterEach(() => {
  setTagIngest(null);
  setActiveTagSource(null);
});

describe('publishTagValue', () => {
  it('live 캐시에 기록하고 소비자에게 전달한다', () => {
    const ingest = vi.fn();
    setTagIngest(ingest);
    expect(hasTagIngest()).toBe(true);
    publishTagValue('C_1:x', 12);
    expect(ingest).toHaveBeenCalledWith('C_1:x', 12, undefined);
    expect(tagLiveValues.get('C_1:x')?.value).toBe(12);
  });

  it('소비자가 없어도 live 캐시는 남는다', () => {
    publishTagValue('C_1:x', 3);
    expect(tagLiveValues.get('C_1:x')?.value).toBe(3);
    expect(hasTagIngest()).toBe(false);
  });

  it('빈 키·비유한수는 버린다(캐시도 안 남김)', () => {
    const ingest = vi.fn();
    setTagIngest(ingest);
    publishTagValue('', 1);
    publishTagValue('k', NaN);
    publishTagValue('k', Infinity);
    expect(ingest).not.toHaveBeenCalled();
    expect(tagLiveValues.size).toBe(0);
  });

  it('publish 옵션은 소비자에게만 전달되고 관찰자에게는 가지 않는다', () => {
    const ingest = vi.fn();
    const listener = vi.fn();
    setTagIngest(ingest);
    const unsubscribe = subscribeTagValues(listener);
    publishTagValue('k', 1, { smoothTime: 0 });
    expect(ingest).toHaveBeenCalledWith('k', 1, { smoothTime: 0 });
    expect(listener).toHaveBeenCalledWith('k', 1, expect.any(Number));
    expect(listener.mock.calls[0]).toHaveLength(3);
    unsubscribe();
  });

  it('setTagIngest(null) 이후에는 전달하지 않는다', () => {
    const ingest = vi.fn();
    setTagIngest(ingest);
    setTagIngest(null);
    publishTagValue('k', 1);
    expect(ingest).not.toHaveBeenCalled();
  });
});

describe('changedAt', () => {
  it('같은 값 재수신은 at 만 갱신하고 changedAt 은 남는다', () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    publishTagValue('C_1:x', 5);
    expect(tagLiveValues.get('C_1:x')).toEqual({
      value: 5,
      at: 10_000,
      changedAt: 10_000,
    });
    vi.setSystemTime(12_000);
    publishTagValue('C_1:x', 5);
    expect(tagLiveValues.get('C_1:x')).toEqual({
      value: 5,
      at: 12_000,
      changedAt: 10_000,
    });
    vi.setSystemTime(13_000);
    publishTagValue('C_1:x', 6);
    expect(tagLiveValues.get('C_1:x')?.changedAt).toBe(13_000);
    vi.useRealTimers();
  });
});

describe('readTagLiveValue', () => {
  it('마지막으로 내보낸 값을 돌려준다', () => {
    publishTagValue('GC_04:gantry_position', 777.2);
    expect(readTagLiveValue('GC_04:gantry_position')).toBe(777.2);
    publishTagValue('GC_04:gantry_position', 0);
    expect(readTagLiveValue('GC_04:gantry_position')).toBe(0);
  });

  it('받은 적 없는 키·빈 키는 undefined', () => {
    expect(readTagLiveValue('GC_04:unknown')).toBeUndefined();
    expect(readTagLiveValue('')).toBeUndefined();
  });

  it('버려진 publish(비유한수)는 이전 값을 덮지 않는다', () => {
    publishTagValue('k', 5);
    publishTagValue('k', Number.NaN);
    expect(readTagLiveValue('k')).toBe(5);
  });

  it('캐시를 비우면 undefined 로 돌아간다 (시뮬레이션 종료)', () => {
    publishTagValue('k', 5);
    tagLiveValues.clear();
    expect(readTagLiveValue('k')).toBeUndefined();
  });

  it('소비자가 없어도 읽힌다', () => {
    expect(hasTagIngest()).toBe(false);
    publishTagValue('k', 9);
    expect(readTagLiveValue('k')).toBe(9);
  });
});

describe('활성 소스 게이트', () => {
  it('활성 소스가 없으면(null) 소스 유무와 무관하게 전부 통과한다', () => {
    expect(getActiveTagSource()).toBeNull();
    publishTagValue('k', 1);
    publishTagValue('k2', 2, { source: 'simulation' });
    expect(readTagLiveValue('k')).toBe(1);
    expect(readTagLiveValue('k2')).toBe(2);
  });

  it('활성 소스가 있으면 같은 소스만 통과 — 다른 소스·소스 없음은 캐시·소비자·관찰자 어디에도 닿지 않는다', () => {
    const ingest = vi.fn();
    const listener = vi.fn();
    setTagIngest(ingest);
    const unsubscribe = subscribeTagValues(listener);
    setActiveTagSource('simulation');
    publishTagValue('k', 1, { source: 'replay' });
    publishTagValue('k', 2, { source: 'realtime' });
    publishTagValue('k', 3);
    expect(tagLiveValues.has('k')).toBe(false);
    expect(ingest).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
    publishTagValue('k', 4, { source: 'simulation', smoothTime: 0 });
    expect(readTagLiveValue('k')).toBe(4);
    expect(ingest).toHaveBeenCalledWith('k', 4, {
      source: 'simulation',
      smoothTime: 0,
    });
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('소스를 바꾸면 live 캐시를 비우고, 같은 값 재설정은 비우지 않는다', () => {
    setActiveTagSource('replay');
    publishTagValue('k', 1, { source: 'replay' });
    setActiveTagSource('replay');
    expect(readTagLiveValue('k')).toBe(1);
    setActiveTagSource('simulation');
    expect(tagLiveValues.size).toBe(0);
    setActiveTagSource(null);
    expect(getActiveTagSource()).toBeNull();
  });
});

describe('publishTagNull', () => {
  it('표시 캐시만 null 로 바꾸고 소비자·관찰자에는 보내지 않는다 — 모델은 마지막 자세', () => {
    const ingest = vi.fn();
    const listener = vi.fn();
    setTagIngest(ingest);
    const unsubscribe = subscribeTagValues(listener);
    publishTagValue('k', 7);
    ingest.mockClear();
    listener.mockClear();
    publishTagNull('k');
    expect(readTagLiveValue('k')).toBeNull();
    expect(readTagLiveNumber('k')).toBeUndefined();
    expect(ingest).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('수신 시각은 갱신하고 변화 시각은 이어받는다 — 값 없음은 움직임이 아니다', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000);
    publishTagValue('k', 7);
    vi.spyOn(Date, 'now').mockReturnValue(5_000);
    publishTagNull('k');
    expect(tagLiveValues.get('k')).toEqual({
      value: null,
      at: 5_000,
      changedAt: 1_000,
    });
    // 같은 값 없음이 다시 와도 변화가 아니다.
    vi.spyOn(Date, 'now').mockReturnValue(6_000);
    publishTagNull('k');
    expect(tagLiveValues.get('k')?.changedAt).toBe(1_000);
    // 숫자가 돌아오면 변화다.
    vi.spyOn(Date, 'now').mockReturnValue(7_000);
    publishTagValue('k', 7);
    expect(tagLiveValues.get('k')).toEqual({
      value: 7,
      at: 7_000,
      changedAt: 7_000,
    });
    vi.restoreAllMocks();
  });

  it('처음부터 값 없음이면 움직인 적이 없다(changedAt -Infinity)', () => {
    publishTagNull('fresh');
    expect(tagLiveValues.get('fresh')?.changedAt).toBe(
      Number.NEGATIVE_INFINITY,
    );
    expect(readTagLiveValue('fresh')).toBeNull();
    expect(readTagLiveValue('never')).toBeUndefined();
  });

  it('빈 키는 무시하고 소스 게이트는 숫자와 같다', () => {
    publishTagNull('');
    expect(tagLiveValues.size).toBe(0);
    setActiveTagSource('realtime');
    publishTagNull('k', { source: 'replay' });
    publishTagNull('k');
    expect(tagLiveValues.has('k')).toBe(false);
    publishTagNull('k', { source: 'realtime' });
    expect(readTagLiveValue('k')).toBeNull();
  });
});
