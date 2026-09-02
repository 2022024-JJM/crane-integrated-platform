import { describe, expect, it } from 'vitest'
import {
  aggregateStage,
  aggregateStages,
  assyTreeOrder,
  deriveNodeProgress,
  findAssyViolations,
  findSequenceViolations,
  summarizeAssemblyBlock,
  type AssyRaw,
} from '../model/aggregate'
import {
  FAB_STAGES,
  PAINTING_STEPS,
  type AssyWo,
  type FabPart,
  type FabStageId,
  type StageStatus,
} from '../model/types'
import {
  fetchAssemblySummary,
  fetchBlockSummary,
  fetchCollectionEvents,
  fetchPaintingSummary,
  generateAssyUnits,
  generatePaintingSteps,
  generateParts,
  planDatesOf,
} from '../api/performanceApi'
import { PAINTING_STEP_MAPPING } from '../api/paintingStepMapping'

const BASE = '2026-09-02'

function part(no: string, weightKg: number, statuses: Partial<Record<FabStageId, StageStatus>>): FabPart {
  const full = {} as Record<FabStageId, StageStatus>
  for (const s of FAB_STAGES) full[s] = statuses[s] ?? 'notDue'
  return { partNo: no, weightKg, statuses: full }
}

/**
 * 절점 모델·집계의 계약 — IPD 정의서 §6.4·§8.5 규칙과 D3(절점 기반 %만)를 지킨다.
 * mock 은 화면 계약의 일부이므로 생성기 자체도 여기서 검증한다.
 */
describe('가공 절점 집계 (IPD-S04 규칙)', () => {
  it('미대상 부재는 건수·중량 분모에서 모두 제외된다', () => {
    const agg = aggregateStage(
      [
        part('a', 100, { S4: 'done' }),
        part('b', 300, { S4: 'excluded' }),
        part('c', 100, { S4: 'notDue' }),
      ],
      'S4'
    )
    expect(agg.targetCount).toBe(2)
    expect(agg.excludedCount).toBe(1)
    expect(agg.targetWeightKg).toBe(200) // 미대상 300kg 이 분모에 없다
    expect(agg.countRate).toBe(50)
    expect(agg.weightRate).toBe(50)
  })

  it('대상이 0이면 실적률은 0으로 처리한다 (§8.5 예외 규칙)', () => {
    const agg = aggregateStage([part('a', 100, { S5: 'excluded' })], 'S5')
    expect(agg.targetCount).toBe(0)
    expect(agg.countRate).toBe(0)
    expect(agg.weightRate).toBe(0)
  })

  it('종합(중량가중)은 5단계 중량 실적률의 평균이다 — 정의서 확정 산식 외 합성 금지', () => {
    const parts = [
      part('a', 100, { S1: 'done', S2: 'done', S3: 'done', S4: 'done', S5: 'done' }),
      part('b', 100, { S1: 'done' }),
    ]
    const summary = aggregateStages(parts)
    // S1 100% + S2~S5 각 50% → (100+50*4)/5 = 60
    expect(summary.overallWeightRate).toBe(60)
  })
})

describe('절점 파생 (D3 — 계획·실적 모두 절점에서만)', () => {
  const summary = aggregateStages([
    part('a', 100, { S1: 'done', S2: 'done', S3: 'inProgress' }),
    part('b', 100, { S1: 'done', S2: 'done' }),
  ])
  const plans = { S1: '2026-08-28', S2: '2026-08-31', S3: '2026-09-01', S4: '2026-09-04', S5: '2026-09-07' }
  const progress = deriveNodeProgress(summary, plans, BASE)

  it('절점 통과 = 대상 부재 전량 완료', () => {
    expect(progress.nodes.map((n) => n.passed)).toEqual([true, true, false, false, false])
  })

  it('지연 = 계획일 도래 후 미통과 절점 (미래 계획일은 지연이 아니다)', () => {
    // S3 계획 09-01(도래·미통과) → 지연 1건. S4·S5 는 미도래
    expect(progress.delayedCount).toBe(1)
    expect(progress.nodes[2].delayed).toBe(true)
    expect(progress.nodes[3].delayed).toBe(false)
  })

  it('계획% = 계획일 도래 절점 비율, 실적% = 종합 중량가중 — 합성 산식 없음', () => {
    expect(progress.planRate).toBe(60) // S1~S3 도래 / 5
    expect(progress.actualRate).toBe(summary.overallWeightRate)
  })
})

