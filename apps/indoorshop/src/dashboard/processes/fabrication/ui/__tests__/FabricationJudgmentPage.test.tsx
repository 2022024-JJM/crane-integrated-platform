import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../shared/lib/testing/renderWithProviders'
import type {
  CutProgress,
  DashboardSummary,
  JudgmentRow,
  RollProgress,
  RollTrace,
} from '../../model/dashboard'

/* 모듈 i18n 조각은 앱 bootstrap 이 등록한다 — 테스트에서는 손으로 등록한다 */
const i18n = (await import('../../../../shared/lib/i18n/config')).default
const { fabricationKo } = await import('../../i18n/ko')
const { fabricationEn } = await import('../../i18n/en')
i18n.addResourceBundle('ko', 'inshop', fabricationKo, true, true)
i18n.addResourceBundle('en', 'inshop', fabricationEn, true, true)

const { FabricationJudgmentPage } = await import('../pages/FabricationJudgmentPage')

/*
 * 가공 판별 현황판 — 조회 API 응답이 화면의 어느 자리에 서는지, 행을 누르면 판별 근거가
 * 그 ROLL 로 조회되는지, 서비스가 없을 때 무엇을 말하는지를 본다. 네트워크는 전부 stub 이다.
 */

const T = '2026-09-01T01:00:00Z'

const summary: DashboardSummary = {
  checkpointCounts: { RECEIVING: 3, FIRST_PICK: 2, CUTTING: 6 },
  stateCounts: { ROLL_RECEIVED: 1, ROLL_FIRST_PICKED: 1, PART_CUT: 6 },
  rollCount: 2,
  partCount: 6,
  emergencyIssueCount: 1,
  lastJudgedAt: T,
  states: [
    { stateId: 'ROLL_RECEIVED', name: '강재 입고', terminal: false },
    { stateId: 'ROLL_FIRST_PICKED', name: '1차 선별 완료', terminal: false },
    { stateId: 'PART_CUT', name: '부재 절단 완료', terminal: true },
  ],
  watermarks: [{ sourceTable: 'legacy_sty01c', lastPolledAt: T, updatedAt: T }],
  mirrorTables: [{ table: 'legacy_sty01c', rowCount: 2, lastUpdatedAt: T }],
}

function judgment(id: number, type: 'ROLL' | 'PART', trackingId: string, eventType: string, checkpoint: string, stateId: string): JudgmentRow {
  return {
    id,
    eventId: `${type}:${trackingId}:${eventType}`,
    checkpoint,
    trackingObjectType: type,
    trackingObjectId: trackingId,
    eventType,
    fromStateId: null,
    stateId,
    terminal: false,
    occurredAt: T,
    judgedAt: T,
    sourceTable: 'legacy_sty01c',
    sourceRef: trackingId,
    attributes: { dwg_no: 'DWG-1' },
  }
}

const rolls: RollProgress[] = [
  {
    mirror: {
      rollNo: 'R-1', matCode: 'M-1', dwgNo: 'DWG-1', stus: '3', bay: 'B1', cutMchNo: 'CM01', issPlnDate: null,
      acptDate: T, frstPickActlDate1: T, scndPickActlDate: null, issActlDate: null,
      issueConfirmed: false, emergency: false, ingestedAt: T, updatedAt: T,
    },
    judgedStateId: 'ROLL_FIRST_PICKED', judgedAt: T, mirrorStageId: 'ROLL_FIRST_PICKED', gap: false,
  },
  {
    mirror: {
      rollNo: 'R-2', matCode: 'M-2', dwgNo: 'DWG-2', stus: '9', bay: 'B1', cutMchNo: 'CM01', issPlnDate: null,
      acptDate: T, frstPickActlDate1: T, scndPickActlDate: T, issActlDate: T,
      issueConfirmed: true, emergency: false, ingestedAt: T, updatedAt: T,
    },
    /* 미러는 불출까지 갔는데 판별은 1차 선별에 멈춤 — 화면이 '미반영' 으로 드러내야 한다 */
    judgedStateId: 'ROLL_FIRST_PICKED', judgedAt: T, mirrorStageId: 'ROLL_ISSUED', gap: true,
  },
]

const cuts: CutProgress[] = [
  { cut: { mandt: '100', cutBayNo: 'B1', cutMchCode: 'CM01', dwgNo: 'DWG-1', cutMfgFd: '2026-09-01', prcsStusCode: 'C', updatedAt: T }, bomPartCount: 3, judgedPartCount: 3 },
]

