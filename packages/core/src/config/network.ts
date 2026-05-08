const DEFAULT_API_TIMEOUT_MS = 10_000;
const DEFAULT_WS_RECONNECT_INTERVAL_MS = 1_000;
const DEFAULT_WS_RECONNECT_MAX_INTERVAL_MS = 30_000;
const DEFAULT_WS_MAX_RECONNECT_ATTEMPTS = 5;

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

function trimLeadingSlash(value: string) {
  return value.replace(/^\/+/, '');
}

function trimSurroundingSlashes(value: string) {
  return trimLeadingSlash(trimTrailingSlash(value));
}

function resolveOrigin() {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  return import.meta.env.VITE_DEV_ORIGIN ?? 'http://localhost:5173';
}

/**
 * Vite `base` 설정에서 유도한 sub-path (예: '/crane_rnd').
 * 배포 환경이 서브패스 아래 서비스될 때 api/ws 도 동일 sub-path 하위로 나가야
 * 리버스 프록시에서 정상 라우팅된다. leading/trailing slash 는 모두 제거해
 * 조합하기 쉬운 형태로 반환한다. 서브패스가 없으면 빈 문자열.
 */
function getBasePathPrefix(): string {
  const base = import.meta.env.BASE_URL ?? '/';
  const trimmed = trimSurroundingSlashes(base);
  return trimmed; // '' | 'crane_rnd' | 'some/nested/base'
}

function defaultApiPath(): string {
  const prefix = getBasePathPrefix();
  return prefix ? `${prefix}/api` : 'api';
}

function defaultWsPath(): string {
  const prefix = getBasePathPrefix();
  return prefix ? `${prefix}/ws` : 'ws';
}

/**
 * 환경변수 값이 다양한 형태로 들어올 수 있다:
 *   - 'http://host/api'            완전한 URL
 *   - '/crane_rnd/api'             절대 path
 *   - 'crane_rnd/api'              상대 path
 *   - 'api'                        단순 segment
 * 모두 origin + path 결합 결과로 정규화한다.
 */
function resolveHttpBaseUrl(value: string | undefined, fallbackPath: string) {
  const raw = value && value.trim() ? value.trim() : undefined;

  if (raw && /^https?:\/\//i.test(raw)) {
    return trimTrailingSlash(raw);
  }

  const path = raw ?? fallbackPath;
  return `${resolveOrigin()}/${trimSurroundingSlashes(path)}`;
}

function toWebSocketOrigin(origin: string) {
  if (origin.startsWith('https://')) {
    return `wss://${origin.slice('https://'.length)}`;
  }

  if (origin.startsWith('http://')) {
    return `ws://${origin.slice('http://'.length)}`;
  }

  return origin;
}

function resolveWebSocketBaseUrl(
  value: string | undefined,
  fallbackPath: string,
) {
  const raw = value && value.trim() ? value.trim() : undefined;

  if (raw && /^wss?:\/\//i.test(raw)) {
    return trimTrailingSlash(raw);
  }

  // http(s):// 로 주면 ws(s):// 로 바꿔서 수용
  if (raw && /^https?:\/\//i.test(raw)) {
    return trimTrailingSlash(toWebSocketOrigin(raw));
  }

  const path = raw ?? fallbackPath;
  return `${toWebSocketOrigin(resolveOrigin())}/${trimSurroundingSlashes(path)}`;
}

function parsePositiveInteger(
  value: string | undefined,
  fallbackValue: number,
) {
  if (!value) {
    return fallbackValue;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackValue;
}

function joinPathSegments(baseUrl: string, path: string) {
  const normalizedPath = trimLeadingSlash(path);

  if (!normalizedPath) {
    return trimTrailingSlash(baseUrl);
  }

  return `${trimTrailingSlash(baseUrl)}/${normalizedPath}`;
}

export function getApiBaseUrl() {
  return resolveHttpBaseUrl(import.meta.env.VITE_API_BASE_URL, defaultApiPath());
}

export function getWebSocketBaseUrl() {
  return resolveWebSocketBaseUrl(
    import.meta.env.VITE_WS_BASE_URL,
    defaultWsPath(),
  );
}

export function getApiPath(path: string) {
  return trimLeadingSlash(path);
}

export function getApiUrl(path: string) {
  return joinPathSegments(getApiBaseUrl(), getApiPath(path));
}

export function getWsPath(path: string) {
  return trimLeadingSlash(path);
}

export function getWebSocketUrl(path: string) {
  return joinPathSegments(getWebSocketBaseUrl(), getWsPath(path));
}

export function getCranesLiteWebSocketUrl() {
  return getWebSocketUrl('cranes-lite/all');
}

function defaultLidarPath(): string {
  const prefix = getBasePathPrefix();
  return prefix ? `${prefix}/lidar` : 'lidar';
}

export function getLidarWebSocketUrl() {
  // LiDAR 서버 IP/PORT 는 런타임 nginx 프록시(LIDAR_HOST/LIDAR_PORT)에서 결정된다.
  // 프론트는 항상 동일 origin 의 /lidar/ 경로로 ws 연결만 시도한다.
  // 끝 슬래시를 붙여서 nginx 의 prefix-match `/crane_rnd/lidar/` location 에
  // 곧장 매칭되도록 한다. 슬래시가 없으면 nginx 가 301 redirect 를 보내는데
  // WebSocket 핸드셰이크는 redirect 를 따라가지 못해 연결이 실패한다.
  return `${resolveWebSocketBaseUrl(undefined, defaultLidarPath())}/`;
}

export function getApiTimeoutMs() {
  return parsePositiveInteger(
    import.meta.env.VITE_API_TIMEOUT_MS,
    DEFAULT_API_TIMEOUT_MS,
  );
}

export function getWebSocketInitialIntervalMs() {
  return parsePositiveInteger(
    import.meta.env.VITE_WS_RECONNECT_INITIAL_MS ??
      import.meta.env.VITE_WS_RECONNECT_INTERVAL_MS,
    DEFAULT_WS_RECONNECT_INTERVAL_MS,
  );
}

export function getWebSocketMaxIntervalMs() {
  return parsePositiveInteger(
    import.meta.env.VITE_WS_RECONNECT_MAX_MS,
    DEFAULT_WS_RECONNECT_MAX_INTERVAL_MS,
  );
}

/**
 * @deprecated `getWebSocketInitialIntervalMs` 사용 권장. 기존 호출부 호환을 위해 유지.
 */
export function getWebSocketReconnectIntervalMs() {
  return getWebSocketInitialIntervalMs();
}

export function getWebSocketMaxReconnectAttempts() {
  return parsePositiveInteger(
    import.meta.env.VITE_WS_MAX_RECONNECT_ATTEMPTS,
    DEFAULT_WS_MAX_RECONNECT_ATTEMPTS,
  );
}

export function getNetworkConfig() {
  return {
    apiBaseUrl: getApiBaseUrl(),
    wsBaseUrl: getWebSocketBaseUrl(),
    monitoringReplayLiteApiUrl: getApiUrl('monitoring/replay-lite'),
    runtimeAlarmDictionaryApiUrl: getApiUrl('alarms/runtime'),
    cranesLiteWsUrl: getCranesLiteWebSocketUrl(),
    apiTimeoutMs: getApiTimeoutMs(),
    wsReconnectIntervalMs: getWebSocketReconnectIntervalMs(),
    wsReconnectInitialMs: getWebSocketInitialIntervalMs(),
    wsReconnectMaxMs: getWebSocketMaxIntervalMs(),
    wsMaxReconnectAttempts: getWebSocketMaxReconnectAttempts(),
  };
}
