/**
 * 통합실적 데이터 접근 파사드 — 이 화면의 **유일한 데이터 seam**.
 *
 * 실연동 시 「통합 실적 조회 Rest Server」(IPD-IF01) 호출로 이 함수 몸통만 교체하며,
 * 호출부(컴포넌트)는 수정하지 않는다. 대시보드는 Hot DB·레거시 원천에 직접 붙지
 * 않는다 (IPD 정의서 §2 — Rest Server 단일 진입점).
 *
 * mock 규칙 (실연동 전):
 *  - 값은 전부 **결정론적 해시**로 생성한다 (레포 관례 — 렌더링마다 흔들리지 않는다).
 *  - 부재 모집단을 절점 모델(FabPart)로 만들고 IPD-S04 상태 규칙 — 선행 단계 완료 후
 *    진행, `미대상` 분모 제외 — 을 생성 단계에서 실제로 지킨다. 화면 계약의 일부다.
 *  - S1·S4·S5 이벤트는 **일자만** 낸다 (L3 판정 — 원천에 시각 없음. 표기 수준의 계약).
 *  - 블록 재공 목록의 범위 규칙(월간계획 4주 창 vs 전체 재공)은 ⚠️ 미확정 — mock 은
 *    호선당 고정 목록으로 대신한다.
 */
import {
  FAB_STAGES,
  type AsmEventKind,
  type AssemblySummary,
  type AssyTier,
  type AssyWo,
  type AssyWoKind,
  type BlockOption,
  type BlockSummary,
  type CollectionEvent,
  type EventDetail,
  type EventInstant,
  type FabPart,
  type FabStageId,
  type MgmtNoType,
  PAINTING_STEPS,
  type PaintingStepState,
  type PaintingSummary,
  type PntEventKind,
  type ProcessFilter,
  type StageStatus,
  type Vessel,
} from '../model/types'
import { PAINTING_STEP_MAPPING } from './paintingStepMapping'
import {
  aggregateStages,
  deriveNodeProgress,
  summarizeAssemblyBlock,
  type AssyRaw,
} from '../model/aggregate'

/** 문자열 기반 결정적 의사난수 (조립 assemblyApi 와 같은 문법) */
function hashOf(text: string): number {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0
  return Math.abs(h)
}

/* ── 호선·블록 목록 ─────────────────────────────────────────── */

const VESSELS: readonly Vessel[] = [
  { projNo: '7004', shipType: 'LNGC' },
  { projNo: '7012', shipType: 'LNGC' },
  { projNo: '8103', shipType: 'VLCC' },
]

/** 공장 라벨은 야드 지도 공장명 체계(ASSY_SHOP ↔ 지도 키)와 동일하게 둔다 — 딥링크 계약 */
const BLOCKS_BY_VESSEL: Record<string, readonly BlockOption[]> = {
  '7004': [
    { blockNo: '222', factory: '조립4공장-OFD1' },
    { blockNo: '310', factory: 'PBS' },
    { blockNo: '415', factory: 'GBS' },
    { blockNo: '521', factory: 'NPS' },
  ],
  '7012': [
    { blockNo: '118', factory: 'PBS' },
    { blockNo: '204', factory: '3DS' },
    { blockNo: '233', factory: 'GBS' },
  ],
  '8103': [
    { blockNo: '105', factory: 'NPS' },
    { blockNo: '141', factory: 'PBS' },
  ],
}

export async function fetchVessels(): Promise<Vessel[]> {
  return [...VESSELS]
}

export async function fetchBlocks(projNo: string): Promise<BlockOption[]> {
  return [...(BLOCKS_BY_VESSEL[projNo] ?? [])]
}

/* ── 부재 모집단 (절점 모델) ────────────────────────────────── */

/**
 * 블록 1개의 부재 모집단을 결정론적으로 생성한다.
 *
 * 부재마다 진행 수위 L(적용 단계 기준 완료 개수)을 두고, 적용 단계 순서로
 * L 앞은 완료 / L 자리는 진행중·미도래 / L 뒤는 미도래로 채운다 — 선행 단계
 * 미완료 부재가 후행 단계에 착수하는 일이 구조적으로 없다(IPD-S04 규칙).
 * `미대상`은 일부 부재의 S4(사상 불요)·S5(직송)에만 발생시킨다.
 */
