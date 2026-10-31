import { shiftDate, todayString } from '../lib/baseDate'
import type {
  FabAnchorDetail,
  FabBlockCheckpoints,
  FabCheckpointBasis,
  FabCheckpointCode,
  FabCheckpointStat,
  FabCheckpointWeight,
  FabCutPart,
  FabDrawing,
  FabDrawingDetail,
  FabEvent,
  FabPage,
  FabWorkOrder,
} from './fabOtTypes'

/**
 * 가공 OT API v1.0 **모의 서버** — 명세의 응답 모양 그대로 만든다(서버가 붙기 전 화면 개발용).
 *
 * 한 블록 = 절단 도면 6~10장, 도면마다 강판 1~6장 · 부재 4~12개. 도면마다 절점 일정이 하나 있고
 * 그 일정의 사건이 **오늘까지** 일어나 있다(사실). 기준일(asOf)은 그 사실을 어디서 끊어 보느냐일
 * 뿐이다 — 그래서 B2 · B5(기준일 없음)와 C2 · B4(기준일 · 기간)가 같은 사실을 말한다.
 *
 * 값은 호선 · 블록 · 도면 번호로 정해지는 결정적 의사난수다(같은 블록은 언제나 같은 도면).
 */

function hashOf(text: string): number {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0
  return Math.abs(h)
}

const pad2 = (n: number) => String(n).padStart(2, '0')
const round1 = (n: number) => Math.round(n * 10) / 10
const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * 가공 절점 사전 (m_code CHECKPOINT, 명세 §9) — seq 순.
 * `pendingSource` 는 명세 C2 「원천 확정 대기(강재 도착 · 선별 운영 재추출 전)」 그대로다 —
 * 강재 입고(도착) · 1차 선별 · 2차 선별 셋.
 */
interface CheckpointDef {
  code: FabCheckpointCode
  seq: number
  name: string
  phase: 'STOCK' | 'CUT'
  basis: FabCheckpointBasis
  weight: FabCheckpointWeight
  unit: string
  inScope: boolean
  pendingSource: boolean
  /** 도면 일정의 시작일로부터 며칠째 */
  dayOffset: number
  /** 원천 화면 · 시각 유무 */
  source: string
  hasTime: boolean
}

const CHECKPOINTS: readonly CheckpointDef[] = [
  { code: 'STEEL_IN', seq: 1, name: '강재 입고', phase: 'STOCK', basis: 'MAT', weight: 'WEIGHT', unit: 'kg', inScope: true, pendingSource: true, dayOffset: 0, source: '111M', hasTime: false },
  { code: 'PICK1', seq: 2, name: '1차 선별', phase: 'STOCK', basis: 'MAT', weight: 'WEIGHT', unit: 'kg', inScope: true, pendingSource: true, dayOffset: 1, source: 'SSY', hasTime: false },
  { code: 'PICK2', seq: 3, name: '2차 선별', phase: 'STOCK', basis: 'MAT', weight: 'WEIGHT', unit: 'kg', inScope: true, pendingSource: true, dayOffset: 2, source: 'SSY', hasTime: false },
  { code: 'STEEL_ISSUE', seq: 4, name: '강재 불출', phase: 'STOCK', basis: 'MAT', weight: 'WEIGHT', unit: 'kg', inScope: true, pendingSource: false, dayOffset: 3, source: '140M', hasTime: true },
  { code: 'PRETREAT', seq: 5, name: '전처리', phase: 'CUT', basis: 'DWG', weight: 'MH', unit: 'MH', inScope: true, pendingSource: false, dayOffset: 4, source: '140M', hasTime: true },
  { code: 'MARK_DONE', seq: 6, name: '마킹 완료', phase: 'CUT', basis: 'DWG', weight: 'MH', unit: 'MH', inScope: true, pendingSource: false, dayOffset: 5, source: '310M', hasTime: true },
  { code: 'CUT_DONE', seq: 7, name: '절단 완료', phase: 'CUT', basis: 'DWG', weight: 'MH', unit: 'MH', inScope: true, pendingSource: false, dayOffset: 6, source: '310M', hasTime: true },
  { code: 'BEND_DONE', seq: 8, name: '곡가공 완료', phase: 'CUT', basis: 'PART', weight: 'COUNT', unit: '개', inScope: true, pendingSource: false, dayOffset: 7, source: 'PART', hasTime: true },
  { code: 'GROUP', seq: 9, name: '모둠 선별', phase: 'CUT', basis: 'PART', weight: 'COUNT', unit: '개', inScope: true, pendingSource: false, dayOffset: 9, source: 'PART', hasTime: true },
  { code: 'PART_ISSUE', seq: 10, name: '부재 불출', phase: 'CUT', basis: 'PART', weight: 'COUNT', unit: '개', inScope: true, pendingSource: false, dayOffset: 11, source: 'ASSY_WO', hasTime: false },
  { code: 'GRIND', seq: 85, name: '사상', phase: 'CUT', basis: 'PART', weight: 'COUNT', unit: '개', inScope: false, pendingSource: false, dayOffset: 8, source: 'PART', hasTime: true },
]