describe('mock 생성기 — 결정론·상태 규칙 준수', () => {
  it('같은 입력이면 같은 모집단 (결정론 해시)', () => {
    expect(generateParts('7004', '222')).toEqual(generateParts('7004', '222'))
    expect(planDatesOf('7004', '222', BASE)).toEqual(planDatesOf('7004', '222', BASE))
  })

  it('선행 단계 미완료 부재가 후행 단계에 착수하지 않는다 (IPD-S04 순차 규칙)', () => {
    for (const [proj, block] of [['7004', '222'], ['7004', '310'], ['7012', '118'], ['8103', '105']]) {
      expect(findSequenceViolations(generateParts(proj, block))).toEqual([])
    }
  })

  it('순차 규칙 위반은 검출된다 (검증기 자체의 검증)', () => {
    expect(
      findSequenceViolations([part('bad', 100, { S1: 'notDue', S3: 'done' })])
    ).toEqual(['bad'])
  })
})

describe('수집 이벤트 그리드 계약', () => {
  it('S1·S4·S5 는 일자만, S2·S3 만 시각을 갖는다 (L3 표기 수준 계약)', async () => {
    // 조립 행의 시각 계약은 별도 describe — 여기는 가공 행만 본다
    const rows = await fetchCollectionEvents('7004', ['222', '310'], 'fabrication', BASE)
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      const dateOnly = row.stage === 'S1' || row.stage === 'S4' || row.stage === 'S5'
      for (const instant of [row.occurred, row.completed]) {
        if (!instant) continue
        if (dateOnly) expect(instant.time).toBeUndefined()
        else expect(instant.time).toBeDefined()
      }
    }
  })

  it('관리번호 형식이 단계별 4형식(MAT/DWG/PC/PLT)을 따른다', async () => {
    const rows = await fetchCollectionEvents('7004', ['222'], 'fabrication', BASE)
    const typeByStage = { S1: 'MAT', S2: 'MAT', S3: 'DWG', S4: 'PC', S5: 'PLT' }
    for (const row of rows) expect(row.mgmtNoType).toBe(typeByStage[row.stage as FabStageId])
  })

  it('의장·도장 필터는 빈 목록 (범위 밖 — 준비중 안내는 화면 몫)', async () => {
    expect(await fetchCollectionEvents('7004', ['222'], 'painting', BASE)).toEqual([])
    expect(await fetchCollectionEvents('7004', ['222'], 'outfitting', BASE)).toEqual([])
  })
})

/* ── 조립 — 블록-ASSY 레벨 (W3-1b, 사용자 정정: 소조/중조/대조 절점이 아니다) ── */

const wo = (woNo: string, kind: AssyWo['kind'], status: AssyWo['status']): AssyWo => ({
  woNo,
  kind,
  status,
  actualDate: status === 'done' ? '2026-09-01' : null,
})

const assy = (
  assyNo: string,
  reqQty: number,
  countedQty: number,
  wos: AssyWo[],
  tree: { parent?: string | null; depth?: number } = {}
): AssyRaw => {
  const [, , tail] = assyNo.split('-')
  const strcCode = tail[0]
  const tier = strcCode === 'G' ? 'grand' : strcCode === 'M' ? 'mid' : 'sub'
  return {
    assyNo,
    strcCode,
    serNo: tail.slice(1),
    tier,
    parentAssyNo: tree.parent ?? null,
    depth: tree.depth ?? (tree.parent ? 1 : 0),
    reqQty,
    countedQty,
    wos,
  }
}

