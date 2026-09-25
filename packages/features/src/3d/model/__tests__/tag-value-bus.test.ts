import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  hasTagIngest,
  publishTagValue,
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
