/// <reference types="vite/client" />

/**
 * 주소 → 앱 범위(crane · indoor) 판정.
 *
 * 번들 하나가 crane 주소(`BASE_URL`)와 indoor 주소(`VITE_INDOOR_BASE_URL`)를
 * 함께 받는다. 앱이 뜰 때 주소를 보고 범위와 React Router basename 을 정한다.
 * indoor 주소가 설정되지 않으면 `split` 이 false — 범위를 나누지 않는 기존 동작.
 */

export type AppScope = 'crane' | 'indoor';

export interface ResolvedAppScope {
  scope: AppScope;
  /** BrowserRouter basename. 끝 슬래시 없음 ('' | '/crane_rnd' | '/crane_rnd/indoor/dev') */
  basename: string;
  /** indoor 주소가 설정돼 범위를 나누는지 */
  split: boolean;
}

function withSlash(path: string): string {
  return path.endsWith('/') ? path : `${path}/`;
}

function normalizeBase(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return withSlash(trimmed.startsWith('/') ? trimmed : `/${trimmed}`);
}

/** 주소만으로 범위를 정한다. indoor 는 끝 슬래시까지 일치해야 한다(`/crane_rnd/indoor-work` 는 crane). */
export function resolveAppScope(
  pathname: string,
  baseUrl: string | undefined,
  indoorBaseUrl: string | undefined,
): ResolvedAppScope {
  const crane = normalizeBase(baseUrl) ?? '/';
  const indoor = normalizeBase(indoorBaseUrl);
  if (indoor && indoor !== crane) {
    if (pathname === indoor.slice(0, -1) || pathname.startsWith(indoor)) {
      return { scope: 'indoor', basename: indoor.slice(0, -1), split: true };
    }
    return { scope: 'crane', basename: crane.slice(0, -1), split: true };
  }
  return { scope: 'crane', basename: crane.slice(0, -1), split: false };
}

/** 범위의 시작 주소(끝 슬래시 포함). indoor 가 설정되지 않았으면 null. */
export function getScopeBaseUrl(
  scope: AppScope,
  baseUrl: string | undefined,
  indoorBaseUrl: string | undefined,
): string | null {
  if (scope === 'indoor') return normalizeBase(indoorBaseUrl);
  return normalizeBase(baseUrl) ?? '/';
}

/** 다른 범위의 같은 라우트 주소. 예: ('/keyin', '?a=1', '/crane_rnd/indoor/') → '/crane_rnd/indoor/keyin?a=1' */
export function toScopeUrl(
  routePath: string,
  search: string,
  targetBase: string,
): string {
  return `${withSlash(targetBase)}${routePath.replace(/^\/+/, '')}${search}`;
}

/** 지금 문서 주소 기준 범위. 브라우저에서만 호출한다. */
export function currentAppScope(): ResolvedAppScope {
  return resolveAppScope(
    window.location.pathname,
    import.meta.env.BASE_URL,
    import.meta.env.VITE_INDOOR_BASE_URL,
  );
}

/** 지금 빌드 설정 기준 범위 시작 주소. */
export function currentScopeBaseUrl(scope: AppScope): string | null {
  return getScopeBaseUrl(
    scope,
    import.meta.env.BASE_URL,
    import.meta.env.VITE_INDOOR_BASE_URL,
  );
}