describe('블록-ASSY 집계 (ASSY 기준 추적 · W/O 완료 기준)', () => {
  const sample = [
    assy('7004-310-S01', 6, 6, [wo('WO-00001', 'fit', 'done'), wo('WO-00002', 'weld', 'done')]),
    assy('7004-310-M02', 8, 3, [wo('WO-00003', 'fit', 'done'), wo('WO-00004', 'weld', 'inProgress')]),
    assy('7004-310-G03', 5, 0, [wo('WO-00005', 'fit', 'notStarted')]),
  ]

  it('ASSY 완료 = 귀속 W/O 전량 완료 — 종합은 W/O 합계뿐(합성 산식 없음)', () => {
    const summary = summarizeAssemblyBlock(sample, { moved: false, date: null })
    expect(summary.assys.map((u) => u.done)).toEqual([true, false, false])
    expect(summary.assyDone).toBe(1)
    expect(summary.assyTotal).toBe(3)
    expect(summary.woDone).toBe(3)
    expect(summary.woTotal).toBe(5)
    expect(summary.overallRate).toBe(60)
  })

  it('검사장 이동은 블록 레벨 사실 — moved=false 면 날짜도 싣지 않는다', () => {
    const summary = summarizeAssemblyBlock(sample, { moved: false, date: '2026-09-01' })
    expect(summary.inspectionMoved).toBe(false)
    expect(summary.inspectionDate).toBeNull()
  })

  it('정합 검증기 — 카운트>분모·완료-카운트 불일치·완료 전 검사장 이동을 잡는다', () => {
    const bad = summarizeAssemblyBlock(
      [assy('7004-310-S01', 4, 5, [wo('WO-00001', 'fit', 'done')])],
      { moved: true, date: '2026-09-01' }
    )
    const violations = findAssyViolations(bad)
    expect(violations).toContain('7004-310-S01:count>req')
    expect(violations).toContain('7004-310-S01:done-count')
    // ASSY 전량 완료(1/1)라 inspection 위반은 없다
    expect(violations).not.toContain('inspection-before-done')
  })
})

describe('조립 mock 생성기 — 결정론·조합식·파생 규칙', () => {
  const SAMPLES: [string, string][] = [['7004', '222'], ['7004', '310'], ['7004', '415'], ['7012', '118'], ['7012', '204'], ['8103', '105']]

  it('같은 입력이면 같은 ASSY 목록 (결정론 해시)', () => {
    expect(generateAssyUnits('7004', '222', BASE)).toEqual(generateAssyUnits('7004', '222', BASE))
  })

  it('ASSY_NO 는 조합식 PROJ-BLK-STRC+SER 을 지킨다', () => {
    for (const [proj, block] of SAMPLES) {
      const summary = generateAssyUnits(proj, block, BASE)
      for (const u of summary.assys) {
        expect(u.assyNo).toMatch(new RegExp(`^${proj}-${block}-[GMS]\\d{2}$`))
        expect(u.assyNo).toBe(`${proj}-${block}-${u.strcCode}${u.serNo}`)
      }
    }
  })

  it('파생 규칙 위반이 없다 — 카운트≤분모, 완료 ASSY 는 분모 충족, 검사장 이동은 전량 완료 후', () => {
    for (const [proj, block] of SAMPLES) {
      expect(findAssyViolations(generateAssyUnits(proj, block, BASE))).toEqual([])
    }
  })

  it('W/O 없이 완료된 ASSY 가 없다 (done ⇒ 귀속 W/O 존재)', () => {
    for (const [proj, block] of SAMPLES) {
      for (const u of generateAssyUnits(proj, block, BASE).assys) {
        if (u.done) expect(u.woTotal).toBeGreaterThan(0)
      }
    }
  })

  it('계층이 온전하다 — 대조 루트에서 시작하는 트리, 목록은 pre-order(계층 순서)', () => {
    for (const [proj, block] of SAMPLES) {
      const { assys } = generateAssyUnits(proj, block, BASE)
      const byNo = new Map(assys.map((u) => [u.assyNo, u]))
      for (const u of assys) {
        if (u.parentAssyNo == null) {
          expect(u.tier).toBe('grand')
          expect(u.depth).toBe(0)
        } else {
          const parent = byNo.get(u.parentAssyNo)
          expect(parent).toBeDefined()
          expect(u.depth).toBe((parent?.depth ?? 0) + 1)
          /* 급 위계 — 중조의 부모는 대조, 소조의 부모는 중조 */
          expect(parent?.tier).toBe(u.tier === 'mid' ? 'grand' : 'mid')
        }
      }
      /* 생성 목록 자체가 계층 순서(pre-order)다 — 화면은 정렬 없이 그대로 그린다 */
      expect(assyTreeOrder(assys).map((u) => u.assyNo)).toEqual(assys.map((u) => u.assyNo))
    }
  })

  it('부모 완료 전에 자식 미완료가 남지 않는다 — 하위(소조)부터 완료되는 순서', () => {
    for (const [proj, block] of SAMPLES) {
      expect(findAssyViolations(generateAssyUnits(proj, block, BASE))).toEqual([])
    }
  })
})

