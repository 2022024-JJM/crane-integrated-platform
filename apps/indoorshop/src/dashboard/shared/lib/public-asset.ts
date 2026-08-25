/**
 * public/ 자산 경로에 Vite BASE_URL 을 씌운다.
 *
 * 원본(ocean-inshop-process/web-dashboard)은 루트(`/`)에 배포되어 `/real-scan/g1.bin`
 * 같은 절대 경로를 그대로 fetch 했다. 셸은 sub-path(`/crane_rnd/`)에 올라가므로
 * 그 경로가 그대로면 앱 밖을 가리켜 404 → SPA fallback(HTML)을 바이너리로 읽는다.
 */
export function publicAsset(path: string): string {
  const base = (import.meta.env.BASE_URL ?? '/').replace(/\/+$/, '');
  const tail = path.startsWith('/') ? path : `/${path}`;
  return `${base}${tail}`;
}
