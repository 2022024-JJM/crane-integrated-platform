import { getApiBaseUrl, getApiTimeoutMs } from '../config/network';
import { RestClient } from './rest-client';
import type { RestClientOptions } from './types';

export function createRestClient(options: Partial<RestClientOptions> = {}) {
  return new RestClient({
    baseUrl: options.baseUrl ?? getApiBaseUrl(),
    defaultHeaders: options.defaultHeaders,
    headersFactory: options.headersFactory,
    timeoutMs: options.timeoutMs ?? getApiTimeoutMs(),
    fetchFn: options.fetchFn,
  });
}

export const restClient = createRestClient();
