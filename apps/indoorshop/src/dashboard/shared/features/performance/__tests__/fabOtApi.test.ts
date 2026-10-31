import { describe, expect, it } from 'vitest'
import { FAB_STAGES } from '../model/types'
import { toCollectionEvent, toFabStageSummary } from '../api/fabOtAdapter'
import { mockBlockCheckpoints, mockFabDrawing, mockFabEvents, mockFabParts } from '../api/fabOtMock'
import type { FabEvent } from '../api/fabOtTypes'

/*
 * 가공 OT API v1.0 — 모의 서버가 명세 모양을 지키고, 어댑터가 화면 정본 S1~S10 으로 옮기는지.
 */
const asOf = '2026-10-29'

describe('C2 → 단계별 실적률 카드', () => {
  const dto = mockBlockCheckpoints('7004', '222', { asOf, includeHeld: true })
  const summary = toFabStageSummary(dto)

  it('화면 절점은 S1~S10 그대로 — S5 는 Hot DB 에 없어 빈 카드, S8 은 보류 절점(GRIND)', () => {
    expect(summary.stages.map((s) => s.stage)).toEqual([...FAB_STAGES])
    const s5 = summary.stages.find((s) => s.stage === 'S5')!
    expect(s5.code).toBeNull()
    expect(s5.rate).toBeNull()
    expect(summary.stages.find((s) => s.stage === 'S8')).toMatchObject({ code: 'GRIND', held: true })
  })

  it('실적률은 절점마다 자기 단위 — 강재 kg · 도면 MH · 부재 개수', () => {
    const measureOf = (stage: string) => summary.stages.find((s) => s.stage === stage)!.measure
    expect(['S1', 'S2', 'S3', 'S4'].map(measureOf)).toEqual(['WEIGHT', 'WEIGHT', 'WEIGHT', 'WEIGHT'])
    expect(['S6', 'S7'].map(measureOf)).toEqual(['MH', 'MH'])
    expect(['S8', 'S9', 'S10'].map(measureOf)).toEqual(['COUNT', 'COUNT', 'COUNT'])
  })

  it('doneRate = doneQty ÷ targetQty, 건수는 대상 = 완료 + 진행 + 미도래', () => {
    for (const cp of dto.checkpoints) {
      expect(cp.targetCnt).toBe(cp.doneCnt + cp.inProgressCnt + cp.notDueCnt)
      if (cp.targetQty > 0) expect(cp.doneRate).toBeCloseTo((cp.doneQty / cp.targetQty) * 100, 0)
    }
  })

  it('원천 확정 대기는 명세 C2 그대로 — 강재 입고(도착) · 1차 · 2차 선별', () => {
    expect(summary.stages.filter((s) => s.pendingSource).map((s) => s.stage)).toEqual(['S1', 'S2', 'S3'])
  })

  it('곡가공(BEND_DONE)은 S7 카드의 보조 줄로만 선다', () => {
    const bend = dto.checkpoints.find((c) => c.code === 'BEND_DONE')!
    expect(summary.stages.find((s) => s.stage === 'S7')!.sub).toEqual({
      code: 'BEND_DONE', name: '곡가공 완료', doneCount: bend.doneCnt, targetCount: bend.targetCnt,
    })
    expect(summary.stages.filter((s) => s.sub).map((s) => s.stage)).toEqual(['S7'])
  })

  it('최종 불출의 진행은 모둠선별을 지난 부재만 — 모둠선별 전 부재는 미도래', () => {
    const r = mockBlockCheckpoints('7012', '240', { asOf, includeHeld: true })
    const group = r.checkpoints.find((c) => c.code === 'GROUP')!
    const issue = r.checkpoints.find((c) => c.code === 'PART_ISSUE')!
    expect(issue.doneCnt + issue.inProgressCnt).toBe(group.doneCnt)
    expect(issue.notDueCnt).toBe(issue.targetCnt - group.doneCnt)
  })

  it('계획% 는 화면 절점 S1~S10 기준 — Hot DB 절점이 없는 S5 를 뺀 9개가 분모', () => {
    const planned = summary.stages.filter((s) => s.code !== null)
    expect(planned).toHaveLength(9)
    const due = planned.filter((s) => s.planDate !== null && s.planDate <= asOf).length
    expect(summary.overall.planPct).toBeCloseTo((due / 9) * 100, 1)
  })

  it('includeHeld 없이는 보류 절점(GRIND)이 오지 않는다', () => {
    expect(mockBlockCheckpoints('7004', '222', { asOf }).checkpoints.map((c) => c.code)).not.toContain('GRIND')
  })

  it('기준일을 앞으로 돌리면 실적은 줄기만 한다', () => {
    const earlier = mockBlockCheckpoints('7004', '222', { asOf: '2026-10-15', includeHeld: true })
    earlier.checkpoints.forEach((cp, i) => expect(cp.doneCnt).toBeLessThanOrEqual(dto.checkpoints[i].doneCnt))
  })
})

