import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  hasTagIngest,
  publishTagValue,
  setTagIngest,
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
    expect(ingest).toHaveBeenCalledWith('C_1:x', 12);
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

  it('setTagIngest(null) 이후에는 전달하지 않는다', () => {
    const ingest = vi.fn();
    setTagIngest(ingest);
    setTagIngest(null);
    publishTagValue('k', 1);
    expect(ingest).not.toHaveBeenCalled();
  });
});