const CP_BY_CODE = new Map(CHECKPOINTS.map((cp) => [cp.code, cp]))

const SERIES = ['NE', 'NW', 'SE', 'SW', 'CE', 'FW', 'AF', 'DK'] as const

/* ── 한 블록의 사실(도면 · 강판 · 부재 · 절점 시각) ─────────────────────── */

interface MockPart {
  partNo: string
  weightKg: number
  bendFlag: boolean
  grindFlag: boolean
  /** 부재 단위 절점의 날짜 — 그 부재 몫의 지연(0~1일)이 붙는다 */
  dateOf: Partial<Record<FabCheckpointCode, string>>
  timeSeed: number
}

interface MockDrawing {
  drawing: FabDrawing
  /** 강판 장별 중량 — 강재 절점(MAT)의 분모 */
  plateKg: number[]
  parts: MockPart[]
  /** 도면 단위 절점의 실적 날짜 (오늘 이후는 없다) */
  actualOf: Partial<Record<FabCheckpointCode, string>>
  /** 절점별 계획일 (cp_plan) */
  planOf: Record<FabCheckpointCode, string>
}

function timeOf(seed: number): string {
  return `${pad2(6 + (seed % 14))}:${pad2((seed >> 3) % 60)}:${pad2((seed >> 7) % 60)}`
}

function tsOf(date: string, hasTime: boolean, seed: number): string {
  return `${date}T${hasTime ? timeOf(seed) : '00:00:00'}+09:00`
}

