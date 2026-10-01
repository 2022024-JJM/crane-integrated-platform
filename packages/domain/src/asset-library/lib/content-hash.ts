/**
 * 파일 콘텐츠 해시 — 등록 전 중복 감지와, 서버로 옮길 때의 무결성 확인에 쓴다.
 *
 * SHA-256(Web Crypto)이 기본이다. 다만 `crypto.subtle` 은 보안 컨텍스트
 * (https·localhost)에서만 있고, 폐쇄망의 http 배포에서는 undefined 다.
 * 그때는 FNV-1a 32bit 두 줄기(시드만 다른)로 떨어진다 — 암호학적 강도는
 * 없지만 "같은 파일을 또 올렸는가" 를 알아보는 데는 충분하다. 알고리즘을
 * 접두어로 남겨 두 값이 섞여 비교되지 않게 한다.
 */

function toHex(bytes: Uint8Array): string {
  let hex = '';
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0');
  return hex;
}

const FNV_PRIME = 16777619;
const FNV_OFFSET = 0x811c9dc5;
const FNV_SECOND_SEED = 0x9e3779b9;

/** 수십 MB 파일도 한 번에 훑도록 BigInt 없이 32bit 정수 연산만 쓴다. */
export function fnv1aPair(bytes: Uint8Array): string {
  let a = FNV_OFFSET;
  let b = FNV_OFFSET ^ FNV_SECOND_SEED;
  for (let i = 0; i < bytes.length; i += 1) {
    a = Math.imul(a ^ bytes[i], FNV_PRIME);
    b = Math.imul(b ^ bytes[i], FNV_PRIME);
  }
  const hex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  return `${hex(a)}${hex(b)}`;
}

export async function hashBytes(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    try {
      // Uint8Array<ArrayBufferLike> 는 BufferSource 로 바로 넘어가지 않는다
      // (SharedArrayBuffer 가능성) — 복사본의 ArrayBuffer 를 넘긴다.
      const digest = await subtle.digest('SHA-256', bytes.slice().buffer);
      return `sha256:${toHex(new Uint8Array(digest))}`;
    } catch {
      // 아래 폴백으로.
    }
  }
  return `fnv:${fnv1aPair(bytes)}`;
}
