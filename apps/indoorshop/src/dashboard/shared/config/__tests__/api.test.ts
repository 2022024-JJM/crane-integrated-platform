import { afterEach, describe, expect, it, vi } from 'vitest'

/*
 * API 설정은 **모듈을 읽는 순간** 환경 변수를 굳힌다(빌드 시점 치환과 같은 성질).
 * 그래서 값을 바꿔 보려면 매번 모듈을 다시 읽어야 한다 — 그 절차를 여기 한 줄로 둔다.
 */
async function loadApi(env: Record<string, string> = {}) {
  vi.resetModules()
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value)
  return import('../api')
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('API 설정', () => {
  it('아무것도 주지 않으면 개발 기본값으로 선다', async () => {
    const { API_CONFIG, isMockSource } = await loadApi()
    expect(API_CONFIG.baseUrl).toBe('/api')
    expect(API_CONFIG.timeoutMs).toBe(10_000)
    expect(API_CONFIG.mode).toBe('mock')
    expect(isMockSource()).toBe(true)
  })

  it('환경 변수로 주소와 제한 시간을 바꾼다', async () => {
    const { API_CONFIG, apiUrl } = await loadApi({
      VITE_API_BASE: 'https://ot.example/api/',
      VITE_API_TIMEOUT_MS: '3000',
    })
    /* 끝의 '/' 는 떼어 둔다 — 이어 붙일 때 '//' 가 생기지 않게 */
    expect(API_CONFIG.baseUrl).toBe('https://ot.example/api')
    expect(API_CONFIG.timeoutMs).toBe(3000)
    expect(apiUrl('performance/blocks')).toBe('https://ot.example/api/performance/blocks')
    expect(apiUrl('/performance/blocks')).toBe('https://ot.example/api/performance/blocks')
  })

  it('알아볼 수 없는 값은 조용히 실연동으로 넘어가지 않는다', async () => {
    const { API_CONFIG } = await loadApi({
      VITE_DATA_SOURCE: 'true',
      VITE_API_TIMEOUT_MS: '-1',
    })
    expect(API_CONFIG.mode).toBe('mock')
    expect(API_CONFIG.timeoutMs).toBe(10_000)
  })

  it('영역별로 출처를 따로 뒤집는다 — 실연동은 한 번에 오지 않는다', async () => {
    const { dataSourceMode, isMockSource } = await loadApi({
      VITE_DATA_SOURCE: 'mock',
      VITE_DATA_SOURCE_PERFORMANCE: 'live',
    })
    expect(dataSourceMode('performance')).toBe('live')
    expect(isMockSource('performance')).toBe(false)
    /* 지정하지 않은 영역은 전체 기본값을 따른다 */
    expect(dataSourceMode('equipment')).toBe('mock')
    expect(dataSourceMode()).toBe('mock')
  })

  it('전체를 실연동으로 두고 한 영역만 mock 으로 되돌릴 수 있다', async () => {
    const { dataSourceMode } = await loadApi({
      VITE_DATA_SOURCE: 'live',
      VITE_DATA_SOURCE_EQUIPMENT: 'mock',
    })
    expect(dataSourceMode()).toBe('live')
    expect(dataSourceMode('yard')).toBe('live')
    expect(dataSourceMode('equipment')).toBe('mock')
  })
})
