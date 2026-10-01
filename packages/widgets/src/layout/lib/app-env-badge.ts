/**
 * 헤더에 띄울 배포 환경 표시. 운영(prod)이거나 값이 없으면 null — 표시하지 않는다.
 * 값은 빌드 인자 `VITE_APP_ENV` (Dockerfile 의 DEPLOY_ENV).
 */
export function getAppEnvBadge(appEnv: string | undefined): string | null {
  const env = appEnv?.trim().toLowerCase();
  if (!env || env === 'prod' || env === 'production') return null;
  return env.toUpperCase();
}
