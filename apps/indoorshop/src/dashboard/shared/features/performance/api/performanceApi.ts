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
  type AssyMatch,
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
  type PaintingProgressRow,
  type PaintingStepPlan,
  type PaintingSummary,
  type PntEventKind,
  type ProcessFilter,
  type StageStatus,
  type Vessel,
} from '../model/types'
import {
  PAINTING_FACTORIES,
  blockOptionsOfVessel,
  findBlock,
  listVessels,
} from '../../../entities/vessel'
import { PAINTING_STEP_MAPPING } from './paintingStepMapping'
import { generateDailyProgress, latestBatchDate, latestProgressOf } from './dailyProgress'
import {
  aggregateStages,
  buildPaintingSteps,
  countPaintingConfirmed,
  countPaintingDone,
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

/**
 * 호선·블록은 **여기서 만들지 않는다** — 대시보드·조립·의장과 같은 로스터
 * (`shared/entities/vessel`)를 읽는다. 화면마다 제 호선 목록을 두던 시절에는 통합실적의
 * 블록이 다른 화면 어디에도 없어서, 화면을 옮기면 조회 조건을 처음부터 다시 골라야 했다.
 * 공장 라벨도 로스터가 지도 공장명 체계로 들고 있으므로 `?factory=`·`?shop=` 딥링크에
 * 그대로 실린다.
 */
export async function fetchVessels(): Promise<Vessel[]> {
  return listVessels()
}

export async function fetchBlocks(projNo: string): Promise<BlockOption[]> {
  return blockOptionsOfVessel(projNo)
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
/**
 * 매칭 캐스케이드 (ASM-F04) — **판별된 실적에 레거시 W/O 를 찾아 붙인다.**
 *
 * ① 하루치 확정 풀(YPWG411M) → ② 4주치 계획 풀(YPWS210V, 송선 5규칙 변환) → ③ 불일치 노티.
 * 분포는 결정론 해시로 고정한다 — 화면이 셋을 다 보여 줘야 하므로 셋이 다 나와야 한다.
 *
 * W/O 상태는 **판별 결과에서 파생**한다(반대가 아니다): 인식이 끝난 ASSY 의 W/O 는 완료로,
 * 부분 인식이면 앞의 것만 완료·다음 것이 진행중으로 붙는다. 폴백은 하루치 확정에 없던
 * 계획이라, 인식이 이미 끝났으면 **선행**(계획보다 먼저 만들어짐), 아직이면 **지연**이다
 * (ASM-F09). 불일치는 붙일 W/O 자체가 없다 — 그래서 빈 배열이고 완료가 금지된다(ASM-F10).
 */
function matchWorkOrders(input: {
  assyNo: string
  recognizedQty: number
  reqQty: number
  baseDate: string
  allowUnmatched: boolean
}): AssyMatch {
  const { assyNo, recognizedQty, reqQty, baseDate, allowUnmatched } = input
  const complete = reqQty > 0 && recognizedQty >= reqQty

  /* 인식이 아직 없으면 붙일 실적이 없다 — 캐스케이드를 돌리지 않고 계획 W/O 만 세워 둔다 */
  const roll = hashOf(`${assyNo}-match`) % 100
  const state: AssyMatch['state'] =
    recognizedQty > 0 && allowUnmatched && roll < 8
      ? 'unmatched' // 8% — 인식 O / 레거시 X
      : roll < 26
        ? 'fallback' // 18% — 하루치에 없어 4주 계획으로 확대해 찾음
        : 'matched'

  if (state === 'unmatched') {
    return { state, wos: [], flag: null, poolLabel: 'YPWG411M / YPWS210V' }
  }

  const woCount = 2 + (hashOf(`${assyNo}-won`) % 2) // 취부·용접(+사상)
  /* 완료된 W/O 수 — 인식 진척을 그대로 옮긴다(판별이 원천, W/O 는 그 표현) */
  const doneWos = complete
    ? woCount
    : recognizedQty > 0
      ? Math.min(woCount - 1, Math.floor((recognizedQty / Math.max(1, reqQty)) * woCount))
      : 0
  const inProgressWo = !complete && recognizedQty > 0 ? doneWos : -1
  const wos: AssyWo[] = Array.from({ length: woCount }, (_, w): AssyWo => {
    const status: AssyWo['status'] =
      w < doneWos ? 'done' : w === inProgressWo ? 'inProgress' : 'notStarted'
    return {
      woNo: `WO-${String(hashOf(`${assyNo}-wo-${w}`) % 90000).padStart(5, '0')}`,
      kind: WO_KIND_ORDER[w % WO_KIND_ORDER.length],
      status,
      actualDate: status === 'done' ? addDays(baseDate, -(hashOf(`${assyNo}-ad-${w}`) % 6)) : null,
    }
  })

  return {
    state,
    wos,
    flag: state === 'fallback' ? (complete ? 'early' : 'late') : null,
    poolLabel: state === 'fallback' ? 'YPWS210V (4주 창)' : 'YPWG411M (하루치)',
  }
}

/**
 * **도장 단계 블록의 생애주기 시간 이동** (W5-9).
 *
 * 도장 n일차 블록이면 조립은 그 전에 끝난 게 생애주기 정합이다. 그런데 더미는 모든
 * 블록의 조립 완료·검사장 이동을 기준일 언저리(-0~2일)에 두어, 도장 재공 블록조차
 * "어제 조립 끝나고 오늘 도장 중" 이 된다. 그러면 도장 이력을 놓을 과거 구간이 없어
 * 일일공정률(YPWG413M, 하루 1회 일괄)이 영영 등록될 수 없다.
 *
 * 그래서 **로스터가 도장 단계로 적은 블록만** 조립 판별일·W/O 실적일·검사장 이동일을
 * 기준일 -7~-10일로 민다. **조립 단계·의장 단계 블록의 날짜는 건드리지 않는다** — 그
 * 블록들은 지금 진행 중인 게 맞고, 화면도 그렇게 읽혀야 한다.
 *
 * 전이 블록(2543-642 — 대조 G01 만 도장으로 넘어감)은 **제외한다.** 그 블록은 조립이
 * 아직 안 끝나 도장 카드가 블록 레벨에서 '반입 전' 이라 이동시켜도 일일공정률이 설 자리가
 * 없고, 대신 지금 조립 중인 나머지 ASSY 의 날짜만 과거로 밀려 조립 카드가 거짓말을 한다.
 *
 * 도장에 **막 넘어온**(`justArrived`) 블록은 예외다 — 반입이 최근이어야 '갓 들어옴'이
 * 되므로 2일만 민다.
 *
 * @returns 0 (이동 없음) 또는 2 (갓 반입) 또는 7~10 (도장 재공)
 */
function paintingLifecycleShiftDays(projNo: string, blockNo: string): number {
  const block = findBlock(projNo, blockNo)
  if (block?.zone !== 'painting') return 0
  if (block.justArrived) return 2
  return 7 + (hashOf(`${projNo}-${blockNo}-life`) % 4)
}

/**
 * **블록의 조립 진척은 그 블록이 지금 서 있는 공정이 정한다** (W6-2, 사용자 지적).
 *
 * 공정 순서는 가공 → 조립 → 의장 → 도장이다. 그런데 더미는 조립 수위를 해시로만 뽑아,
 * 의장 공장에 서 있는 블록이 '조립 0/6' 이거나 조립 중인 블록이 '도장 중' 으로 나왔다.
 * 순서를 아는 로스터가 있으니 그 단계에 맞춰 진척을 정한다:
 *
 *  - 가공 중  → 조립 **착수 전** (인식 0)
 *  - 조립 중  → 진행 중 (수위 랜덤). 아직 **검사장 이동 없음** — 이동했으면 조립이 끝난 것이다
 *  - 의장·도장 중 → 조립 **전량 완료 + 검사장 이동 완료** (그러지 않고는 그 공정에 있을 수 없다)
 */
function assemblyStageOf(
  projNo: string,
  blockNo: string
): { force: 'none' | 'notStarted' | 'complete'; moved: 'yes' | 'no' | 'auto' } {
  const zone = findBlock(projNo, blockNo)?.zone
  if (zone === undefined) return { force: 'none', moved: 'auto' } // 로스터 밖 — 합성 시드
  if (zone === 'fabrication') return { force: 'notStarted', moved: 'no' }
  if (zone === 'outfitting' || zone === 'painting') return { force: 'complete', moved: 'yes' }
  return { force: 'none', moved: 'no' } // 조립 중 — 이동했으면 조립이 끝난 것이다
}

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
  /* 수위는 블록이 서 있는 공정이 먼저 정한다 (공정 순서 정합 — assemblyStageOf) */
  const stage = assemblyStageOf(projNo, blockNo)
  const rawLevel = Math.min(
    count,
    Math.floor((hashOf(`${seed}-asm-lv`) % 100) / (100 / (count + 1)))
  )
  const level = stage.force === 'complete' ? count : stage.force === 'notStarted' ? 0 : rawLevel
  const started = stage.force === 'notStarted' ? false : hashOf(`${seed}-asm-st`) % 4 !== 0

  /* 도장 단계 블록만 조립 시간축을 과거로 민다 — 그 외 블록은 shift 0 이라 종전 그대로다 */
  const lifeShift = paintingLifecycleShiftDays(projNo, blockNo)
  /* 조립 실적(판별일·W/O 실적일)의 기준 — 검사장 이동보다 하루 이상 앞선다 */
  const asmBase = lifeShift > 0 ? addDays(baseDate, -(lifeShift + 1)) : baseDate

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
    /* 계획 분모 — 레거시 기준정보(REQ_QTY). 비율의 분모일 뿐 기준 축이 아니다 */
    const reqQty = 4 + (hashOf(`${assyNo}-req`) % 9)

    /* ── ① 판별(자동수집) — 이 ASSY 의 기준 축. 여기서 먼저 정해진다 ── */
    const r = postRank[i]
    const recognizedQty =
      r < level
        ? reqQty // 수위 앞 — 인식 완료
        : r === level && started
          ? 1 + (hashOf(`${assyNo}-rec`) % Math.max(1, reqQty - 1)) // 수위 자리 — 부분 인식
          : 0 // 뒤 — 아직 인식 없음
    const judgedDate =
      recognizedQty > 0 ? addDays(asmBase, -(hashOf(`${assyNo}-jd`) % 6)) : null

    /* ── ② 매칭 캐스케이드 — 판별된 실적에 레거시 W/O 를 찾아 붙인다 ── */
    const match = matchWorkOrders({
      assyNo,
      recognizedQty,
      reqQty,
      baseDate: asmBase,
      /* 블록이 전량 인식 완료면 불일치를 내지 않는다 — 불일치가 남아 있으면 완료 처리가
         금지돼 블록이 닫히지 않으므로, 닫힌 블록에 미해결 불일치가 있을 수 없다 */
      allowUnmatched: level < count,
    })

    return {
      assyNo,
      strcCode,
      serNo,
      tier: node.tier,
      parentAssyNo: node.parent == null ? null : assyNos[node.parent],
      depth,
      reqQty,
      recognizedQty,
      judgedDate,
      match,
    }
  })

  /* 검사장 이동(BTS 반출 = 조립종료) — 블록 레벨 사실: ASSY 전량 완료 후에만 */
  const allDone = level >= count
  /* 검사장 이동 = 조립 종료. 의장·도장에 서 있으면 이미 이동한 것이고, 조립 중이면
     아직이다 — 어느 쪽이든 ASSY 전량 완료가 선행 조건이다(findAssyViolations 규칙). */
  const moved =
    allDone && (stage.moved === 'yes' || (stage.moved === 'auto' && hashOf(`${seed}-insp`) % 3 !== 1))
  /* 도장 단계면 검사장 이동이 기준일 -7~-10일(갓 반입이면 -2일). 의장에 갓 넘어왔으면
     '어제 이동' 이라야 전이가 전이로 읽힌다. */
  const justArrived = findBlock(projNo, blockNo)?.justArrived === true
  const inspectionDate =
    lifeShift > 0
      ? addDays(baseDate, -lifeShift)
      : justArrived
        ? addDays(baseDate, -1)
        : addDays(baseDate, -(hashOf(`${seed}-insp-d`) % 3))
  return summarizeAssemblyBlock(assys, { moved, date: moved ? inspectionDate : null })
}

