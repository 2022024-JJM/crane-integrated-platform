import {
  RestClientError,
  RestClientTimeoutError,
} from './errors';
import type {
  QueryValue,
  RestClientHeaders,
  RestClientOptions,
  RestRequestConfig,
  RestRequestQuery,
  RestRequestOptions,
} from './types';

function appendQueryValue(
  searchParams: URLSearchParams,
  key: string,
  value: Exclude<QueryValue, Array<unknown>>,
) {
  if (value === null || value === undefined) {
    return;
  }

  searchParams.append(key, String(value));
}

function createUrl(baseUrl: string, path: string, query?: RestRequestQuery) {
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  const resolvedBaseUrl =
    typeof window !== 'undefined'
      ? new URL(baseUrl, window.location.origin).toString()
      : baseUrl;
  const url = new URL(normalizedPath, `${resolvedBaseUrl.replace(/\/+$/, '')}/`);

  if (!query) {
    return url;
  }

  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        appendQueryValue(searchParamsOrThrow(url), key, entry);
      });
      continue;
    }

    appendQueryValue(searchParamsOrThrow(url), key, value);
  }

  return url;
}

function searchParamsOrThrow(url: URL) {
  return url.searchParams;
}

function mergeHeaders(...headersList: Array<RestClientHeaders | undefined>) {
  const headers = new Headers();

  headersList.forEach((entry) => {
    if (!entry) {
      return;
    }

    new Headers(entry).forEach((value, key) => {
      headers.set(key, value);
    });
  });

  return headers;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Blob) &&
    !(value instanceof FormData) &&
    !(value instanceof URLSearchParams) &&
    !(value instanceof ArrayBuffer) &&
    !(value instanceof ReadableStream)
  );
}

function createAbortSignal(
  signal: AbortSignal | undefined,
  timeoutMs: number | undefined,
) {
  const controller = new AbortController();
  let timeoutId: number | null = null;

  const abortWithReason = () => {
    controller.abort();
  };

  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener('abort', abortWithReason, { once: true });
    }
  }

  if (timeoutMs && timeoutMs > 0) {
    timeoutId = window.setTimeout(() => {
      controller.abort();
    }, timeoutMs);
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      if (signal) {
        signal.removeEventListener('abort', abortWithReason);
      }

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    },
  };
}

async function parseResponseBody(response: Response) {
  if (response.status === 204) {
    return undefined;
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  const text = await response.text();
  return text.length > 0 ? text : undefined;
}

export class RestClient {
  private readonly baseUrl: string;
  private readonly defaultHeaders: RestClientHeaders | undefined;
  private readonly timeoutMs: number | undefined;
  private readonly headersFactory: RestClientOptions['headersFactory'];
  private readonly fetchFn: typeof fetch;

  constructor(options: RestClientOptions) {
    const defaultFetch =
      typeof globalThis.fetch === 'function'
        ? globalThis.fetch.bind(globalThis)
        : fetch;

    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.defaultHeaders = options.defaultHeaders;
    this.timeoutMs = options.timeoutMs;
    this.headersFactory = options.headersFactory;
    this.fetchFn = options.fetchFn ?? defaultFetch;
  }

  get<T>(path: string, options?: RestRequestOptions) {
    return this.request<T>(path, {
      ...options,
      method: 'GET',
    });
  }

  post<T>(
    path: string,
    body?: RestRequestConfig['body'],
    options?: RestRequestOptions,
  ) {
    return this.request<T>(path, {
      ...options,
      body,
      method: 'POST',
    });
  }

  put<T>(
    path: string,
    body?: RestRequestConfig['body'],
    options?: RestRequestOptions,
  ) {
    return this.request<T>(path, {
      ...options,
      body,
      method: 'PUT',
    });
  }

  patch<T>(
    path: string,
    body?: RestRequestConfig['body'],
    options?: RestRequestOptions,
  ) {
    return this.request<T>(path, {
      ...options,
      body,
      method: 'PATCH',
    });
  }

  delete<T>(path: string, options?: RestRequestOptions) {
    return this.request<T>(path, {
      ...options,
      method: 'DELETE',
    });
  }

  async request<T>(path: string, config: RestRequestConfig) {
    const url = createUrl(this.baseUrl, path, config.query);
    const { signal, cleanup } = createAbortSignal(
      config.signal,
      config.timeoutMs ?? this.timeoutMs,
    );
    const headers = mergeHeaders(
      this.defaultHeaders,
      this.headersFactory?.(),
      config.headers,
    );
    const body = this.createRequestBody(config.body, headers);

    try {
      const response = await this.fetchFn(url, {
        body,
        headers,
        method: config.method,
        signal,
      });
      const responseBody = await parseResponseBody(response);

      if (!response.ok) {
        throw new RestClientError(
          `Request failed with status ${response.status}.`,
          response.status,
          responseBody,
        );
      }

      return responseBody as T;
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === 'AbortError' &&
        !config.signal?.aborted
      ) {
        throw new RestClientTimeoutError();
      }

      throw error;
    } finally {
      cleanup();
    }
  }

  private createRequestBody(
    body: RestRequestConfig['body'],
    headers: Headers,
  ) {
    if (body === null || body === undefined) {
      return undefined;
    }

    if (isPlainObject(body)) {
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }

      return JSON.stringify(body);
    }

    return body;
  }
}