describe('B4 → 수집 현황', () => {
  it('기간 안의 사건만, 최신순으로 온다', () => {
    const page = mockFabEvents({ hullNo: '7004', blockNo: ['222'], from: '2026-10-01', to: asOf })
    for (const e of page.items) {
      expect(e.eventTs.slice(0, 10) >= '2026-10-01' && e.eventTs.slice(0, 10) <= asOf).toBe(true)
    }
    const ts = page.items.map((e) => e.eventTs)
    expect([...ts].sort().reverse()).toEqual(ts)
  })

  it('절단 착수(MARK_DONE)는 S7 진행, 곡가공(BEND_DONE)은 화면에 없다', () => {
    const base: FabEvent = {
      eventId: 'x', origin: 'L_EVENT', unitType: 'DWG', unitId: '7004DS222CNE01', dwgNo: '7004DS222CNE01',
      hullNo: '7004', blockNo: '222', eventGroup: 'CHECKPOINT', eventCode: 'MARK_DONE', eventName: '마킹 완료',
      seq: 6, basis: 'DWG', source: '310M', eventTs: '2026-10-29T08:12:00+09:00', hasTime: true, conf: 'HIGH',
      srcValue: null, flagged: false, mntTs: null, srcJob: null, polledAt: null,
    }
    expect(toCollectionEvent(base)).toMatchObject({ stage: 'S7', status: 'inProgress', completed: null, mgmtNoType: 'DWG' })
    expect(toCollectionEvent({ ...base, eventCode: 'BEND_DONE' })).toBeNull()
    /* 날짜만 있는 원천은 시각을 숨긴다 */
    expect(toCollectionEvent({ ...base, eventCode: 'CUT_DONE', hasTime: false })?.completed).toEqual({ date: '2026-10-29' })
  })
})

describe('B2 · B5 — 하위 데이터 원천', () => {
  it('도면 번호(14자)로 도면 · 부재 요약을, 같은 도면의 부재 목록을 준다', () => {
    const dwgNo = mockFabEvents({ hullNo: '7004', blockNo: ['222'], from: '2026-09-01', to: asOf }).items.find(
      (e) => e.unitType === 'DWG'
    )!.dwgNo
    expect(dwgNo).toHaveLength(14)
    const detail = mockFabDrawing(dwgNo)!
    const parts = mockFabParts({ hullNo: '7004', dwgNo }).items
    expect(detail.parts.total).toBe(parts.length)
    expect(parts.every((p) => p.dwgNo === dwgNo)).toBe(true)
  })
})

describe('절점 세부 — 줄을 세면 카드 숫자가 나온다', () => {
  it.each(['S1', 'S4', 'S6', 'S7', 'S8', 'S9', 'S10'] as const)('%s', async (stage) => {
    const { fetchFabStageDetail, fetchFabStageSummary } = await import('../api/fabOtApi')
    const card = (await fetchFabStageSummary('7012', '240', asOf)).stages.find((s) => s.stage === stage)!
    const detail = await fetchFabStageDetail('7012', '240', stage, asOf)
    const of = (st: string) => detail.rows.filter((r) => r.status === st)
    if (card.basis === 'PART') {
      /* 부재 줄 하나 = 부재 하나 */
      expect(of('done')).toHaveLength(card.doneCount)
      expect(of('inProgress')).toHaveLength(card.inProgressCount)
      expect(of('notDue')).toHaveLength(card.notDueCount)
    } else {
      /* 도면 줄 — 강재는 강판 장 수를, 도면은 도면 수를 더한다 */
      const sum = (st: string) => of(st).reduce((n, r) => n + (r.units?.target ?? 1), 0)
      expect(sum('done')).toBe(card.doneCount)
      expect(sum('inProgress') + sum('notDue')).toBe(card.inProgressCount + card.notDueCount)
    }
  })

  it('S5 는 Hot DB 절점이 없어 줄이 없다', async () => {
    const { fetchFabStageDetail } = await import('../api/fabOtApi')
    expect((await fetchFabStageDetail('7012', '240', 'S5', asOf)).rows).toEqual([])
  })
})

