import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  hasTagIngest,
  publishTagValue,
  readTagLiveValue,
  setTagIngest,
  subscribeTagValues,
  tagLiveValues,
} from '../tag-value-bus';

beforeEach(() => {
  tagLiveValues.clear();
  setTagIngest(null);
});

afterEach(() => {
  setTagIngest(null);
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