function blockDrawings(hullNo: string, blockNo: string): MockDrawing[] {
  const today = todayString()
  const seed = `${hullNo}-${blockNo}`
  const count = 6 + (hashOf(`${seed}-dwg-n`) % 5)
  const drawings: MockDrawing[] = []
  for (let i = 0; i < count; i++) {
    const h = hashOf(`${seed}-dwg-${i}`)
    const series = SERIES[(h >> 2) % SERIES.length]
    const dwgNo = `${hullNo}DS${blockNo}C${series}${pad2(i + 1)}`
    const site: 'IN' | 'OUT' = h % 100 < 15 ? 'OUT' : 'IN'
    const excluded = h % 100 >= 92
    /* 도면 일정 시작일 — 오늘 기준 22일 전 ~ 4일 뒤 */
    const start = shiftDate(today, -22 + (h % 27))
    const actualOf: Partial<Record<FabCheckpointCode, string>> = {}
    const planOf = {} as Record<FabCheckpointCode, string>
    for (const cp of CHECKPOINTS) {
      const jitter = hashOf(`${dwgNo}-${cp.code}-j`) % 2
      const date = shiftDate(start, cp.dayOffset + jitter)
      /* 계획은 실적보다 0~2일 앞선다 — 앞선 만큼 지연이 난다 */
      planOf[cp.code] = shiftDate(start, cp.dayOffset - (hashOf(`${dwgNo}-${cp.code}-p`) % 3))
      /* 사외 도면은 적치 절점이 없다(site_out_skips) */
      if (site === 'OUT' && cp.phase === 'STOCK') continue
      if (date <= today) actualOf[cp.code] = date
    }
    const plateCount = 1 + (hashOf(`${dwgNo}-plates`) % 6)
    const plateKg = Array.from({ length: plateCount }, (_, p) => 3000 + (hashOf(`${dwgNo}-pl-${p}`) % 6000))
    const partCount = 4 + (hashOf(`${dwgNo}-parts`) % 9)
    const parts: MockPart[] = []
    for (let k = 0; k < partCount; k++) {
      const ph = hashOf(`${dwgNo}-part-${k}`)
      const dateOf: Partial<Record<FabCheckpointCode, string>> = {}
      for (const cp of CHECKPOINTS) {
        if (cp.basis !== 'PART') continue
        const base = actualOf[cp.code] ?? shiftDate(start, cp.dayOffset)
        const own = shiftDate(base, (ph >> cp.seq) % 2)
        if (own <= today) dateOf[cp.code] = own
      }
      parts.push({
        partNo: `${hullNo}-${blockNo}-${series}${i + 1}A-C${pad2(k + 1)}`,
        weightKg: round1(30 + (ph % 870) + ((ph >> 4) % 10) / 10),
        bendFlag: ph % 10 < 3,
        grindFlag: ph % 10 < 8,
        dateOf,
        timeSeed: ph,
      })
    }
    const cutDone = actualOf.CUT_DONE ?? null
    const markDone = actualOf.MARK_DONE ?? null
    drawings.push({
      drawing: {
        dwgNo,
        hullNo,
        blockNo,
        dwgSeries: series,
        site,
        cutPlanDate: planOf.CUT_DONE,
        cutCmpPlanDate: null,
        actlSd: markDone,
        actlFd: cutDone,
        targetMh: round2(40 + (h % 18000) / 100),
        targetBasis: 'DWG_WO_MH',
        cutBay: site === 'OUT' ? '9' : String(1 + (h % 4)),
        cnfCutBay: '',
        cutStatus: cutDone ? '2' : markDone ? '1' : '',
        markStatus: markDone ? '2' : actualOf.PRETREAT ? '1' : '',
        dwgStus: '',
        pgmId: 'SP_YPWC_PROC_SQL',
        woCount: 2,
        excluded,
        excludeReason: excluded ? 'TBAR' : null,
        mntTs: cutDone ? tsOf(cutDone, true, h) : null,
        srcJob: 'hot.l_work_unit.dwg',
        polledAt: `${today}T00:00:00+09:00`,
        srcDeletedAt: null,
      },
      plateKg,
      parts,
      actualOf,
      planOf,
    })
  }
  return drawings
}

/** 이 도면 · 부재에서 그 절점이 대상인가 */
function partTargets(cp: CheckpointDef, part: MockPart): boolean {
  if (cp.code === 'BEND_DONE') return part.bendFlag
  if (cp.code === 'GRIND') return part.grindFlag
  return true
}

/**
 * 부재 절점의 **앞 절점** 도달일 — 이번 절점이 '진행'(앞 절점은 지났다)인지 '미도래'인지 가른다.
 * 최종 불출은 그 부재가 모둠선별을 지나야 진행이고, 나머지 부재 절점(곡가공 · 모둠선별 · 사상)은
 * 도면 절단 완료가 앞 절점이다. 도면 절단만 보고 가르면 아직 모둠선별 전인 부재까지 '진행' 으로 셌다.
 */
function partPrevDate(cp: CheckpointDef, part: MockPart, d: MockDrawing): string | undefined {
  if (cp.code === 'PART_ISSUE') return part.dateOf.GROUP
  return d.actualOf.CUT_DONE
}

/** 도면 1장의 한 절점 집계 — p_progress.cp_stats[code] 모양 (명세 C2 예시, 결정 5) */
export interface MockCpStat {
  target: number
  done: number
  inProgress: number
  notDue: number
  excluded: number
  targetQty: number
  doneQty: number
}

