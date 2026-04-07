import { createRestClient } from '@crane/core/api';

// dev 환경에서는 Vite proxy('/open-meteo' → https://api.open-meteo.com)를
// 거쳐 호출한다. 일부 사내망에서 브라우저가 외부 호스트에 직접 접근할 때
// 502/CORS 차단이 발생하기 때문이다. production은 직접 호출.
const viteEnv = (import.meta as unknown as { env?: { DEV?: boolean } }).env;
const isDev = viteEnv?.DEV === true;

export const openMeteoClient = createRestClient({
  baseUrl: isDev ? '/open-meteo' : 'https://api.open-meteo.com',
  timeoutMs: 10_000,
});