export async function fetchAssemblySummary(
  projNo: string,
  blockNo: string,
  baseDate: string
): Promise<AssemblySummary> {
  return generateAssyUnits(projNo, blockNo, baseDate)
}

/* ── 도장 (W3-2 · W5-8) — 스텝이 곧 절점: S/P → T/UP → FINAL (존재 기반) ─────────── */

/**
 * 블록 하나의 도장 스텝 **계획 구성**을 결정론적으로 뽑는다 — 실데이터 20블록의 관측
 * 분포를 그대로 흉내낸다(dataflow §3.3).
 *  - 스프레이 회차: 1~6 가변 (관측 1회 3 · 2회 2 · 3회 4 · 4회 9 · 5회 1 · 6회 1)
 *  - T/UP: `U1` 은 항상, `U2` 는 15/20, RE-S/P(`R0`)는 **이벤트성** — 없는 블록도 만든다
 *  - 계획 행 수: 회차 × 존 × 내외로 흩어져 한 스텝이 수십 행이 된다
 * 계획 행이 0 인 스텝은 계획 자체를 만들지 않는다 — 존재 기반 집계의 입력이다.
 */
function paintingPlanShape(seed: string) {
  /* 관측 분포를 누적 가중으로 옮긴 표 — 20블록 기준 */
  const ROUND_WEIGHTS = [3, 2, 4, 9, 1, 1]
  const pick = hashOf(`${seed}-rounds`) % 20
  let acc = 0
  let rounds = 1
  for (let i = 0; i < ROUND_WEIGHTS.length; i += 1) {
    acc += ROUND_WEIGHTS[i]
    if (pick < acc) {
      rounds = i + 1
      break
    }
  }
  const zones = 1 + (hashOf(`${seed}-zones`) % 6) // 존 수 — 행 분산의 주범
  const sides = hashOf(`${seed}-sides`) % 3 === 0 ? 1 : 2 // 내외(I/O)
  const hasU2 = hashOf(`${seed}-u2`) % 4 !== 0 // 15/20 ≈ 3/4
  const hasR0 = hashOf(`${seed}-r0`) % 8 !== 0 // 이벤트성 — 대부분 있으나 없는 블록도 있다
  return { rounds, zones, sides, hasU2, hasR0 }
}



