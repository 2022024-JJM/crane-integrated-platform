/// <reference types="vite/client" />

/**
 * vite-plugin-asset-hash 가 빌드 시 생성하는 가상 모듈.
 * 키는 public 기준 절대 경로('/models/x.glb'), 값은 내용 해시 8자리.
 */
declare module 'virtual:asset-hash-manifest' {
  export const ASSET_HASH_MANIFEST: Record<string, string>;
}

interface ImportMetaEnv {
  /** indoor 범위 주소 (예: '/crane_rnd/indoor/'). 없으면 범위를 나누지 않는다 */
  readonly VITE_INDOOR_BASE_URL?: string;
  /** 배포 환경 (dev · stage · prod). 헤더 환경 표시용 */
  readonly VITE_APP_ENV?: string;
}