/** 부재 하나의 한 절점 상태 — 대상이 아니면(곡가공 · 사상 대상 아님) null */
export function partCpStatus(
  cp: CheckpointDef,
  part: MockPart,
  d: MockDrawing,
  asOf: string
): 'done' | 'inProgress' | 'notDue' | 'excluded' | null {
  if (!partTargets(cp, part)) return null
  if (d.drawing.excluded) return 'excluded'
  const reached = (date: string | undefined) => date !== undefined && date <= asOf
  if (reached(part.dateOf[cp.code])) return 'done'
  return reached(partPrevDate(cp, part, d)) ? 'inProgress' : 'notDue'
}

/** 도면 1장의 한 절점 집계. C2(블록 합) · C3(도면 행)가 같은 값을 쓴다 */
function drawingCpStat(cp: CheckpointDef, d: MockDrawing, asOf: string): MockCpStat {
  const stat: MockCpStat = { target: 0, done: 0, inProgress: 0, notDue: 0, excluded: 0, targetQty: 0, doneQty: 0 }
  const reached = (date: string | undefined) => date !== undefined && date <= asOf
  const skipped = d.drawing.excluded || (d.drawing.site === 'OUT' && cp.phase === 'STOCK')
  if (cp.basis === 'PART') {
    for (const part of d.parts) {
      const status = partCpStatus(cp, part, d, asOf)
      if (status === null) continue
      if (status === 'excluded' || skipped) {
        stat.excluded++
        continue
      }
      stat.target++
      stat.targetQty++
      if (status === 'done') {
        stat.done++
        stat.doneQty++
      } else stat[status]++
    }
    return stat
  }
  /* 앞 절점까지 왔는가 — 이번 절점이 '진행 중' 인지 '미도래' 인지 가른다 */
  const prev = CHECKPOINTS.filter((c) => c.inScope && c.seq < cp.seq && c.basis !== 'PART').at(-1)
  const prevReached = !prev || reached(d.actualOf[prev.code]) || (d.drawing.site === 'OUT' && prev.phase === 'STOCK')
  const units = cp.basis === 'MAT' ? d.plateKg.length : 1
  if (skipped) {
    stat.excluded = units
    return stat
  }
  const qty = cp.basis === 'MAT' ? d.plateKg.reduce((a, b) => a + b, 0) : d.drawing.targetMh
  stat.target = units
  stat.targetQty = qty
  if (reached(d.actualOf[cp.code])) {
    stat.done = units
    stat.doneQty = qty
  } else if (prevReached) stat.inProgress = units
  else stat.notDue = units
  return stat
}

/**
 * 도면 1장의 가공 W/O(B3) — 마킹(CM) 30% · 절단(CT) 70% 로 도면 시수를 나눈다.
 * `accRate` 는 레거시(411M) **정산** 진도율이다 — 판별과 따로 움직인다: 실적이 나도 정산이 늦게 따라오는
 * W/O(5장 중 1장꼴)가 있고, 착수만 한 W/O 는 정산이 30~79% 사이에 걸려 있다.
 */
function drawingWorkOrders(d: MockDrawing, asOf: string): FabWorkOrder[] {
  const { drawing } = d
  const reached = (date: string | undefined) => date !== undefined && date <= asOf
  const steps: { stepCode: 'CM' | 'CT'; share: number; done: string | undefined; started: string | undefined }[] = [
    { stepCode: 'CM', share: 0.3, done: d.actualOf.MARK_DONE, started: d.actualOf.PRETREAT },
    { stepCode: 'CT', share: 0.7, done: d.actualOf.CUT_DONE, started: d.actualOf.MARK_DONE },
  ]
  return steps.map(({ stepCode, share, done, started }) => {
    const woNo = `${drawing.hullNo}C${drawing.blockNo}C${drawing.dwgSeries}${drawing.dwgNo.slice(-2)}${stepCode}`
    const h = hashOf(`${woNo}-acc`)
    const accRate = reached(done)
      ? h % 5 === 0
        ? 60 + (h % 31)
        : 100
      : reached(started)
        ? 30 + (h % 50)
        : 0
    const actl = reached(done) ? done! : null
    return {
      woNo,
      dwgNo: drawing.dwgNo,
      actNo: `C${drawing.blockNo}${stepCode}`,
      stepCode,
      hullNo: drawing.hullNo,
      blockNo: drawing.blockNo,
      mp: 'C',
      locationId: drawing.site === 'OUT' ? 'OUT' : 'CTS',
      site: drawing.site,
      planMh: round2(drawing.targetMh * share),
      accRate,
      planSd: drawing.cutPlanDate,
      planFd: drawing.cutPlanDate,
      actlSd: actl,
      actlFd: actl,
      autoDist: false,
      excluded: drawing.excluded,
      excludeReason: drawing.excludeReason,
      mntTs: drawing.mntTs,
      srcJob: 'hot.l_work_unit.wo',
      polledAt: drawing.polledAt,
      srcDeletedAt: null,
    }
  })
}

