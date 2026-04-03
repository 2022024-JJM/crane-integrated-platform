export type QueryValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Array<string | number | boolean | null | undefined>;

export type RestRequestQuery = Record<string, QueryValue>;
export type RestClientHeaders = HeadersInit;
export type RestClientHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RestRequestOptions {
  headers?: RestClientHeaders;
  query?: RestRequestQuery;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface RestRequestConfig extends RestRequestOptions {
  body?: BodyInit | Record<string, unknown> | null;
  method: RestClientHttpMethod;
}

export interface RestClientOptions {
  baseUrl: string;
  defaultHeaders?: RestClientHeaders;
  timeoutMs?: number;
  headersFactory?: () => RestClientHeaders | undefined;
  fetchFn?: typeof fetch;
}