describe('종합 근거 — 근거 줄의 합계가 종합 카드의 숫자다', () => {
  it.each([
    ['7012', '233'],
    ['7004', '222'],
  ])('%s-%s', async (hull, block) => {
    const { fetchFabOverallBasis } = await import('../api/fabOtApi')
    const b = await fetchFabOverallBasis(hull, block, asOf)
    const dwg = b.drawings.filter((d) => d.excludedReason === null)
    const auto = (dwg.reduce((s, d) => s + d.doneMh, 0) / dwg.reduce((s, d) => s + d.targetMh, 0)) * 100
    expect(b.overall.autoPct).toBeCloseTo(auto, 1)
    const wo = b.workOrders.filter((w) => !w.excluded)
    const legacy = wo.reduce((s, w) => s + w.planMh * w.accRate, 0) / wo.reduce((s, w) => s + w.planMh, 0)
    expect(b.overall.legacyPct).toBeCloseTo(legacy, 1)
    const counted = b.plan.filter((p) => p.code !== null)
    expect(b.overall.planPct).toBeCloseTo((counted.filter((p) => p.due).length / counted.length) * 100, 1)
  })
})

describe('실적률 기준 — 계획일 기준(계획 도래분)', () => {
  it('분모는 기준일까지 계획일이 온 대상만 — 전체 대비보다 작거나 같고, 실적률은 100% 를 넘지 않는다', async () => {
    const { fetchFabStageSummaryBy, fetchFabStageDetail } = await import('../api/fabOtApi')
    for (const [hull, block] of [['7012', '233'], ['7004', '222']] as const) {
      const all = await fetchFabStageSummaryBy(hull, block, asOf, 'all')
      const plan = await fetchFabStageSummaryBy(hull, block, asOf, 'plan')
      /* 계획%는 기준과 상관없이 그대로 — 판별 실적 · 레거시 정산은 아래 검사에서 */
      expect(plan.overall.planPct).toBe(all.overall.planPct)
      for (const card of plan.stages) {
        const whole = all.stages.find((s) => s.stage === card.stage)!
        if (card.code === null) continue
        expect(card.targetCount).toBeLessThanOrEqual(whole.targetCount + whole.excludedCount)
        expect(card.doneCount).toBeLessThanOrEqual(card.targetCount)
        if (card.rate !== null) expect(card.rate).toBeLessThanOrEqual(100)
        /* 분모 = 계획일이 기준일까지 온 세부 줄(미대상 제외) */
        const detail = await fetchFabStageDetail(hull, block, card.stage, asOf)
        const due = detail.rows.filter((r) => r.status !== 'excluded' && r.planDate !== null && r.planDate <= asOf)
        if (card.basis === 'DWG' || card.basis === 'PART') expect(card.targetCount).toBe(due.length)
        if (due.length === 0) expect(card.rate).toBeNull()
      }
    }
  })
})

describe('종합 · 레거시 정산 — 계획일 기준', () => {
  it.each([
    ['7012', '233'],
    ['7004', '222'],
  ])('%s-%s: 근거 줄은 계획 도래분만이고, 그 합계가 카드 숫자와 같다', async (hull, block) => {
    const { fetchFabOverallBasis, fetchFabStageSummaryBy } = await import('../api/fabOtApi')
    const { mockFabAnchors, mockFabWorkOrders } = await import('../api/fabOtMock')
    const summary = await fetchFabStageSummaryBy(hull, block, asOf, 'plan')
    const b = await fetchFabOverallBasis(hull, block, asOf, 'plan')
    expect(b.basis).toBe('plan')
    expect(b.overall).toEqual(summary.overall)

    /* 분모 = 절단 완료 계획일이 기준일까지 온 도면(미대상 제외) */
    const due = mockFabAnchors(hull, block, asOf).filter((a) => !a.excluded && a.cpPlan.CUT_DONE <= asOf)
    expect(b.drawings.map((d) => d.dwgNo).sort()).toEqual(due.map((a) => a.anchorId).sort())
    const dwgMh = b.drawings.reduce((n, d) => n + d.targetMh, 0)
    if (dwgMh > 0) expect(b.overall.autoPct).toBeCloseTo((b.drawings.reduce((n, d) => n + d.doneMh, 0) / dwgMh) * 100, 1)
    else expect(b.overall.autoPct).toBeNull()

    /* 레거시: 계획 완료일이 기준일까지 온 W/O 만 */
    const dueWo = mockFabWorkOrders({ hullNo: hull, blockNo: block, asOf }).items.filter(
      (w) => !w.excluded && w.planFd !== null && w.planFd <= asOf
    )
    expect(b.workOrders).toHaveLength(dueWo.length)
    const woMh = b.workOrders.reduce((n, w) => n + w.planMh, 0)
    if (woMh > 0) expect(b.overall.legacyPct).toBeCloseTo(b.workOrders.reduce((n, w) => n + w.planMh * w.accRate, 0) / woMh, 1)
    else expect(b.overall.legacyPct).toBeNull()
  })
})