/** B3 GET /fab/work-orders — 블록의 가공 W/O. 정산 진도율은 기준일 시점 값 */
export function mockFabWorkOrders(params: { hullNo: string; blockNo: string; asOf?: string }): FabPage<FabWorkOrder> {
  const asOf = params.asOf ?? todayString()
  const items = blockDrawings(params.hullNo, params.blockNo).flatMap((d) => drawingWorkOrders(d, asOf))
  return { items, page: { number: 0, size: items.length, totalElements: items.length, totalPages: 1 } }
}

/* ── C2 블록 절점별 실적 ─────────────────────────────────────── */

export function mockBlockCheckpoints(
  hullNo: string,
  blockNo: string,
  params: { asOf?: string; includeHeld?: boolean } = {}
): FabBlockCheckpoints {
  const asOf = params.asOf ?? todayString()
  const drawings = blockDrawings(hullNo, blockNo)
  const reached = (date: string | undefined) => date !== undefined && date <= asOf
  const checkpoints: FabCheckpointStat[] = []
  for (const cp of CHECKPOINTS) {
    if (!cp.inScope && !params.includeHeld) continue
    let targetCnt = 0
    let doneCnt = 0
    let inProgressCnt = 0
    let notDueCnt = 0
    let excludedCnt = 0
    let targetQty = 0
    let doneQty = 0
    let planDate: string | null = null
    for (const d of drawings) {
      const st = drawingCpStat(cp, d, asOf)
      targetCnt += st.target
      doneCnt += st.done
      inProgressCnt += st.inProgress
      notDueCnt += st.notDue
      excludedCnt += st.excluded
      targetQty += st.targetQty
      doneQty += st.doneQty
      if (st.target > 0 && (planDate === null || d.planOf[cp.code] > planDate)) planDate = d.planOf[cp.code]
    }
    const passed = targetCnt > 0 && doneCnt === targetCnt
    checkpoints.push({
      code: cp.code,
      seq: cp.seq,
      name: cp.name,
      phase: cp.phase,
      basis: cp.basis,
      weight: cp.weight,
      unit: cp.unit,
      inScope: cp.inScope,
      targetCnt,
      doneCnt,
      inProgressCnt,
      notDueCnt,
      excludedCnt,
      targetQty: round2(targetQty),
      doneQty: round2(doneQty),
      doneRate: targetQty === 0 ? null : round1((doneQty / targetQty) * 100),
      countRate: targetCnt === 0 ? null : round1((doneCnt / targetCnt) * 100),
      planDate,
      passed,
      inProgress: !passed && doneCnt + inProgressCnt > 0,
      delayed: !passed && planDate !== null && planDate <= asOf,
      pendingSource: cp.pendingSource,
      steelLayers:
        cp.code === 'STEEL_IN'
          ? { secured: doneCnt, shortage: hashOf(`${hullNo}-${blockNo}-short`) % 2, overdue: notDueCnt > 0 ? 1 : 0, arrived: null }
          : undefined,
    })
  }

  /* 판별 실적% — TRADE_RULE C: 완료(CUT_DONE) 도면 시수 ÷ 대상 도면 시수 */
  const targets = drawings.filter((d) => !d.drawing.excluded)
  const totalMh = targets.reduce((sum, d) => sum + d.drawing.targetMh, 0)
  const doneMh = targets.filter((d) => reached(d.actualOf.CUT_DONE)).reduce((sum, d) => sum + d.drawing.targetMh, 0)
  const autoPct = totalMh === 0 ? null : round1((doneMh / totalMh) * 100)
  /* 레거시 정산% — 411M 정산 진도율 롤업: 대상 W/O 의 시수 가중 평균 */
  const wos = targets.flatMap((d) => drawingWorkOrders(d, asOf))
  const woMh = wos.reduce((sum, w) => sum + w.planMh, 0)
  const legacyPct = woMh === 0 ? null : round1(wos.reduce((sum, w) => sum + w.planMh * w.accRate, 0) / woMh)
  const inScope = checkpoints.filter((c) => c.inScope)
  return {
    hullNo,
    blockNo,
    asOfUsed: asOf,
    overall: {
      autoPct,
      legacyPct,
      planPct: round1((inScope.filter((c) => c.planDate !== null && c.planDate <= asOf).length / inScope.length) * 100),
      basis: 'DWG_MH',
      doneCp: 'CUT_DONE',
    },
    checkpoints,
  }
}

