const DEFAULT_API_TIMEOUT_MS = 10_000;
const DEFAULT_WS_RECONNECT_INTERVAL_MS = 3_000;
const DEFAULT_WS_MAX_RECONNECT_ATTEMPTS = 5;
const DEFAULT_API_FALLBACK_PATH = 'api';
const DEFAULT_WS_FALLBACK_PATH = 'ws';

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

function trimLeadingSlash(value: string) {
  return value.replace(/^\/+/, '');
}

function resolveOrigin() {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  return 'http://localhost:5173';
}

function resolveHttpBaseUrl(value: string | undefined, fallbackPath: string) {
  if (value && value.trim()) {
    return trimTrailingSlash(value.trim());
  }

  return `${resolveOrigin()}/${trimLeadingSlash(fallbackPath)}`;
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
  if (value && value.trim()) {
    return trimTrailingSlash(value.trim());
  }

  return `${toWebSocketOrigin(resolveOrigin())}/${trimLeadingSlash(
    fallbackPath,
  )}`;
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
  return resolveHttpBaseUrl(
    import.meta.env.VITE_API_BASE_URL,
    DEFAULT_API_FALLBACK_PATH,
  );
}

export function getWebSocketBaseUrl() {
  return resolveWebSocketBaseUrl(
    import.meta.env.VITE_WS_BASE_URL,
    DEFAULT_WS_FALLBACK_PATH,
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

export function getLidarWebSocketUrl() {
  const envUrl = import.meta.env.VITE_LIDAR_WS_URL;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim();
  }
  return 'ws://192.168.122.140:9002';
}

export function getApiTimeoutMs() {
  return parsePositiveInteger(
    import.meta.env.VITE_API_TIMEOUT_MS,
    DEFAULT_API_TIMEOUT_MS,
  );
}

export function getWebSocketReconnectIntervalMs() {
  return parsePositiveInteger(
    import.meta.env.VITE_WS_RECONNECT_INTERVAL_MS,
    DEFAULT_WS_RECONNECT_INTERVAL_MS,
  );
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
    wsMaxReconnectAttempts: getWebSocketMaxReconnectAttempts(),
  };
}
