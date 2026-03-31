import { createRestClient } from '@/shared/api';

export const openMeteoClient = createRestClient({
  baseUrl: 'https://api.open-meteo.com',
  timeoutMs: 10_000,
});