/* ── B4 절점 사건 ───────────────────────────────────────────── */

function drawingEvents(d: MockDrawing): FabEvent[] {
  const { drawing } = d
  const trace = { mntTs: drawing.mntTs, srcJob: 'hot.l_event', polledAt: drawing.polledAt }
  const base = { dwgNo: drawing.dwgNo, hullNo: drawing.hullNo, blockNo: drawing.blockNo, eventGroup: 'CHECKPOINT' as const }
  const flaggedOf = (code: string) => hashOf(`${drawing.dwgNo}-${code}-flag`) % 11 === 0
  const events: FabEvent[] = []
  for (const cp of CHECKPOINTS) {
    if (cp.basis === 'PART') {
      for (const part of d.parts) {
        const date = part.dateOf[cp.code]
        if (!date || !partTargets(cp, part)) continue
        const source = cp.code === 'PART_ISSUE' ? (part.timeSeed % 3 === 0 ? '100M' : 'ASSY_WO') : 'PART'
        const eventTs = tsOf(date, cp.hasTime, part.timeSeed + cp.seq)
        events.push({
          ...base,
          eventId: `${part.partNo}|${cp.code}|${source}|${eventTs}`,
          origin: 'L_CUT_PART',
          unitType: 'PART',
          unitId: part.partNo,
          eventCode: cp.code,
          eventName: cp.name,
          seq: cp.seq,
          basis: 'PART',
          source,
          eventTs,
          hasTime: cp.hasTime,
          conf: null,
          srcValue: null,
          flagged: false,
          ...trace,
          srcJob: 'hot.l_cut_part',
        })
      }
      continue
    }
    const date = d.actualOf[cp.code]
    if (!date) continue
    const seed = hashOf(`${drawing.dwgNo}-${cp.code}-ts`)
    /* 같은 절점이 원천 둘로 오면 합치지 않고 두 줄로 준다 (CUT_DONE = 310M · WO_CT) */
    const sources: { source: string; hasTime: boolean; srcValue: string | null }[] =
      cp.code === 'CUT_DONE'
        ? [
            { source: '310M', hasTime: true, srcValue: drawing.pgmId },
            { source: 'WO_CT', hasTime: false, srcValue: `${drawing.hullNo}C${drawing.blockNo}C${drawing.dwgSeries}${drawing.dwgNo.slice(-2)}CT` },
          ]
        : [{ source: cp.source, hasTime: cp.hasTime, srcValue: cp.basis === 'MAT' ? String(d.plateKg.length) : null }]
    for (const s of sources) {
      const eventTs = tsOf(date, s.hasTime, seed)
      events.push({
        ...base,
        eventId: `${drawing.dwgNo}|${cp.code}|${s.source}|${eventTs}`,
        origin: 'L_EVENT',
        unitType: 'DWG',
        unitId: drawing.dwgNo,
        eventCode: cp.code,
        eventName: cp.name,
        seq: cp.seq,
        basis: cp.basis,
        source: s.source,
        eventTs,
        hasTime: s.hasTime,
        conf: s.hasTime ? 'HIGH' : 'MID',
        srcValue: s.srcValue,
        flagged: flaggedOf(cp.code),
        ...trace,
        srcJob: `hot.l_event.${s.source.toLowerCase()}`,
      })
    }
  }
  return events
}

