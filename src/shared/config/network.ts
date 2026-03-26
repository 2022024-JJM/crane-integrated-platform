const DEFAULT_API_TIMEOUT_MS = 10_000;
const DEFAULT_WS_RECONNECT_INTERVAL_MS = 3_000;
const DEFAULT_WS_MAX_RECONNECT_ATTEMPTS = 5;

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

function resolveUrl(value: string | undefined, fallbackPath: string) {
  if (value && value.trim()) {
    return trimTrailingSlash(value.trim());
  }

  return `${resolveOrigin()}/${trimLeadingSlash(fallbackPath)}`;
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

export function getApiBaseUrl() {
  return resolveUrl(import.meta.env.VITE_API_BASE_URL, 'api');
}

export function getWebSocketBaseUrl() {
  return resolveUrl(import.meta.env.VITE_WS_BASE_URL, 'ws');
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
    apiTimeoutMs: getApiTimeoutMs(),
    wsReconnectIntervalMs: getWebSocketReconnectIntervalMs(),
    wsMaxReconnectAttempts: getWebSocketMaxReconnectAttempts(),
  };
}
