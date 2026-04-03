import { createRestClient } from '@crane/core/api';

export const openMeteoClient = createRestClient({
  baseUrl: 'https://api.open-meteo.com',
  timeoutMs: 10_000,
});