export function mockFabEvents(params: {
  hullNo: string
  blockNo?: string[]
  dwgNo?: string
  from: string
  to: string
  eventCode?: string[]
}): FabPage<FabEvent> {
  const blocks = params.blockNo ?? []
  const items = blocks
    .flatMap((blockNo) => blockDrawings(params.hullNo, blockNo))
    .filter((d) => !d.drawing.excluded && (!params.dwgNo || d.drawing.dwgNo === params.dwgNo))
    .flatMap(drawingEvents)
    .filter((e) => {
      const date = e.eventTs.slice(0, 10)
      return date >= params.from && date <= params.to && (!params.eventCode || params.eventCode.includes(e.eventCode))
    })
    .sort((a, b) => b.eventTs.localeCompare(a.eventTs) || a.eventId.localeCompare(b.eventId))
  return { items, page: { number: 0, size: items.length, totalElements: items.length, totalPages: 1 } }
}

/* ── B2 도면 하나 · B5 부재 목록 ───────────────────────────────── */

/** 도면번호 1~4자 = 호선, 7~9자 = 블록 (명세 B1) */
function drawingOf(dwgNo: string): MockDrawing | null {
  const hullNo = dwgNo.slice(0, 4)
  const blockNo = dwgNo.slice(6, 9)
  return blockDrawings(hullNo, blockNo).find((d) => d.drawing.dwgNo === dwgNo) ?? null
}

function cutPartOf(d: MockDrawing, part: MockPart): FabCutPart {
  const ts = (code: FabCheckpointCode) => {
    const date = part.dateOf[code]
    const cp = CP_BY_CODE.get(code)!
    return date && partTargets(cp, part) ? tsOf(date, cp.hasTime, part.timeSeed + cp.seq) : null
  }
  const cutDone = d.actualOf.CUT_DONE
  return {
    partNo: part.partNo,
    hullNo: d.drawing.hullNo,
    blockNo: d.drawing.blockNo,
    dwgNo: d.drawing.dwgNo,
    destWstg: `${d.drawing.blockNo}-${(part.timeSeed % 3) + 1}`,
    cutSite: d.drawing.site,
    weightKg: part.weightKg,
    cutReqQty: 1 + (part.timeSeed % 2),
    bendFlag: part.bendFlag,
    grindFlag: part.grindFlag,
    /* 060M 이 비면 도면 CUT_DONE 을 상속한다 */
    cutDoneTs: cutDone ? tsOf(cutDone, true, hashOf(`${d.drawing.dwgNo}-CUT_DONE-ts`)) : null,
    bendDoneTs: ts('BEND_DONE'),
    groupTs: ts('GROUP'),
    sortTs: null,
    issueTs: ts('PART_ISSUE'),
    inboundTs: null,
    grindDoneTs: ts('GRIND'),
    issueSrc: part.dateOf.PART_ISSUE ? (part.timeSeed % 3 === 0 ? '100M' : 'ASSY_WO') : null,
    mntTs: d.drawing.mntTs,
    srcJob: 'hot.l_cut_part',
    polledAt: d.drawing.polledAt,
    srcDeletedAt: null,
  }
}

export function mockFabDrawing(dwgNo: string): FabDrawingDetail | null {
  const d = drawingOf(dwgNo)
  if (!d) return null
  const { drawing } = d
  const cutParts = d.parts.map((p) => cutPartOf(d, p))
  return {
    drawing,
    workOrders: drawingWorkOrders(d, todayString()),
    events: drawingEvents(d)
      .filter((e) => e.origin === 'L_EVENT')
      .sort((a, b) => a.eventTs.localeCompare(b.eventTs)),
    parts: {
      total: cutParts.length,
      weightKg: round1(cutParts.reduce((sum, p) => sum + (p.weightKg ?? 0), 0)),
      bendTarget: cutParts.filter((p) => p.bendFlag).length,
      bendDone: cutParts.filter((p) => p.bendDoneTs).length,
      grouped: cutParts.filter((p) => p.groupTs).length,
      issued: cutParts.filter((p) => p.issueTs).length,
      inbound: cutParts.filter((p) => p.inboundTs).length,
      grindDone: cutParts.filter((p) => p.grindDoneTs).length,
    },
  }
}