describe('assyTreeOrder — 계층 정렬 (임의 순서 입력 방어)', () => {
  const g = assy('7004-310-G01', 6, 0, [wo('WO-1', 'fit', 'notStarted')])
  const m = assy('7004-310-M02', 6, 0, [wo('WO-2', 'fit', 'notStarted')], { parent: g.assyNo, depth: 1 })
  const s = assy('7004-310-S03', 6, 0, [wo('WO-3', 'fit', 'notStarted')], { parent: m.assyNo, depth: 2 })
  const toUnits = (raws: AssyRaw[]) => summarizeAssemblyBlock(raws, { moved: false, date: null }).assys

  it('뒤섞인 목록을 대조→중조→소조 pre-order 로 편다', () => {
    const shuffled = toUnits([s, g, m])
    expect(assyTreeOrder(shuffled).map((u) => u.assyNo)).toEqual([g.assyNo, m.assyNo, s.assyNo])
  })

  it('부모가 없는 노드도 목록에서 사라지지 않는다 (루트 취급 — 검증기가 따로 잡는다)', () => {
    const orphanUnits = toUnits([s])
    expect(assyTreeOrder(orphanUnits).map((u) => u.assyNo)).toEqual([s.assyNo])
    expect(findAssyViolations(summarizeAssemblyBlock([s], { moved: false, date: null }))).toContain(
      `${s.assyNo}:orphan`
    )
  })

  it('헤더의 W/O·ASSY 수는 조립 집계와 같다 (카드-헤더 정합 — 한 원천)', async () => {
    const [summary, assembly] = await Promise.all([
      fetchBlockSummary('7004', '222', BASE),
      fetchAssemblySummary('7004', '222', BASE),
    ])
    expect(summary.woTotal).toBe(assembly.woTotal)
    expect(summary.woDone).toBe(assembly.woDone)
    expect(summary.assyCount).toBe(assembly.assyTotal)
    expect(summary.assyDone).toBe(assembly.assyDone)
    expect(summary.inspectionMoved).toBe(assembly.inspectionMoved)
  })
})

