import { nowDate } from '../../../shared/lib/now'
import type {
  CutProgress,
  CutTrace,
  DashboardSnapshot,
  DashboardSummary,
  JudgmentRow,
  RollProgress,
  RollTrace,
} from '../model/dashboard'

/**
 * 가공 판별 조회 API 클라이언트.
 *
 * ot-pipeline-fabrication 의 `/api/fabrication/dashboard/**` (GET 전용) 를 직접 부른다 —
 * 가공 zone 은 필드 센서·브로커가 없어 판별 서비스가 유일한 데이터 출처다.
 * 서비스 주소는 `VITE_FABRICATION_API_URL` 로 바꾼다 (기본값은 로컬 개발 포트 매핑
 * deploy/README.md "로컬 개발 포트 매핑" 의 fabrication 18080).
 */
const DEFAULT_API_URL = 'http://localhost:18080'

function resolveApiBase(): string {
  const configured: unknown = import.meta.env.VITE_FABRICATION_API_URL
  const base = typeof configured === 'string' && configured.trim() ? configured.trim() : DEFAULT_API_URL
  return base.replace(/\/+$/, '')
}

export const FABRICATION_API_BASE = resolveApiBase()

/** 목록 화면이 한 번에 읽는 최대 건수 — 서버 상한(500) 안에서 화면이 감당하는 만큼만 */
export const JUDGMENT_LIMIT = 50
export const ROLL_LIMIT = 100
export const CUT_LIMIT = 50

export class FabricationApiError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null) {
    super(message)
    this.name = 'FabricationApiError'
    this.status = status
  }
}

async function getJson<T>(path: string): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${FABRICATION_API_BASE}${path}`, { headers: { Accept: 'application/json' } })
  } catch (error) {
    // 서비스가 안 떠 있거나 CORS 로 막힌 경우 — 상태 코드 없이 네트워크 오류로 온다
    throw new FabricationApiError(error instanceof Error ? error.message : String(error), null)
  }
  if (!response.ok) {
    throw new FabricationApiError(`${response.status} ${response.statusText}`, response.status)
  }
  return (await response.json()) as T
}

export function fetchSummary(): Promise<DashboardSummary> {
  return getJson('/api/fabrication/dashboard/summary')
}

export function fetchJudgments(limit = JUDGMENT_LIMIT): Promise<JudgmentRow[]> {
  return getJson(`/api/fabrication/dashboard/judgments?limit=${limit}`)
}

export function fetchRolls(limit = ROLL_LIMIT): Promise<RollProgress[]> {
  return getJson(`/api/fabrication/dashboard/rolls?limit=${limit}`)
}

export function fetchRollTrace(rollNo: string): Promise<RollTrace> {
  return getJson(`/api/fabrication/dashboard/rolls/${encodeURIComponent(rollNo)}`)
}

export function fetchCuts(limit = CUT_LIMIT): Promise<CutProgress[]> {
  return getJson(`/api/fabrication/dashboard/cuts?limit=${limit}`)
}

export function fetchCutTrace(dwgNo: string): Promise<CutTrace> {
  return getJson(`/api/fabrication/dashboard/cuts/${encodeURIComponent(dwgNo)}`)
}

/**
 * 화면 한 장이 쓰는 묶음을 한 번에 읽는다.
 *
 * 카드마다 따로 fetch 하면 갱신 주기마다 네 요청이 제각기 도착해 숫자가 잠깐 서로
 * 어긋난다 — 한 스냅샷으로 받아야 "판별 건수"와 "최근 판별 목록"이 같은 시점을 가리킨다.
 */
export async function fetchDashboardSnapshot(): Promise<DashboardSnapshot> {
  const [summary, judgments, rolls, cuts] = await Promise.all([
    fetchSummary(),
    fetchJudgments(),
    fetchRolls(),
    fetchCuts(),
  ])
  return { summary, judgments, rolls, cuts, fetchedAt: nowDate() }
}