export function generateParts(projNo: string, blockNo: string): FabPart[] {
  const seed = `${projNo}-${blockNo}`
  const count = 34 + (hashOf(`${seed}-n`) % 27) // 34~60건
  const parts: FabPart[] = []
  for (let i = 0; i < count; i++) {
    const pid = `${blockNo}-P${String(i + 1).padStart(3, '0')}`
    const h = hashOf(`${seed}-${pid}`)
    const weightKg = 280 + (h % 2300)
    const excluded: Partial<Record<FabStageId, boolean>> = {
      S4: h % 11 === 3, // 사상 불요 부재
      S5: h % 13 === 5, // 팔레트 편성 없이 직송
    }
    const applicable = FAB_STAGES.filter((s) => !excluded[s])
    // 앞 단계일수록 완료가 많게 — 수위 분포를 앞으로 기울인다
    const level = Math.min(applicable.length, Math.floor((h % 100) / 14))
    const started = h % 3 !== 0 // 수위 자리 단계의 착수 여부

    const statuses = {} as Record<FabStageId, StageStatus>
    let idx = 0
    for (const stage of FAB_STAGES) {
      if (excluded[stage]) {
        statuses[stage] = 'excluded'
        continue
      }
      statuses[stage] = idx < level ? 'done' : idx === level && started ? 'inProgress' : 'notDue'
      idx += 1
    }
    parts.push({ partNo: pid, weightKg, statuses })
  }
  return parts
}

/* ── 조립 절점 (W/O 귀속) ───────────────────────────────────── */

/**
 * 블록 1개의 조립 절점별 W/O 귀속을 결정론 생성한다.
 *
 * 진행 수위 L(적용 절점 기준 통과 개수)을 두어 L 앞 절점은 전량 완료, L 자리는
 * 부분 완료(진행중), L 뒤는 미도래 — 선행 절점 미통과 상태에서 후행 절점 W/O 가
 * 착수되는 일이 구조적으로 없다. `미대상`은 중조 생략 블록의 A2 에만 발생시킨다
 * (소형 블록이 소조→대조로 직행하는 경우 — 분모 제외 규칙의 조립 표본).
 */
/** 급 → ASSY_STRC_CODE — mock 표현. 실코드 체계는 YDEH050M 확인 후 교체한다 */
const TIER_STRC: Record<AssyTier, string> = { grand: 'G', mid: 'M', sub: 'S' }
/** ASSY 아래 W/O 의 작업 순서 — 취부 → 용접 → 사상 */
const WO_KIND_ORDER: readonly AssyWoKind[] = ['fit', 'weld', 'grind']

/**
 * 블록 1개의 ASSY 목록을 결정론적으로 생성한다 — **계층 트리**(사용자 확정: 대조>
 * 중조>소조는 절점이 아니라 ASSY 계층 관계다. YDEH040M 부모추적의 mock 대응).
 *
 * 트리 골격: 대조 루트 1~2 → 각 루트 아래 중조 1~2 → 나머지는 소조로 중조에 배분.
 * 목록은 **pre-order**(대조 → 그 자식들)로 배열돼 화면이 그대로 계층 순서로 그린다.
 * 진행은 **post-order 수위**로 판정한다 — 하위(소조)부터 완료되고 부모는 자식 전량
 * 완료 후에만 완료되므로, 부모 완료·자식 미완료가 구조적으로 없다.
 *
 * ASSY_NO 는 조합식 `PROJ-BLK-STRC+SER`(급이 STRC 로 드러난다). 인식 카운트
 * (countedQty)는 OT 소관이라 W/O 상태에서 파생만 한다(화면이 'OT 가동 후' 단서).
 */