describe('조립 이벤트 행 계약', () => {
  it('조립 필터에서 조립 행만, 가공 필터에서 가공 행만 나온다', async () => {
    const asmRows = await fetchCollectionEvents('7004', ['222', '310'], 'assembly', BASE)
    expect(asmRows.length).toBeGreaterThan(0)
    for (const row of asmRows) expect(row.kind).toBeDefined()
    const fabRows = await fetchCollectionEvents('7004', ['222', '310'], 'fabrication', BASE)
    for (const row of fabRows) expect(row.kind).toBeUndefined()
    const pntRows = await fetchCollectionEvents('7004', ['222', '310'], 'painting', BASE)
    const allRows = await fetchCollectionEvents('7004', ['222', '310'], 'all', BASE)
    expect(allRows.length).toBe(asmRows.length + fabRows.length + pntRows.length)
  })

  it('W/O 행은 일자만, BTS 행은 일시 — 관리번호는 WO/ASSY 형식', async () => {
    const rows = await fetchCollectionEvents('7004', ['222', '310', '415', '521'], 'assembly', BASE)
    for (const row of rows) {
      const isBts = row.kind === 'btsIn' || row.kind === 'btsOut'
      expect(row.mgmtNoType).toBe(isBts ? 'ASSY' : 'WO')
      for (const instant of [row.occurred, row.completed]) {
        if (!instant) continue
        if (isBts) expect(instant.time).toBeDefined()
        else expect(instant.time).toBeUndefined()
      }
    }
  })

  it('조립 행의 단계는 전부 ASM — 소조/중조/대조 단계 표기가 없다', async () => {
    const rows = await fetchCollectionEvents('7004', ['222', '310', '415', '521'], 'assembly', BASE)
    for (const row of rows) expect(row.stage).toBe('ASM')
  })

  it('BTS 반출(검사장 이동)은 검사장 이동 블록에만 — 조립종료는 블록 레벨 사실', async () => {
    for (const block of ['222', '310', '415', '521']) {
      const rows = await fetchCollectionEvents('7004', [block], 'assembly', BASE)
      const summary = await fetchAssemblySummary('7004', block, BASE)
      expect(rows.some((r) => r.kind === 'btsOut')).toBe(summary.inspectionMoved)
    }
  })

  it('완료(수신)는 발생(시작)보다 앞서지 않는다 — 전 행 공통', async () => {
    const rows = await fetchCollectionEvents('7004', ['222', '310', '415', '521'], 'all', BASE)
    for (const row of rows) {
      if (!row.occurred || !row.completed) continue
      const key = (v: { date: string; time?: string }) => `${v.date} ${v.time ?? '00:00'}`
      expect(key(row.completed) >= key(row.occurred)).toBe(true)
    }
  })

  it('맵 딥링크 — 조립 행은 조립 공장, 도장 행은 도장 맵으로, 가공 행은 없음', async () => {
    const rows = await fetchCollectionEvents('7004', ['222'], 'all', BASE)
    for (const row of rows) {
      if (row.stage === 'ASM') expect(row.mapShop).toBe('조립4공장-OFD1')
      else if (row.stage === 'PNT') {
        expect(row.mapShopProcess).toBe('painting')
      } else {
        expect(row.mapShop).toBeUndefined()
      }
    }
  })
})

/* ── 도장 (W3-2) — 스텝이 곧 절점: S/P → T/UP → FINAL ── */

