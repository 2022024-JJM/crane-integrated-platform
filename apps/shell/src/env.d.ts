/// <reference types="vite/client" />

/**
 * vite-plugin-asset-hash 가 빌드 시 생성하는 가상 모듈.
 * 키는 public 기준 절대 경로('/models/x.glb'), 값은 내용 해시 8자리.
 */
declare module 'virtual:asset-hash-manifest' {
  export const ASSET_HASH_MANIFEST: Record<string, string>;
}