export function generateAssyUnits(projNo: string, blockNo: string, baseDate: string): AssemblySummary {
  const seed = `${projNo}-${blockNo}`
  /* ASSY 수 — 헤더 카드의 어셈블리 수와 같은 식(같은 해시)이라 두 화면이 같은 수를 말한다 */
  const count = 4 + (hashOf(`${seed}-assy`) % 8)
  const level = Math.min(count, Math.floor((hashOf(`${seed}-asm-lv`) % 100) / (100 / (count + 1))))
  const started = hashOf(`${seed}-asm-st`) % 4 !== 0

  /* ── 트리 골격 (pre-order 로 쌓는다: 루트 → 중조 → 그 소조들 → 다음 중조 …) ── */
  interface Skel {
    tier: AssyTier
    parent: number | null
    children: number[]
  }
  const skel: Skel[] = []
  const addNode = (tier: AssyTier, parent: number | null): number => {
    const idx = skel.length
    skel.push({ tier, parent, children: [] })
    if (parent != null) skel[parent].children.push(idx)
    return idx
  }
  const rootCount = count >= 6 && hashOf(`${seed}-roots`) % 2 === 1 ? 2 : 1
  const baseSize = Math.floor(count / rootCount)
  for (let r = 0; r < rootCount; r++) {
    const size = r === 0 ? count - baseSize * (rootCount - 1) : baseSize
    const rootIdx = addNode('grand', null)
    const rest = size - 1
    if (rest <= 0) continue
    const midCount = Math.min(rest, 1 + (hashOf(`${seed}-mids-${r}`) % 2))
    const subTotal = rest - midCount
    for (let m = 0; m < midCount; m++) {
      const midIdx = addNode('mid', rootIdx)
      const subN = Math.floor(subTotal / midCount) + (m < subTotal % midCount ? 1 : 0)
      for (let s = 0; s < subN; s++) addNode('sub', midIdx)
    }
  }

  /* post-order 완료 순위 — 소조 → 그 중조 → … → 대조 (하위부터 조립되는 순서) */
  const postRank = new Array<number>(skel.length).fill(0)
  let rank = 0
  const post = (i: number) => {
    for (const c of skel[i].children) post(c)
    postRank[i] = rank++
  }
  skel.forEach((node, i) => {
    if (node.parent == null) post(i)
  })

  const assyNos: string[] = []
  const depths: number[] = []
  const assys: AssyRaw[] = skel.map((node, i) => {
    const serNo = String(i + 1).padStart(2, '0')
    const strcCode = TIER_STRC[node.tier]
    const assyNo = `${projNo}-${blockNo}-${strcCode}${serNo}`
    assyNos.push(assyNo)
    const depth = node.parent == null ? 0 : depths[node.parent] + 1
    depths.push(depth)
    const reqQty = 4 + (hashOf(`${assyNo}-req`) % 9)
    const woCount = 2 + (hashOf(`${assyNo}-won`) % 2) // 취부·용접(+사상)
    /* 이 ASSY 의 진행 — post-order 수위 앞은 전량 완료, 수위 자리는 부분, 뒤는 미착수 */
    const r = postRank[i]
    const doneWos = r < level ? woCount : r === level && started ? hashOf(`${assyNo}-d`) % woCount : 0
    const inProgressWo = r === level && started ? doneWos : -1
    const wos: AssyWo[] = Array.from({ length: woCount }, (_, w): AssyWo => {
      const status = w < doneWos ? 'done' : w === inProgressWo ? 'inProgress' : 'notStarted'
      return {
        woNo: `WO-${String(hashOf(`${assyNo}-wo-${w}`) % 90000).padStart(5, '0')}`,
        kind: WO_KIND_ORDER[w % WO_KIND_ORDER.length],
        status,
        actualDate: status === 'done' ? addDays(baseDate, -(hashOf(`${assyNo}-ad-${w}`) % 6)) : null,
      }
    })
    const countedQty =
      doneWos === woCount ? reqQty : doneWos > 0 || inProgressWo >= 0 ? 1 + (hashOf(`${assyNo}-cnt`) % Math.max(1, reqQty - 1)) : 0
    return {
      assyNo,
      strcCode,
      serNo,
      tier: node.tier,
      parentAssyNo: node.parent == null ? null : assyNos[node.parent],
      depth,
      reqQty,
      countedQty,
      wos,
    }
  })

  /* 검사장 이동(BTS 반출 = 조립종료) — 블록 레벨 사실: ASSY 전량 완료 후에만 */
  const allDone = level >= count
  const moved = allDone && hashOf(`${seed}-insp`) % 3 !== 1
  return summarizeAssemblyBlock(assys, {
    moved,
    date: moved ? addDays(baseDate, -(hashOf(`${seed}-insp-d`) % 3)) : null,
  })
}

export async function fetchAssemblySummary(
  projNo: string,
  blockNo: string,
  baseDate: string
): Promise<AssemblySummary> {
  return generateAssyUnits(projNo, blockNo, baseDate)
}

/* ── 도장 (W3-2) — 스텝이 곧 절점: S/P → T/UP → FINAL ─────────── */

/** BTS 귀속 후보 — 야드 도장공장 이름 체계(지도 공장 키와 동일, ?shop= 딥링크 계약) */
const PAINTING_FACTORIES = [
  '1DOCK 도장공장',
  '2DOCK 도장공장',
  '느태 도장공장',
  '텍사코 도장공장',
  'GPS',
] as const

