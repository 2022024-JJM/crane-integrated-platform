import { describe, expect, it } from 'vitest';
import {
  AUTO_RESET_BASE_MS,
  AUTO_RESET_MAX_MS,
  CHUNK_RELOAD_MIN_INTERVAL_MS,
  CHUNK_RELOAD_STAMP_KEY,
  autoResetDelayMs,
  claimChunkReload,
  isChunkLoadError,
} from '../route-error-recovery';

describe('autoResetDelayMs', () => {
  it('1회차는 기본, 2배씩, 상한에서 멈춘다; 비정상 입력은 1회차', () => {
    expect(autoResetDelayMs(1)).toBe(AUTO_RESET_BASE_MS);
    expect(autoResetDelayMs(2)).toBe(AUTO_RESET_BASE_MS * 2);
    expect(autoResetDelayMs(3)).toBe(AUTO_RESET_BASE_MS * 4);
    expect(autoResetDelayMs(50)).toBe(AUTO_RESET_MAX_MS);
    expect(autoResetDelayMs(0)).toBe(AUTO_RESET_BASE_MS);
    expect(autoResetDelayMs(NaN)).toBe(AUTO_RESET_BASE_MS);
    expect(autoResetDelayMs(2.9)).toBe(AUTO_RESET_BASE_MS * 2);
  });
});

describe('isChunkLoadError', () => {
  it('Vite·브라우저의 동적 import 실패 메시지를 잡고, 다른 에러는 아니다', () => {
    expect(
      isChunkLoadError(
        new Error('Failed to fetch dynamically imported module: /assets/x.js'),
      ),
    ).toBe(true);
    expect(
      isChunkLoadError(new TypeError('Importing a module script failed.')),
    ).toBe(true);
    expect(isChunkLoadError('Loading chunk 12 failed')).toBe(true);
    expect(isChunkLoadError(new Error('Cannot read properties of null'))).toBe(
      false,
    );
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError({})).toBe(false);
  });
});

describe('claimChunkReload', () => {
  function storage(initial: Record<string, string> = {}) {
    const map = new Map(Object.entries(initial));
    return {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      map,
    };
  }
  it('처음이면 true 이고 시각을 남긴다; 최소 간격 안이면 false; 지나면 다시 true', () => {
    const s = storage();
    expect(claimChunkReload(1000, s)).toBe(true);
    expect(s.map.get(CHUNK_RELOAD_STAMP_KEY)).toBe('1000');
    expect(claimChunkReload(1000 + CHUNK_RELOAD_MIN_INTERVAL_MS - 1, s)).toBe(
      false,
    );
    expect(claimChunkReload(1000 + CHUNK_RELOAD_MIN_INTERVAL_MS, s)).toBe(true);
  });
  it('스토리지가 없거나 깨진 값이면 true', () => {
    expect(claimChunkReload(5, null)).toBe(true);
    expect(
      claimChunkReload(5, storage({ [CHUNK_RELOAD_STAMP_KEY]: 'x' })),
    ).toBe(true);
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {},
    };
    expect(claimChunkReload(5, throwing)).toBe(true);
  });
});
