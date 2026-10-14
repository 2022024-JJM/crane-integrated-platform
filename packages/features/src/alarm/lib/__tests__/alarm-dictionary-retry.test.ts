import { describe, expect, it } from 'vitest';
import {
  RETRY_BASE_MS,
  RETRY_MAX_MS,
  retryDelayMs,
} from '../alarm-dictionary-retry';

describe('retryDelayMs', () => {
  it('1회차는 기본, 2배씩, 상한에서 멈추고, 0·음수 시도는 1회차로 본다', () => {
    expect(retryDelayMs(1)).toBe(RETRY_BASE_MS);
    expect(retryDelayMs(2)).toBe(RETRY_BASE_MS * 2);
    expect(retryDelayMs(4)).toBe(RETRY_BASE_MS * 8);
    expect(retryDelayMs(20)).toBe(RETRY_MAX_MS);
    expect(retryDelayMs(0)).toBe(RETRY_BASE_MS);
    expect(retryDelayMs(-3)).toBe(RETRY_BASE_MS);
  });
});