/**
 * 블록 1개의 도장 스텝 실적을 결정론적으로 생성한다.
 *
 * 게이트: 조립종료(BTS 검사장 이동) **후에만** 도장이 시작된다 — 조립 mock 의
 * inspectionMoved 를 그대로 물려받아 두 카드가 한 이야기를 한다. 스텝은 진짜 순차
 * 절점이라 수위 모델(L 앞 완료 / L 자리 진행 / 뒤 미도래)이 곧 규칙이다.
 *
 * 필드 대응(추정 명세 — SE12 검증 전, 화면이 단서를 단다):
 *  - 스텝 키: PAINTING_STEP_MAPPING(잠정, paintingStepMapping.ts) 경유 — 하드코딩 금지
 *  - W/O·착완일: YPWP720M(블록×공종×차수)·SD/FD_ACTL
 *  - 확정: YPWG221M CNFM_INDC='B' 관문 — done 이어도 확정 대기일 수 있다
 *  - 위치: BTS 물류(반입/반출) 기반 — ZONE 대응표에 의존하지 않는다(게이트 결정)
 */
export function generatePaintingSteps(
  projNo: string,
  blockNo: string,
  baseDate: string
): PaintingSummary {
  const seed = `${projNo}-${blockNo}-pnt`
  const assembly = generateAssyUnits(projNo, blockNo, baseDate)

  const woOf = (step: (typeof PAINTING_STEPS)[number]) => {
    /* W/O 채번 seed 에 잠정 매핑 키를 태운다 — 매핑이 바뀌면 mock 도 그 키를 따라간다 */
    const key = PAINTING_STEP_MAPPING[step]
    return `WO-${String(hashOf(`${seed}-${key.pntWorkKind}${key.pntSeq}`) % 90000).padStart(5, '0')}`
  }

  if (!assembly.inspectionMoved) {
    return {
      steps: PAINTING_STEPS.map(
        (step): PaintingStepState => ({
          step,
          status: 'notDue',
          woNo: woOf(step),
          startDate: null,
          endDate: null,
          confirmed: false,
        })
      ),
      doneSteps: 0,
      confirmedSteps: 0,
      phase: 'beforeIn',
      factory: null,
      btsInDate: null,
      btsOutDate: null,
    }
  }

  /* 검사장 이동일 이후의 시간대에 스텝을 배치한다 — 조립 뒤에 도장이 오는 시간 질서 */
  const inDate = addDays(assembly.inspectionDate ?? baseDate, 1)
  const level = hashOf(`${seed}-lv`) % (PAINTING_STEPS.length + 1)
  const started = hashOf(`${seed}-st`) % 4 !== 0

  const steps = PAINTING_STEPS.map((step, i): PaintingStepState => {
    const stepSeed = `${seed}-${step}`
    if (i < level) {
      const startDate = addDays(inDate, i * 2 + (hashOf(`${stepSeed}-sd`) % 2))
      return {
        step,
        status: 'done',
        woNo: woOf(step),
        startDate,
        endDate: addDays(startDate, 1 + (hashOf(`${stepSeed}-fd`) % 2)),
        confirmed: hashOf(`${stepSeed}-cnfm`) % 4 !== 1, // 일부는 확정(B) 대기
      }
    }
    if (i === level && started && level < PAINTING_STEPS.length) {
      return {
        step,
        status: 'inProgress',
        woNo: woOf(step),
        startDate: addDays(inDate, i * 2),
        endDate: null,
        confirmed: false,
      }
    }
    return { step, status: 'notDue', woNo: woOf(step), startDate: null, endDate: null, confirmed: false }
  })

  const doneSteps = steps.filter((s) => s.status === 'done').length
  const allDone = doneSteps === PAINTING_STEPS.length
  const shippedOut = allDone && hashOf(`${seed}-out`) % 2 === 0
  return {
    steps,
    doneSteps,
    confirmedSteps: steps.filter((s) => s.confirmed).length,
    phase: shippedOut ? 'shippedOut' : 'inShop',
    factory: shippedOut ? null : PAINTING_FACTORIES[hashOf(`${seed}-fac`) % PAINTING_FACTORIES.length],
    btsInDate: inDate,
    btsOutDate: shippedOut
      ? addDays(steps[PAINTING_STEPS.length - 1].endDate ?? inDate, 1)
      : null,
  }
}

export async function fetchPaintingSummary(
  projNo: string,
  blockNo: string,
  baseDate: string
): Promise<PaintingSummary> {
  return generatePaintingSteps(projNo, blockNo, baseDate)
}

/* ── 블록 요약(헤더 카드) ───────────────────────────────────── */