export function mockFabParts(params: { hullNo: string; blockNo?: string[]; dwgNo?: string }): FabPage<FabCutPart> {
  const blocks = params.dwgNo ? [params.dwgNo.slice(6, 9)] : (params.blockNo ?? [])
  const items = blocks
    .flatMap((blockNo) => blockDrawings(params.hullNo, blockNo))
    .filter((d) => !params.dwgNo || d.drawing.dwgNo === params.dwgNo)
    .flatMap((d) => d.parts.map((p) => cutPartOf(d, p)))
  return { items, page: { number: 0, size: items.length, totalElements: items.length, totalPages: 1 } }
}

/* ── C3 · C4 도면 판정 (+ cp_stats · cp_plan · cpHistory) ─────────────── */

/**
 * 블록의 도면 판정 전부를 C4 모양으로 — 실서버는 C3 목록 + 도면마다 C4 를 부른다.
 * 절점 세부 화면(도면 단위 절점 S1~S7)이 읽는다.
 */
export function mockFabAnchors(hullNo: string, blockNo: string, asOf: string = todayString()): FabAnchorDetail[] {
  const reached = (date: string | undefined) => date !== undefined && date <= asOf
  return blockDrawings(hullNo, blockNo).map((d) => {
    const { drawing } = d
    const cpStats: FabAnchorDetail['cpStats'] = {}
    const cpPlan: Record<string, string> = {}
    const cpHistory: FabAnchorDetail['cpHistory'] = []
    let lastCp: string | null = null
    let lateCpCnt = 0
    for (const cp of CHECKPOINTS) {
      const st = drawingCpStat(cp, d, asOf)
      cpStats[cp.code] = {
        ...st,
        targetQty: round2(st.targetQty),
        doneQty: round2(st.doneQty),
        ...(cp.code === 'STEEL_IN' && {
          layers: { secured: st.done, shortage: 0, overdue: st.notDue > 0 && d.planOf.STEEL_IN <= asOf ? st.notDue : 0, arrived: null },
        }),
      }
      cpPlan[cp.code] = d.planOf[cp.code]
      const date = d.actualOf[cp.code]
      if (cp.basis !== 'PART' && reached(date)) {
        cpHistory.push({ cp: cp.code, ts: tsOf(date!, cp.hasTime, hashOf(`${drawing.dwgNo}-${cp.code}-ts`)), source: cp.source })
        if (cp.inScope) lastCp = cp.code
      }
      if (st.target > 0 && st.done < st.target && d.planOf[cp.code] <= asOf) lateCpCnt++
    }
    const cut = reached(d.actualOf.CUT_DONE)
    const state: FabAnchorDetail['state'] = cut ? 'done' : cpHistory.length > 0 ? 'inProgress' : 'notDue'
    const autoPct = cut ? 100 : 0
    return {
      anchorId: drawing.dwgNo,
      anchorType: 'DWG',
      hullNo,
      blockNo,
      asOf,
      state,
      autoPct,
      legacyPct: autoPct,
      gapPct: 0,
      gapAlert: false,
      plannedQty: drawing.targetMh,
      doneQty: cut ? drawing.targetMh : 0,
      weightMh: drawing.targetMh,
      lastCp,
      lateCpCnt,
      site: drawing.site,
      excluded: drawing.excluded,
      excludeReason: drawing.excludeReason,
      locationId: drawing.site === 'OUT' ? 'OUT' : 'CTS',
      firstDetectTs: cpHistory[0]?.ts ?? null,
      lastDetectTs: cpHistory.at(-1)?.ts ?? null,
      matchState: null,
      matchWoNo: null,
      confirmedBy: null,
      judgedAt: `${asOf}T23:50:00+09:00`,
      cpStats,
      cpPlan,
      cpHistory,
      evidence: {},
      events: drawingEvents(d).filter((e) => e.origin === 'L_EVENT' && e.eventTs.slice(0, 10) <= asOf),
      actions: [],
      history: [],
    }
  })
}
