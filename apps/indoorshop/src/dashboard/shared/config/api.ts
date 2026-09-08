/*
 * API 접속 설정 — **주소·시간·데이터 출처를 한 곳에서** 정한다.
 *
 * 지금 화면들은 전부 fixture/mock 을 읽는다. 실연동이 시작되면 그 전환이 화면 수십
 * 곳에 흩어진 `fetch('/api/...')` 를 하나씩 고치는 일이 되어서는 안 된다 — 여기가
 * 그 전환의 유일한 손잡이다.
 *
 * **이 파일은 네트워크를 부르지 않는다.** 값과 규칙만 있고, 실제 호출(fetch 래퍼·
 * 재시도·인증 헤더)은 실연동 프로토콜이 확정된 뒤 별도로 세운다(AGENTS.md — 미확정
 * 항목에 기대는 코드를 미리 쓰지 않는다). 지금은 그때 채울 자리를 비워 둔 것이다.
 *
 * ── 환경 변수(.env.example 참조) ─────────────────────────────────
 *   VITE_API_BASE            API 기준 주소 (기본 '/api' — dev 서버 프록시 경유)
 *   VITE_API_TIMEOUT_MS      요청 제한 시간, 밀리초 (기본 10000)
 *   VITE_DATA_SOURCE         'mock' | 'live' — 화면 전체의 기본 데이터 출처 (기본 'mock')
 *   VITE_DATA_SOURCE_{영역}   그 영역만 따로 (예: VITE_DATA_SOURCE_PERFORMANCE=live)
 *
 * Vite 는 `import.meta.env.VITE_*` 를 **빌드 시점에 문자열로 치환**한다. 그래서 키를
 * 계산해서 읽으면(`import.meta.env['VITE_' + name]`) 배포 빌드에서 조용히 undefined 가
 * 된다 — 아래 `DOMAIN_ENV` 가 영역 목록을 **정적으로** 적어 두는 이유다.
 * ────────────────────────────────────────────────────────────────
 */

/** 화면이 읽는 데이터가 어디서 오는가 */
export type DataSourceMode = 'mock' | 'live'

/**
 * 출처를 따로 뒤집을 수 있는 영역.
 *
 * 실연동은 한 번에 오지 않는다 — 통합실적이 먼저 붙고 설비 상태는 OT 가동 뒤다.
 * 그 사이를 "전부 mock 아니면 전부 live"로만 다루면 붙은 쪽을 시험할 수 없다.
 */
export type ApiDomain = 'performance' | 'equipment' | 'yard'

const DOMAIN_ENV: Record<ApiDomain, string | undefined> = {
  performance: import.meta.env.VITE_DATA_SOURCE_PERFORMANCE,
  equipment: import.meta.env.VITE_DATA_SOURCE_EQUIPMENT,
  yard: import.meta.env.VITE_DATA_SOURCE_YARD,
}

/** 기본값 — 아무것도 주지 않은 개발자의 기계에서 그대로 도는 값이어야 한다 */
const DEFAULT_BASE = '/api'
const DEFAULT_TIMEOUT_MS = 10_000
const DEFAULT_MODE: DataSourceMode = 'mock'

function parseMode(raw: string | undefined, fallback: DataSourceMode): DataSourceMode {
  const value = raw?.trim().toLowerCase()
  if (value === 'mock' || value === 'live') return value
  /* 오타('Live ', 'true')는 조용히 실연동으로 넘어가지 않는다 — 안전한 쪽(mock)으로 */
  return fallback
}

function parseTimeout(raw: string | undefined): number {
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_TIMEOUT_MS
}

/** 끝의 '/' 는 떼어 둔다 — `apiUrl()` 이 언제나 하나만 넣도록 */
function normalizeBase(raw: string | undefined): string {
  const value = (raw ?? DEFAULT_BASE).trim() || DEFAULT_BASE
  return value.endsWith('/') ? value.slice(0, -1) : value
}

export interface ApiConfig {
  /** 기준 주소 — 상대('/api')도 절대('https://…')도 된다 */
  baseUrl: string
  /** 요청 제한 시간(ms). 응답 없는 요청이 화면을 영원히 뼈대로 붙잡아 두지 않게 */
  timeoutMs: number
  /** 화면 전체의 기본 데이터 출처 */
  mode: DataSourceMode
}

export const API_CONFIG: ApiConfig = {
  baseUrl: normalizeBase(import.meta.env.VITE_API_BASE),
  timeoutMs: parseTimeout(import.meta.env.VITE_API_TIMEOUT_MS),
  mode: parseMode(import.meta.env.VITE_DATA_SOURCE, DEFAULT_MODE),
}

/**
 * 이 영역의 데이터 출처.
 * 영역별 값이 있으면 그것을, 없으면 전체 기본값을 따른다.
 */
export function dataSourceMode(domain?: ApiDomain): DataSourceMode {
  if (!domain) return API_CONFIG.mode
  return parseMode(DOMAIN_ENV[domain], API_CONFIG.mode)
}

/** 지금 이 영역이 mock 을 읽는가 — 화면의 '목업' 배지와 api 파사드의 분기가 함께 본다 */
export function isMockSource(domain?: ApiDomain): boolean {
  return dataSourceMode(domain) === 'mock'
}

/**
 * 종단 주소를 만든다 — `apiUrl('/performance/blocks')` → `'/api/performance/blocks'`.
 * 앞의 '/' 는 있어도 없어도 같게 받는다(호출부가 규칙을 외우지 않도록).
 */
export function apiUrl(path: string): string {
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${API_CONFIG.baseUrl}${suffix}`
}