/**
 * 도장 BTS 귀속 공장 — 로스터가 '도장 중'으로 적어 둔 블록은 그 공장, 아니면 결정론 추첨.
 *
 * 로스터에 적힌 블록은 지도에도 그 공장에 마커가 선다 — 두 화면이 같은 공장을 말해야
 * 한다(같은 블록을 두고 지도는 느태, 카드는 텍사코라 하면 어느 쪽도 못 믿는다).
 */
function rosterPaintingFactory(projNo: string, blockNo: string, seed: string): string {
  const block = findBlock(projNo, blockNo)
  if (block?.zone === 'painting') return block.factory
  return PAINTING_FACTORIES[hashOf(`${seed}-fac`) % PAINTING_FACTORIES.length]
}

/**
 * 블록 1개의 도장 스텝 실적을 결정론적으로 생성한다.
 *
 * 게이트: 조립종료(BTS 검사장 이동) **후에만** 도장이 시작된다 — 조립 mock 의
 * inspectionMoved 를 그대로 물려받아 두 카드가 한 이야기를 한다. 스텝은 진짜 순차
 * 절점이라 수위 모델(L 앞 완료 / L 자리 진행 / 뒤 미도래)이 곧 규칙이다.
 *
 * **존재 기반**(사용자 확정 2026-09-03): 스텝 개수도 스텝의 분모도 블록의 계획이 정한다.
 * 여기서는 계획(`PaintingStepPlan`)까지만 만들고, 상태 판정은 model/aggregate.ts 의
 * `buildPaintingSteps` 가 한다 — 실연동도 같은 함수를 쓰게 하려는 것이다.
 *
 * 필드 대응(SE12 검증 완료 명세 · 스텝 축은 YPWP720M 실데이터 유도):
 *  - 스텝 키: PAINTING_STEP_MAPPING(paintingStepMapping.ts) 경유 — 하드코딩 금지.
 *    스텝 축은 PNT_SEQ 가 아니라 ELMT_ITEM_CODE 다(S/P=S1~S6 · T/UP=U1·U2·R0 · FINAL=Q0)
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

  /*
   * **도장 반입 여부는 로스터 단계가 정한다** (W6-2). 검사장 이동만으로 게이트를 잡으면
   * 의장 공장에 서 있는 블록도 '도장 중' 이 된다 — 의장은 도장 앞 공정이라 아직 반입 전이다.
   * 로스터 밖 블록(합성 시드)만 종전처럼 검사장 이동으로 판단한다.
   */
  const rosterZone = findBlock(projNo, blockNo)?.zone
  const paintedIn = rosterZone === undefined ? assembly.inspectionMoved : rosterZone === 'painting'

  const shape = paintingPlanShape(seed)

  /** 이 블록이 실제로 계획한 요소코드 — 스텝별 가변 구성의 근원 */
  const codesOf = (step: (typeof PAINTING_STEPS)[number]): string[] => {
    const all = PAINTING_STEP_MAPPING[step].elmtItemCodes
    if (step === 'SP') return all.slice(0, shape.rounds) as string[]
    if (step === 'TUP') {
      return all.filter(
        (c) => c === 'U1' || (c === 'U2' && shape.hasU2) || (c === 'R0' && shape.hasR0)
      ) as string[]
    }
    return [...all]
  }

  const woOf = (step: (typeof PAINTING_STEPS)[number]) => {
    /* W/O 채번 seed 에 매핑 키를 태운다 — 매핑이 바뀌면 mock 도 그 키를 따라간다.
       실데이터의 W/O 는 스텝 1:1 이 아니라 한 건이 1~3 스텝을 덮지만(dataflow §3.3),
       더미는 스텝별 1건으로 단순화한다 — 절점 카드가 보여주는 축이 스텝이기 때문이다. */
    const key = PAINTING_STEP_MAPPING[step]
    const seedKey = `${key.pntWorkKind}${key.elmtItemCodes.join('')}`
    return `WO-${String(hashOf(`${seed}-${seedKey}`) % 90000).padStart(5, '0')}`
  }

  /** 계획 행 수 — 회차 × 존 × 내외. 계획은 반입 전에도 이미 서 있다 */
  const plannedRowsOf = (step: (typeof PAINTING_STEPS)[number]) => {
    const codes = codesOf(step)
    if (codes.length === 0) return 0
    return codes.length * shape.zones * shape.sides
  }

  /**
   * 계획 행의 작업면적(`WORK_PLC_AREA`) — 실데이터 분포(0.6~2,768㎡, 중앙값 40.4)를
   * 흉내낸다. 진행률 가중치라 행마다 갈려야 의미가 있다.
   */
  const areaOf = (step: (typeof PAINTING_STEPS)[number], row: number) =>
    Math.round((4 + (hashOf(`${seed}-${step}-area-${row}`) % 1200) / 10) * 10) / 10

  /**
   * 스텝의 진행률 재료를 만든다 — 완료 행 100%, 진행 중 행은 `YPWG413M` 최신
   * `DLY_PRGS_RATE`, 미착수 행 0%. 413M 이력이 없으면 `null` 을 돌려 집계가 행 완료율로
   * 물러서게 한다.
   */
  const progressOf = (
    step: (typeof PAINTING_STEPS)[number],
    planned: number,
    doneRows: number,
    startDate: string | null
  ): { rows: PaintingProgressRow[]; asOf: string | null } | null => {
    if (planned <= 0 || doneRows >= planned) return null // 전량 완료는 정의상 100%
    const stepSeed = `${seed}-${step}-413m`
    /* 진행 중 행 하나가 대표로 413M 에 등록돼 있다고 본다 — 하루 1회 일괄 등록분 */
    const inFlight = doneRows < planned && startDate != null
    const target = inFlight ? 30 + (hashOf(`${stepSeed}-tg`) % 60) : 0
    const daily = inFlight
      ? generateDailyProgress({
          workOrdNo: woOf(step),
          baseDate,
          targetRate: target,
          startDate,
          seed: stepSeed,
        })
      : []
    const latest = latestProgressOf(daily)
    if (latest == null && doneRows === 0) return null // 413M 등록 전 — 재료 없음
    const rows: PaintingProgressRow[] = []
    for (let i = 0; i < planned; i += 1) {
      const area = areaOf(step, i)
      /* 앞쪽 행부터 완료된 것으로 둔다 — 완료 100, 진행 중 한 행만 413M 값, 나머지 0 */
      const pct = i < doneRows ? 100 : i === doneRows && latest != null ? latest.rate : 0
      rows.push({ areaSqm: area, progressPct: pct })
    }
    return { rows, asOf: latest?.asOf ?? null }
  }

  const planOf = (
    step: (typeof PAINTING_STEPS)[number],
    fields: Pick<PaintingStepPlan, 'doneRows' | 'startDate' | 'endDate' | 'confirmed'>
  ): PaintingStepPlan => {
    const planned = plannedRowsOf(step)
    const progress = progressOf(step, planned, fields.doneRows, fields.startDate)
    return {
      step,
      elmtItemCodes: codesOf(step),
      plannedRows: planned,
      woNo: woOf(step),
      ...fields,
      progressRows: progress?.rows,
      progressAsOf: progress?.asOf ?? null,
    }
  }

  const presentSteps = PAINTING_STEPS.filter((step) => plannedRowsOf(step) > 0)

  if (!paintedIn) {
    /* 반입 전 — 계획은 이미 있으나 실적 행이 하나도 없다 (분모만 있고 분자 0) */
    const steps = buildPaintingSteps(
      presentSteps.map((step) =>
        planOf(step, { doneRows: 0, startDate: null, endDate: null, confirmed: false })
      )
    )
    return {
      steps,
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
  /* 수위 — 분모가 존재 기반이라 스텝 **개수**를 따라간다 (3 고정이 아니다).
     로스터가 '도장 재공' 으로 적은 블록은 말 그대로 진행 중이다 — 전 스텝 완료로 두면
     진행 중 스텝이 없어 일일공정률이 설 자리가 없으므로 수위를 한 칸 아래로 묶는다. */
  const rosterBlock = findBlock(projNo, blockNo)
  const inPaintingRoster = rosterBlock?.zone === 'painting'
  /* 도장에 **갓 반입된** 블록은 반입만 찍히고 스텝은 아직이다 — 일일공정률도 없다 */
  const justArrivedPainting = inPaintingRoster && rosterBlock?.justArrived === true
  const rawLevel = hashOf(`${seed}-lv`) % (presentSteps.length + 1)
  const level = justArrivedPainting
    ? 0
    : inPaintingRoster
      ? Math.min(rawLevel, presentSteps.length - 1)
      : rawLevel
  const started = justArrivedPainting ? false : inPaintingRoster || hashOf(`${seed}-st`) % 4 !== 0

  /*
   * 사다리를 **배치 기준일(어제)에서 거꾸로** 깐다 — 이미 '통과'·'진행중'인 스텝에
   * 아직 오지 않은 날짜를 주면 카드가 앞뒤가 안 맞는 말을 하고(기준일 09-03 인데 완료일
   * 09-08), 일일공정률(YPWG413M)도 영영 등록될 수 없다. 반입일보다 앞서지는 않게 막는다.
   */
  const batchDay = latestBatchDate(baseDate)
  const laterOf = (a: string, b: string) => (a >= b ? a : b)
  const earlierOf = (a: string, b: string) => (a <= b ? a : b)
  /** 스텝 i 의 착수일 — 진행 중 스텝(i=level)이 배치 기준일 3일 전, 앞 스텝일수록 과거로.
      3일을 띄우는 이유: 하루 1회 일괄이라 진행 중 W/O 에는 며칠치 일일공정률이 쌓여
      있어야 정상이고, 하루 전 착수로 두면 이력이 1~2일치밖에 안 깔린다. */
  const startOf = (i: number) => laterOf(inDate, addDays(batchDay, -3 - 2 * (level - i)))

  const plans = presentSteps.map((step, i): PaintingStepPlan => {
    const stepSeed = `${seed}-${step}`
    const planned = plannedRowsOf(step)
    if (i < level) {
      /* 전량 완료 — 계획 행을 전부 채워야 스텝 완료다 */
      const startDate = startOf(i)
      const endDate = laterOf(
        startDate,
        earlierOf(batchDay, addDays(startDate, 1 + (hashOf(`${stepSeed}-fd`) % 2)))
      )
      return planOf(step, {
        doneRows: planned,
        startDate,
        endDate,
        confirmed: hashOf(`${stepSeed}-cnfm`) % 4 !== 1, // 일부는 확정(B) 대기
      })
    }
    if (i === level && started && level < presentSteps.length) {
      /* 부분 완료 — 계획 행 일부만 찍혔다. 전량이 아니므로 완료가 아니다 */
      const doneRows = planned > 1 ? 1 + (hashOf(`${stepSeed}-dr`) % (planned - 1)) : 0
      return planOf(step, {
        doneRows,
        startDate: startOf(i),
        endDate: null,
        confirmed: false,
      })
    }
    return planOf(step, { doneRows: 0, startDate: null, endDate: null, confirmed: false })
  })

  const steps = buildPaintingSteps(plans)
  const doneSteps = countPaintingDone(steps)
  const allDone = steps.length > 0 && doneSteps === steps.length
  const shippedOut = allDone && hashOf(`${seed}-out`) % 2 === 0
  return {
    steps,
    doneSteps,
    confirmedSteps: countPaintingConfirmed(steps),
    phase: shippedOut ? 'shippedOut' : 'inShop',
    /* BTS 귀속 공장 — 로스터가 이 블록을 '도장 중'이라 적어 두었으면 **그 공장이 정본**
     * 이다. 여기서 해시로 따로 고르면 지도의 도장 마커와 이 카드가 다른 공장을 말한다. */
    factory: shippedOut ? null : rosterPaintingFactory(projNo, blockNo, seed),
    btsInDate: inDate,
    btsOutDate: shippedOut ? addDays(steps[steps.length - 1].endDate ?? inDate, 1) : null,
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
  const block = findBlock(projNo, blockNo)
  const summary = aggregateStages(generateParts(projNo, blockNo))
  const assembly = await fetchAssemblySummary(projNo, blockNo, baseDate)
  const painting = generatePaintingSteps(projNo, blockNo, baseDate)
  const progress = deriveNodeProgress(summary, planDatesOf(projNo, blockNo, baseDate), baseDate)
  return {
    projNo,
    blockNo,
    factory: block?.factory ?? '—',
    // 헤더 수치 = 조립(블록-ASSY) 집계와 같은 원천 — 두 카드가 같은 수를 말한다.
    // 주지표는 판별(인식/계획)이고 W/O 는 참고로만 따라온다.
    assyCount: assembly.assyTotal,
    assyDone: assembly.assyDone,
    assyJudged: assembly.assyJudged,
    recognizedQty: assembly.recognizedQty,
    reqQtyTotal: assembly.reqQtyTotal,
    judgedRate: assembly.judgedRate,
    unmatchedCount: assembly.match.unmatched,
    woTotal: assembly.woTotal,
    woDone: assembly.woDone,
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
 * 조립 이벤트 행 — **판별(LiDAR 형상·수량 인식)이 원천 행**이고, 매칭된 W/O 착수·완료
 * (작업지시, **일자만**)가 그 위의 참고 행이다. 여기에 BTS 반입·반출(운반 실적,
 * 일자+시각)이 블록 레벨로 붙는다. 단계 셀은 소조/중조/대조가 아니라 단일 'ASM'(조립) —
 * 관리번호가 ASSY_NO(조합식)·W/O 번호로 대상을 말한다. BTS 반출 = 검사장 이동 = **조립종료**라
 * ASSY 전량 완료 블록에서만 나온다. 조립 행은 베이 소속이 있으므로 `mapShop` 을 싣는다.
 */
function asmEventsOf(projNo: string, blockNo: string, baseDate: string): CollectionEvent[] {
  const factory = findBlock(projNo, blockNo)?.factory
  const summary = generateAssyUnits(projNo, blockNo, baseDate)
  /* 도장 단계 블록은 조립 시간축이 과거로 밀려 있다 — 이벤트 행도 같은 축을 써야
     카드('판별 08-21')와 그리드('판별 09-03')가 다른 말을 하지 않는다 */
  const lifeShift = paintingLifecycleShiftDays(projNo, blockNo)
  const eventBase = lifeShift > 0 ? addDays(baseDate, -(lifeShift + 1)) : baseDate
  const rows: CollectionEvent[] = []
  const push = (
    id: string,
    kind: AsmEventKind,
    status: StageStatus,
    mgmtNo: string,
    opts: { hasTime: boolean; mgmtNoType: MgmtNoType; sources: string }
  ) => {
    const seed = `${projNo}-${blockNo}-${id}`
    const occurred = status === 'notDue' ? null : instantOf(`${seed}-oc`, eventBase, opts.hasTime)
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

  const anyStarted = summary.assys.some((a) => a.recognizedQty > 0)
  if (anyStarted) {
    // 공장 반입(BTS) — 조립 착수의 전제. 운반 대상은 블록('호선_블록' — BTS 키 형식)
    push('btsin', 'btsIn', 'done', `${projNo}_${blockNo}`, {
      hasTime: true,
      mgmtNoType: 'ASSY',
      sources: 'BTS',
    })
  }
  for (const assy of summary.assys) {
    /* ① 판별 이벤트 — **우리 수집의 원천 행**. 관리번호는 ASSY_NO 이고 원천은 정반
       LiDAR 다. 인식이 있었던 ASSY 만 선다(수집된 것만 그리드에 오른다). */
    if (assy.recognizedQty > 0) {
      push(`${assy.assyNo}-judge`, 'asmJudged', assy.judged === 'complete' ? 'done' : 'inProgress',
        assy.assyNo, { hasTime: true, mgmtNoType: 'ASSY', sources: 'LiDAR 판별' })
    }
    /* ② 매칭된 W/O — 판별 행에 붙는 **참고 행**이다. 불일치 ASSY 는 붙은 W/O 가 없어
       여기서 아무 행도 나오지 않는다(그 사정은 조립 카드의 노티 배지가 말한다). */
    let doneRows = 0
    for (const wo of assy.match.wos) {
      if (wo.status === 'done' && doneRows < 2) {
        doneRows += 1
        push(`${assy.assyNo}-${wo.woNo}-d`, 'woDone', 'done', wo.woNo, {
          hasTime: false,
          mgmtNoType: 'WO',
          sources: assy.match.state === 'fallback' ? 'W/O (4주 폴백)' : 'W/O',
        })
      } else if (wo.status === 'inProgress') {
        push(`${assy.assyNo}-${wo.woNo}-s`, 'woStart', 'inProgress', wo.woNo, {
          hasTime: false,
          mgmtNoType: 'WO',
          sources: assy.match.state === 'fallback' ? 'W/O (4주 폴백)' : 'W/O',
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
      // 도장 스텝 W/O — YPWP720M(계획)·YPWP710M(일일 실적)·YPWG221M(확정) 계열
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