describe('도장 스텝 mock — 게이트·순차·확정·BTS 귀속', () => {
  const SAMPLES: [string, string][] = [['7004', '222'], ['7004', '310'], ['7004', '415'], ['7004', '521'], ['7012', '118'], ['8103', '105']]

  it('같은 입력이면 같은 스텝 실적 (결정론 해시)', () => {
    expect(generatePaintingSteps('7004', '222', BASE)).toEqual(generatePaintingSteps('7004', '222', BASE))
  })

  it('조립종료(검사장 이동) 전에는 도장이 서지 않는다 — 반입 전·전 스텝 미도래·이벤트 없음', async () => {
    for (const [proj, block] of SAMPLES) {
      const asm = await fetchAssemblySummary(proj, block, BASE)
      const pnt = generatePaintingSteps(proj, block, BASE)
      if (asm.inspectionMoved) continue
      expect(pnt.phase).toBe('beforeIn')
      expect(pnt.factory).toBeNull()
      expect(pnt.steps.every((s) => s.status === 'notDue')).toBe(true)
      expect(await fetchCollectionEvents(proj, [block], 'painting', BASE)).toEqual([])
    }
  })

  it('스텝은 순차 절점 — 완료가 앞쪽 접두(prefix)를 이루고, 완료 뒤 스텝만 진행/미도래다', () => {
    for (const [proj, block] of SAMPLES) {
      const { steps } = generatePaintingSteps(proj, block, BASE)
      const firstNotDone = steps.findIndex((s) => s.status !== 'done')
      steps.forEach((s, i) => {
        if (firstNotDone === -1 || i < firstNotDone) expect(s.status).toBe('done')
        else expect(s.status === 'done').toBe(false)
      })
      /* 완료 스텝만 확정될 수 있다 (YPWG221M 관문은 실적 뒤에 온다) */
      for (const s of steps) if (s.confirmed) expect(s.status).toBe('done')
      /* 완료 스텝은 SD/FD 를 모두 갖고, FD ≥ SD */
      for (const s of steps)
        if (s.status === 'done') {
          expect(s.startDate && s.endDate).toBeTruthy()
          expect((s.endDate ?? '') >= (s.startDate ?? '')).toBe(true)
        }
    }
  })

  it('BTS 귀속 — 도장중이면 도장공장 하나가 잡히고, 반출은 전 스텝 완료 후에만', () => {
    for (const [proj, block] of SAMPLES) {
      const pnt = generatePaintingSteps(proj, block, BASE)
      if (pnt.phase === 'inShop') expect(pnt.factory).toBeTruthy()
      if (pnt.phase === 'shippedOut') {
        expect(pnt.doneSteps).toBe(pnt.steps.length)
        expect(pnt.btsOutDate).toBeTruthy()
      }
    }
  })

  it('도장 이벤트 — 단계는 전부 PNT, W/O 행은 일자만·BTS 행은 일시, 반출 행은 shippedOut 만', async () => {
    for (const [proj, block] of SAMPLES) {
      const rows = await fetchCollectionEvents(proj, [block], 'painting', BASE)
      const pnt = generatePaintingSteps(proj, block, BASE)
      for (const row of rows) {
        expect(row.stage).toBe('PNT')
        const isBts = row.kind === 'btsIn' || row.kind === 'btsOut'
        expect(row.mgmtNoType).toBe(isBts ? 'ASSY' : 'WO')
        if (isBts) expect(row.mgmtNo).toBe(`${proj}_${block}`)
        for (const instant of [row.occurred, row.completed]) {
          if (!instant) continue
          if (isBts) expect(instant.time).toBeDefined()
          else expect(instant.time).toBeUndefined()
        }
      }
      expect(rows.some((r) => r.kind === 'btsOut')).toBe(pnt.phase === 'shippedOut')
    }
  })

  it('스텝↔레거시 키 매핑은 잠정 상수 한 곳 — 3스텝이 순서대로 정의돼 있다', () => {
    expect(PAINTING_STEPS).toEqual(['SP', 'TUP', 'FINAL'])
    for (const step of PAINTING_STEPS) {
      const key = PAINTING_STEP_MAPPING[step]
      expect(key.pntWorkKind.length).toBeGreaterThan(0)
      expect(key.pntSeq.length).toBeGreaterThan(0)
    }
  })

  it('헤더의 도장 요약은 도장 집계와 같은 원천이다', async () => {
    const [summary, pnt] = await Promise.all([
      fetchBlockSummary('7004', '222', BASE),
      fetchPaintingSummary('7004', '222', BASE),
    ])
    expect(summary.pntDone).toBe(pnt.doneSteps)
    expect(summary.pntPhase).toBe(pnt.phase)
  })
})