const trace: RollTrace = {
  roll: rolls[0],
  pickOrders: [{ workClsf: '1', prcsClsf: '3', dwgNo: 'DWG-1', projNo: null, blkNo: null, cutMchNo: 'CM01', issPlnDate: null, pickSerNo: 'PS-1', updatedAt: T }],
  issueOrder: null,
  history: [
    { id: 1, workOrdNo: 'WO-1', eqpClsf: null, ptnClsf: 'K71', fromAddr: 'A', toAddr: 'B', startDate: T, endDate: T, excluded: false },
    { id: 2, workOrdNo: 'WO-2', eqpClsf: null, ptnClsf: 'H55', fromAddr: 'B', toAddr: 'C', startDate: T, endDate: T, excluded: true },
  ],
  judgments: [
    judgment(1, 'ROLL', 'R-1', 'STEEL_RECEIVED', 'RECEIVING', 'ROLL_RECEIVED'),
    judgment(2, 'ROLL', 'R-1', 'FIRST_PICK_COMPLETED', 'FIRST_PICK', 'ROLL_FIRST_PICKED'),
  ],
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

/** 경로별 응답 — 호출된 경로를 기록해 어느 ROLL 을 조회했는지 단언한다 */
function stubApi() {
  const calls: string[] = []
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    const path = url.replace(/^https?:\/\/[^/]+/, '')
    calls.push(path)
    if (path.startsWith('/api/fabrication/dashboard/summary')) return jsonResponse(summary)
    if (path.startsWith('/api/fabrication/dashboard/judgments')) return jsonResponse(trace.judgments)
    if (path.startsWith('/api/fabrication/dashboard/rolls/R-1')) return jsonResponse(trace)
    if (path.startsWith('/api/fabrication/dashboard/rolls')) return jsonResponse(rolls)
    if (path.startsWith('/api/fabrication/dashboard/cuts')) return jsonResponse(cuts)
    return new Response('not found', { status: 404 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return { calls }
}

describe('가공 판별 실적 현황판', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('요약·미러 적재·ROLL 대조·절단 대조·최근 판별이 한 화면에 선다', async () => {
    stubApi()
    renderWithProviders(<FabricationJudgmentPage />, { route: '/indoorshop/zones/fabrication' })

    const rollTable = await screen.findByRole('table', { name: 'ROLL 진행 대조' })
    await within(rollTable).findByText('R-1')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('가공 판별 실적 현황판')

    /* 요약 타일 — 판별 실적은 절점 건수의 합(3+2+6) */
    const judgmentTile = screen.getByText('판별 실적').closest('div')!
    expect(judgmentTile).toHaveTextContent('11')
    expect(screen.getByText('추적 ROLL').closest('div')).toHaveTextContent('2')

    /* 상태 분포는 yml 이름으로 — 상태 id 는 보조 표기 */
    expect(screen.getByText('부재 절단 완료')).toBeInTheDocument()

    /* 미러 적재 표 */
    expect(screen.getAllByText('legacy_sty01c').length).toBeGreaterThan(0)

    /* ROLL 대조 — R-2 는 기반 데이터가 앞서 있어 '미반영' */
    const r2Row = within(rollTable).getByText('R-2').closest('tr')!
    expect(within(r2Row).getByText('미반영')).toBeInTheDocument()
    const r1Row = within(rollTable).getByText('R-1').closest('tr')!
    expect(within(r1Row).getByText('일치')).toBeInTheDocument()

    /* 절단 대조 — 전량 판별 3/3 */
    expect(screen.getByText('전량 3 / 3')).toBeInTheDocument()
  })

  it('ROLL 행을 누르면 그 ROLL 의 판별 근거를 조회해 기반 컬럼과 판별 행을 대조한다', async () => {
    const { calls } = stubApi()
    const user = userEvent.setup()
    renderWithProviders(<FabricationJudgmentPage />, { route: '/indoorshop/zones/fabrication' })

    const rollTable = await screen.findByRole('table', { name: 'ROLL 진행 대조' })
    await user.click(await within(rollTable).findByText('R-1'))

    await screen.findByText('ROLL R-1 판별 근거')
    expect(calls.some((path) => path === '/api/fabrication/dashboard/rolls/R-1')).toBe(true)

    /* 절점별 대조표 — 기반 컬럼명이 그대로 보이고, 2차 선별은 미도래 */
    const compareTable = screen.getByRole('table', { name: '절점별 기반 컬럼 ↔ 판별 결과' })
    expect(within(compareTable).getByText('FRST_PICK_ACTL_DATE_1')).toBeInTheDocument()
    const secondPickRow = within(compareTable).getByText('SCND_PICK_ACTL_DATE').closest('tr')!
    expect(within(secondPickRow).getByText('미도래')).toBeInTheDocument()

    /* 이적 이력은 판별 제외로 표시된다 */
    expect(screen.getByText('이적 · 판별 제외')).toBeInTheDocument()
    expect(screen.getByText('PS-1')).toBeInTheDocument()
  })

  it('판별 서비스에 닿지 못하면 이유와 확인할 곳을 말한다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    renderWithProviders(<FabricationJudgmentPage />, { route: '/indoorshop/zones/fabrication' })

    await screen.findByText('판별 서비스 조회 API 에 연결할 수 없습니다.')
    expect(screen.getByText(/VITE_FABRICATION_API_URL/)).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('R-1')).not.toBeInTheDocument())
  })
})