const addDays = (base: string, days: number): string => {
  const d = new Date(`${base}T00:00:00`)
  d.setDate(d.getDate() + days)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

/** 절점별 계획일 — 기준일 주변으로 결정론 배치 (S1 과거 ~ S5 미래) */
export function planDatesOf(
  projNo: string,
  blockNo: string,
  baseDate: string
): Record<FabStageId, string> {
  const seed = `${projNo}-${blockNo}`
  const jitter = (stage: FabStageId) => hashOf(`${seed}-plan-${stage}`) % 3
  return {
    S1: addDays(baseDate, -6 + jitter('S1')),
    S2: addDays(baseDate, -3 + jitter('S2')),
    S3: addDays(baseDate, -1 + jitter('S3')),
    S4: addDays(baseDate, 1 + jitter('S4')),
    S5: addDays(baseDate, 4 + jitter('S5')),
  }
}

export async function fetchBlockSummary(
  projNo: string,
  blockNo: string,
  baseDate: string
): Promise<BlockSummary> {
  const seed = `${projNo}-${blockNo}`
  const block = (BLOCKS_BY_VESSEL[projNo] ?? []).find((b) => b.blockNo === blockNo)
  const summary = aggregateStages(generateParts(projNo, blockNo))
  const assembly = await fetchAssemblySummary(projNo, blockNo, baseDate)
  const painting = generatePaintingSteps(projNo, blockNo, baseDate)
  const progress = deriveNodeProgress(summary, planDatesOf(projNo, blockNo, baseDate), baseDate)
  return {
    projNo,
    blockNo,
    factory: block?.factory ?? '—',
    // 헤더 W/O·ASSY 수 = 조립(블록-ASSY) 집계와 같은 원천 — 두 카드가 같은 수를 말한다
    woTotal: assembly.woTotal,
    woDone: assembly.woDone,
    assyCount: assembly.assyTotal,
    assyDone: assembly.assyDone,
    inspectionMoved: assembly.inspectionMoved,
    pntDone: painting.doneSteps,
    pntPhase: painting.phase,
    lastReceivedAt: `0${6 + (hashOf(`${seed}-rx`) % 4)}:${String(hashOf(`${seed}-rxm`) % 60).padStart(2, '0')}`,
    progress,
  }
}

export async function fetchFabricationStages(projNo: string, blockNo: string) {
  return aggregateStages(generateParts(projNo, blockNo))
}

/* ── 수집 이벤트 그리드 (IPD-S01) ───────────────────────────── */

/** 가공 단계 → 관리번호 형식·원천 라벨 (정의서 §6.2·§6.4 표 그대로 — 4형식 한정) */
const STAGE_META: Record<
  FabStageId,
  { mgmtType: 'MAT' | 'DWG' | 'PC' | 'PLT'; sources: string; hasTime: boolean; unit: string }
> = {
  S1: { mgmtType: 'MAT', sources: '③', hasTime: false, unit: '강재(Roll)' },
  S2: { mgmtType: 'MAT', sources: '①', hasTime: true, unit: '강재(Roll)' },
  S3: { mgmtType: 'DWG', sources: '③②', hasTime: true, unit: '도면' },
  S4: { mgmtType: 'PC', sources: '③④', hasTime: false, unit: '부재' },
  S5: { mgmtType: 'PLT', sources: '③④⑤', hasTime: false, unit: '팔레트' },
}

function mgmtNoOf(stage: FabStageId, projNo: string, blockNo: string, i: number): string {
  const n = hashOf(`${projNo}-${blockNo}-mg-${stage}-${i}`)
  switch (STAGE_META[stage].mgmtType) {
    case 'MAT':
      return `${1000 + (n % 900)}-${String(n % 10000).padStart(4, '0')}`
    case 'DWG':
      return `${projNo}-C${String(n % 900).padStart(3, '0')}`
    case 'PC':
      return `${blockNo}-F${String(n % 90).padStart(2, '0')}`
    case 'PLT':
      return `P-${String(n % 9000).padStart(4, '0')}`
  }
}

/** 시각 유무는 STAGE_META.hasTime 계약을 따른다 — S1·S4·S5 는 일자만 */
function instantOf(seed: string, baseDate: string, hasTime: boolean): EventInstant {
  const h = hashOf(seed)
  const date = addDays(baseDate, -(h % 3))
  if (!hasTime) return { date }
  return { date, time: `${String(7 + (h % 11)).padStart(2, '0')}:${String(h % 60).padStart(2, '0')}` }
}

/** 완료(수신)는 발생보다 앞설 수 없다 — 발생 시점을 기준으로 뒤쪽에 놓는다 */
function completedAfter(occurred: EventInstant, seed: string, hasTime: boolean): EventInstant {
  const h = hashOf(seed)
  const date = addDays(occurred.date, h % 2)
  if (!hasTime) return { date }
  const occurredMinutes = occurred.time
    ? Number(occurred.time.slice(0, 2)) * 60 + Number(occurred.time.slice(3))
    : 7 * 60
  const minutes =
    date === occurred.date
      ? Math.min(occurredMinutes + 20 + (h % 300), 23 * 60 + 59)
      : 7 * 60 + (h % 660)
  return {
    date,
    time: `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`,
  }
}

function fabEventsOf(projNo: string, blockNo: string, baseDate: string): CollectionEvent[] {
  const rows: CollectionEvent[] = []
  const parts = generateParts(projNo, blockNo)
  const n = 9 + (hashOf(`${projNo}-${blockNo}-ev`) % 5)
  for (let i = 0; i < n; i++) {
    const stage = FAB_STAGES[hashOf(`${projNo}-${blockNo}-st-${i}`) % FAB_STAGES.length]
    const meta = STAGE_META[stage]
    const part = parts[hashOf(`${projNo}-${blockNo}-pt-${i}`) % parts.length]
    let status = part.statuses[stage]
    if (status === 'excluded') status = 'notDue' // 미대상 부재는 이벤트 행으로 내지 않는다
    const seed = `${projNo}-${blockNo}-${stage}-${i}`
    const occurred = status === 'notDue' ? null : instantOf(`${seed}-oc`, baseDate, meta.hasTime)
    rows.push({
      id: `${blockNo}-${stage}-${i}`,
      blockNo,
      stage,
      mgmtNoType: meta.mgmtType,
      mgmtNo: mgmtNoOf(stage, projNo, blockNo, i),
      occurred,
      completed:
        status === 'done' && occurred ? completedAfter(occurred, `${seed}-cp`, meta.hasTime) : null,
      status,
      sources: meta.sources,
      flagged: status !== 'notDue' && hashOf(`${seed}-flag`) % 17 === 4,
    })
  }
  return rows
}

/**
 * 조립 이벤트 행 — W/O 착수·완료(작업지시 원천, **일자만**) + BTS 반입·반출(운반
 * 실적, 일자+시각). 단계 셀은 소조/중조/대조가 아니라 단일 'ASM'(조립) — 관리번호가
 * ASSY_NO(조합식)·W/O 번호로 대상을 말한다. BTS 반출 = 검사장 이동 = **조립종료**라
 * ASSY 전량 완료 블록에서만 나온다. 조립 행은 베이 소속이 있으므로 `mapShop` 을 싣는다.
 */
function asmEventsOf(projNo: string, blockNo: string, baseDate: string): CollectionEvent[] {
  const factory = (BLOCKS_BY_VESSEL[projNo] ?? []).find((b) => b.blockNo === blockNo)?.factory
  const summary = generateAssyUnits(projNo, blockNo, baseDate)
  const rows: CollectionEvent[] = []
  const push = (
    id: string,
    kind: AsmEventKind,
    status: StageStatus,
    mgmtNo: string,
    opts: { hasTime: boolean; mgmtNoType: MgmtNoType; sources: string }
  ) => {
    const seed = `${projNo}-${blockNo}-${id}`
    const occurred = status === 'notDue' ? null : instantOf(`${seed}-oc`, baseDate, opts.hasTime)
    rows.push({
      id: `${blockNo}-${id}`,
      blockNo,
      stage: 'ASM',
      kind,
      mgmtNoType: opts.mgmtNoType,
      mgmtNo,
      occurred,
      completed:
        status === 'done' && occurred ? completedAfter(occurred, `${seed}-cp`, opts.hasTime) : null,
      status,
      sources: opts.sources,
      flagged: status !== 'notDue' && hashOf(`${seed}-flag`) % 19 === 6,
      mapShop: factory,
    })
  }

  const anyStarted = summary.assys.some((a) => a.woDone > 0 || a.wos.some((w) => w.status === 'inProgress'))
  if (anyStarted) {
    // 공장 반입(BTS) — 조립 착수의 전제. 운반 대상은 블록('호선_블록' — BTS 키 형식)
    push('btsin', 'btsIn', 'done', `${projNo}_${blockNo}`, {
      hasTime: true,
      mgmtNoType: 'ASSY',
      sources: 'BTS',
    })
  }
  for (const assy of summary.assys) {
    /* ASSY 당 최근 완료 W/O 표본 2건 + 진행중 W/O — 수집된 것만 그리드에 선다 */
    let doneRows = 0
    for (const wo of assy.wos) {
      if (wo.status === 'done' && doneRows < 2) {
        doneRows += 1
        push(`${assy.assyNo}-${wo.woNo}-d`, 'woDone', 'done', wo.woNo, {
          hasTime: false,
          mgmtNoType: 'WO',
          sources: 'W/O',
        })
      } else if (wo.status === 'inProgress') {
        push(`${assy.assyNo}-${wo.woNo}-s`, 'woStart', 'inProgress', wo.woNo, {
          hasTime: false,
          mgmtNoType: 'WO',
          sources: 'W/O',
        })
      }
    }
  }
  if (summary.inspectionMoved) {
    // 검사장(G9G9) 이동 = 조립종료 (dataflow 근거 — 블록 레벨 사실)
    push('btsout', 'btsOut', 'done', `${projNo}_${blockNo}`, {
      hasTime: true,
      mgmtNoType: 'ASSY',
      sources: 'BTS',
    })
  }
  return rows
}

/**
 * 도장 이벤트 행 — 스텝 W/O 착수·완료(YPWP710M 일일 실적 계열, **일자만**) + BTS
 * 반입·반출(운반 실적, 일자+시각). 관리번호는 W/O 번호·`호선_블록`(BTS 키). 단계
 * 셀은 'PNT'(도장) 하나 — 스텝 이름은 이벤트 종류·드릴다운이 말한다. 딥링크는
 * 도장 맵(/zones/painting?shop=)으로 나간다 — BTS 귀속 공장.
 */
function pntEventsOf(projNo: string, blockNo: string, baseDate: string): CollectionEvent[] {
  const summary = generatePaintingSteps(projNo, blockNo, baseDate)
  if (summary.phase === 'beforeIn') return [] // 반입 전 — 수집된 것이 없다
  const rows: CollectionEvent[] = []
  const push = (
    id: string,
    kind: AsmEventKind | PntEventKind,
    status: StageStatus,
    mgmtNo: string,
    occurred: EventInstant | null,
    completed: EventInstant | null,
    opts: { mgmtNoType: MgmtNoType; sources: string }
  ) => {
    rows.push({
      id: `${blockNo}-pnt-${id}`,
      blockNo,
      stage: 'PNT',
      kind,
      mgmtNoType: opts.mgmtNoType,
      mgmtNo,
      occurred,
      completed,
      status,
      sources: opts.sources,
      flagged: status !== 'notDue' && hashOf(`${projNo}-${blockNo}-pnt-${id}-flag`) % 23 === 7,
      mapShop: summary.factory ?? undefined,
      mapShopProcess: 'painting',
    })
  }
  const timeOf = (seedKey: string) => {
    const h = hashOf(`${projNo}-${blockNo}-${seedKey}`)
    return `${String(7 + (h % 11)).padStart(2, '0')}:${String(h % 60).padStart(2, '0')}`
  }
  if (summary.btsInDate) {
    /* BTS 이동은 한 시점 — 발생=완료(운반 완료 시각) */
    const at = { date: summary.btsInDate, time: timeOf('btsin-t') }
    push('btsin', 'btsIn', 'done', `${projNo}_${blockNo}`, at, at, {
      mgmtNoType: 'ASSY',
      sources: 'BTS',
    })
  }
  for (const step of summary.steps) {
    if (step.status === 'done' && step.startDate && step.endDate) {
      push(`${step.step}-d`, 'stepDone', 'done', step.woNo,
        { date: step.startDate }, { date: step.endDate },
        { mgmtNoType: 'WO', sources: 'W/O' })
    } else if (step.status === 'inProgress' && step.startDate) {
      push(`${step.step}-s`, 'stepStart', 'inProgress', step.woNo,
        { date: step.startDate }, null,
        { mgmtNoType: 'WO', sources: 'W/O' })
    }
  }
  if (summary.btsOutDate) {
    const at = { date: summary.btsOutDate, time: timeOf('btsout-t') }
    push('btsout', 'btsOut', 'done', `${projNo}_${blockNo}`, at, at, {
      mgmtNoType: 'ASSY',
      sources: 'BTS',
    })
  }
  return rows
}

export async function fetchCollectionEvents(
  projNo: string,
  blockNos: readonly string[],
  filter: ProcessFilter,
  baseDate: string
): Promise<CollectionEvent[]> {
  // 의장 이벤트는 아직 범위 밖 — 해당 필터에서는 빈 목록(화면이 안내한다)
  if (filter === 'outfitting') return []

  const rows: CollectionEvent[] = []
  for (const blockNo of blockNos) {
    if (filter === 'all' || filter === 'fabrication') rows.push(...fabEventsOf(projNo, blockNo, baseDate))
    if (filter === 'all' || filter === 'assembly') rows.push(...asmEventsOf(projNo, blockNo, baseDate))
    if (filter === 'all' || filter === 'painting') rows.push(...pntEventsOf(projNo, blockNo, baseDate))
  }
  // 단계 → 블록 순 정렬 (정의서 §8.2 — 블록·단계 순 정렬의 화면 적용)
  return rows.sort(
    (a, b) => a.blockNo.localeCompare(b.blockNo) || a.stage.localeCompare(b.stage)
  )
}

/* ── 드릴다운 KV (IPD-S02) ─────────────────────────────────── */

/** 원천 화면별 주요 항목 (정의서 §6.2 항목명 그대로 — 임의 명명 금지) */
export async function fetchEventDetail(event: CollectionEvent): Promise<EventDetail> {
  const h = hashOf(`${event.id}-kv`)
  const fmt = (v: EventInstant | null) => (v ? `${v.date}${v.time ? ` ${v.time}` : ''}` : '—')

  // 조립·도장 행 — W/O(작업지시)·BTS(운반) 원천의 항목·값
  if (event.kind) {
    const pnt = event.stage === 'PNT'
    if (event.kind === 'btsIn' || event.kind === 'btsOut') {
      return {
        eventId: event.id,
        unit: '블록(운반)',
        entries: [
          { label: '운반 대상', value: event.mgmtNo },
          {
            label: '구간',
            value: pnt
              ? event.kind === 'btsIn'
                ? '검사장(G9G9) → 도장공장'
                : '도장공장 → 후속 공정'
              : event.kind === 'btsIn'
                ? '적치장 → 조립공장'
                : '조립공장 → 검사장(G9G9)',
          },
          { label: '이동 일시', value: fmt(event.completed ?? event.occurred) },
          { label: '운반 순번', value: String(1 + (h % 40)) },
        ],
      }
    }
    if (event.kind === 'stepDone' || event.kind === 'stepStart') {
      // 도장 스텝 W/O — YPWP720M(계획)·YPWP710M(일일 실적)·YPWG221M(확정) 계열, 추정 명세
      return {
        eventId: event.id,
        unit: '작업지시(W/O · 도장)',
        entries: [
          { label: '작업지시 No', value: event.mgmtNo },
          { label: '상태', value: event.status === 'done' ? '완료(W)' : '진행(S)' },
          { label: '착수일 (SD_ACTL)', value: fmt(event.occurred) },
          { label: '완료일 (FD_ACTL)', value: fmt(event.completed) },
          {
            label: '확정(YPWG221M)',
            value: event.status === 'done' ? (h % 4 !== 1 ? "확정('B')" : '확정 대기') : '—',
          },
        ],
      }
    }
    return {
      eventId: event.id,
      unit: '작업지시(W/O)',
      entries: [
        { label: '작업지시 No', value: event.mgmtNo },
        { label: '상태', value: event.status === 'done' ? '완료(W)' : '진행(S)' },
        { label: '착수일', value: fmt(event.occurred) },
        { label: '완료일', value: fmt(event.completed) },
        { label: '계획 물량', value: String(4 + (h % 20)) },
      ],
    }
  }

  const meta = STAGE_META[event.stage as FabStageId]
  const entriesByStage: Record<FabStageId, { label: string; value: string }[]> = {
    S1: [
      { label: '고유번호', value: `ST-${1000 + (h % 9000)}` },
      { label: '중량(kg)', value: String(800 + (h % 2000)) },
      { label: '강재반입일', value: fmt(event.completed) },
    ],
    S2: [
      { label: '고유번호', value: `ST-${1000 + (h % 9000)}` },
      { label: 'Roll No.', value: `R-${100 + (h % 900)}` },
      { label: '재질', value: h % 2 === 0 ? 'AH36' : 'A' },
      { label: '두께', value: `${8 + (h % 18)}mm` },
      { label: '중량(kg)', value: String(800 + (h % 2000)) },
      { label: '불출일·시각', value: fmt(event.completed) },
    ],
    S3: [
      { label: '도면번호', value: event.mgmtNo },
      { label: '절단장비', value: `NC-${1 + (h % 6)}` },
      { label: '절단완료일시', value: fmt(event.completed) },
      { label: '계획/지시/실적 수량', value: `${20 + (h % 9)} / ${20 + (h % 9)} / ${14 + (h % 9)}` },
    ],
    S4: [
      { label: '부재번호', value: event.mgmtNo },
      { label: '사상완료일', value: fmt(event.completed) },
      { label: '모듬상태', value: event.status === 'done' ? '모듬 완료' : '진행' },
    ],
    S5: [
      { label: '팔레트 번호', value: event.mgmtNo },
      { label: '구성 부재 수', value: String(4 + (h % 14)) },
      { label: '합계 중량(kg)', value: String(3000 + (h % 9000)) },
      { label: '할당 상태', value: event.status === 'done' ? '완료' : '대기' },
    ],
  }
  return { eventId: event.id, unit: meta.unit, entries: entriesByStage[event.stage as FabStageId] }
}
