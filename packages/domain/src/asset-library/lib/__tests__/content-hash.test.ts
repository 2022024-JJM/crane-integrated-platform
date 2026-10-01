import { afterEach, describe, expect, it, vi } from 'vitest';
import { fnv1aPair, hashBytes } from '../content-hash';

const bytes = (text: string) => new TextEncoder().encode(text);

afterEach(() => vi.unstubAllGlobals());

describe('hashBytes', () => {
  it('Web Crypto 가 있으면 SHA-256(접두어 포함)', async () => {
    // "abc" 의 SHA-256 — 알려진 테스트 벡터.
    expect(await hashBytes(bytes('abc'))).toBe(
      'sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('같은 내용은 같은 해시, 다른 내용은 다른 해시', async () => {
    expect(await hashBytes(bytes('same'))).toBe(await hashBytes(bytes('same')));
    expect(await hashBytes(bytes('same'))).not.toBe(await hashBytes(bytes('Same')));
  });

  it('crypto.subtle 이 없으면(http 배포) FNV 폴백으로 떨어진다', async () => {
    vi.stubGlobal('crypto', {});
    const hash = await hashBytes(bytes('abc'));
    expect(hash).toBe(`fnv:${fnv1aPair(bytes('abc'))}`);
    expect(hash).toMatch(/^fnv:[0-9a-f]{16}$/);
  });

  it('digest 가 던져도 폴백으로 떨어진다', async () => {
    vi.stubGlobal('crypto', {
      subtle: { digest: () => Promise.reject(new Error('blocked')) },
    });
    expect(await hashBytes(bytes('abc'))).toMatch(/^fnv:/);
  });
});

describe('fnv1aPair', () => {
  it('빈 입력도 16자리 hex 를 낸다', () => {
    expect(fnv1aPair(new Uint8Array(0))).toMatch(/^[0-9a-f]{16}$/);
  });

  it('한 바이트 차이를 구분한다', () => {
    expect(fnv1aPair(bytes('crane-a'))).not.toBe(fnv1aPair(bytes('crane-b')));
  });
});
