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
  type AssyMatch,
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
        part('a', 100, { S7: 'done' }),
        part('b', 300, { S7: 'excluded' }),
        part('c', 100, { S7: 'notDue' }),
      ],
      'S7'
    )
    expect(agg.targetCount).toBe(2)
    expect(agg.excludedCount).toBe(1)
    expect(agg.targetWeightKg).toBe(200) // 미대상 300kg 이 분모에 없다
    expect(agg.countRate).toBe(50)
    expect(agg.weightRate).toBe(50)
  })

  it('대상이 0이면 실적률은 0으로 처리한다 (§8.5 예외 규칙)', () => {
    const agg = aggregateStage([part('a', 100, { S8: 'excluded' })], 'S8')
    expect(agg.targetCount).toBe(0)
    expect(agg.countRate).toBe(0)
    expect(agg.weightRate).toBe(0)
  })

  it('종합(중량가중)은 10절점 중량 실적률의 평균이다 — 정의서 확정 산식 외 합성 금지', () => {
    const allDone = Object.fromEntries(FAB_STAGES.map((s) => [s, 'done'])) as Record<
      FabStageId,
      StageStatus
    >
    const parts = [part('a', 100, allDone), part('b', 100, { S1: 'done' })]
    const summary = aggregateStages(parts)
    // S1 100% + S2~S10 각 50% → (100 + 50*9)/10 = 55
    expect(summary.stages).toHaveLength(10)
    expect(summary.overallWeightRate).toBe(55)
  })
})

describe('절점 파생 (D3 — 계획·실적 모두 절점에서만)', () => {
  const summary = aggregateStages([
    part('a', 100, { S1: 'done', S2: 'done', S3: 'inProgress' }),
    part('b', 100, { S1: 'done', S2: 'done' }),
  ])
  /* S1~S3 은 기준일(09-03) 이전 도래, S4~S10 은 미도래 */
  const plans = {
    S1: '2026-08-28',
    S2: '2026-08-31',
    S3: '2026-09-01',
    S4: '2026-09-04',
    S5: '2026-09-05',
    S6: '2026-09-06',
    S7: '2026-09-07',
    S8: '2026-09-08',
    S9: '2026-09-09',
    S10: '2026-09-10',
  }
  const progress = deriveNodeProgress(summary, plans, BASE)

  it('절점 통과 = 대상 부재 전량 완료 — 축은 정본 10절점이다', () => {
    expect(progress.nodes.map((n) => n.stage)).toEqual([...FAB_STAGES])
    expect(progress.nodes.map((n) => n.passed)).toEqual([
      true,
      true,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
    ])
  })

  it('지연 = 계획일 도래 후 미통과 절점 (미래 계획일은 지연이 아니다)', () => {
    // S3 계획 09-01(도래·미통과) → 지연 1건. S4~S10 은 미도래
    expect(progress.delayedCount).toBe(1)
    expect(progress.nodes[2].delayed).toBe(true)
    expect(progress.nodes[3].delayed).toBe(false)
  })

  it('계획% = 계획일 도래 절점 비율, 실적% = 종합 중량가중 — 합성 산식 없음', () => {
    expect(progress.planRate).toBe(30) // S1~S3 도래 / 10
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
  it('원천에 시각이 없는 절점은 일자만 — S4(불출)·S7(절단) 만 시각을 갖는다 (L3 계약)', async () => {
    // 조립 행의 시각 계약은 별도 describe — 여기는 가공 행만 본다
    const rows = await fetchCollectionEvents('7004', ['222', '310'], 'fabrication', BASE)
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      const dateOnly = row.stage !== 'S4' && row.stage !== 'S7'
      for (const instant of [row.occurred, row.completed]) {
        if (!instant) continue
        if (dateOnly) expect(instant.time).toBeUndefined()
        else expect(instant.time).toBeDefined()
      }
    }
  })

  it('관리번호 형식이 단계별 4형식(MAT/DWG/PC/PLT)을 따른다', async () => {
    const rows = await fetchCollectionEvents('7004', ['222'], 'fabrication', BASE)
    const typeByStage: Record<FabStageId, string> = {
      S1: 'MAT',
      S2: 'MAT',
      S3: 'MAT',
      S4: 'MAT',
      S5: 'MAT',
      S6: 'MAT',
      S7: 'DWG',
      S8: 'PC',
      S9: 'PLT',
      S10: 'PLT',
    }
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
  recognizedQty: number,
  wos: AssyWo[],
  tree: { parent?: string | null; depth?: number; match?: Partial<AssyMatch> } = {}
): AssyRaw => {
  const [, , tail] = assyNo.split('-')
  const strcCode = tail[0]
  const tier = strcCode === 'G' ? 'grand' : strcCode === 'M' ? 'mid' : 'sub'
  const state = tree.match?.state ?? 'matched'
  return {
    assyNo,
    strcCode,
    serNo: tail.slice(1),
    tier,
    parentAssyNo: tree.parent ?? null,
    depth: tree.depth ?? (tree.parent ? 1 : 0),
    reqQty,
    recognizedQty,
    judgedDate: recognizedQty > 0 ? '2026-09-01' : null,
    match: {
      state,
      wos: state === 'unmatched' ? [] : wos,
      flag: tree.match?.flag ?? null,
      poolLabel: tree.match?.poolLabel ?? 'YPWG411M (하루치)',
    },
  }
}

/**
 * **기준 축 반전 (사용자 확정)** — 조립 실적의 뼈대는 우리 판별(자동수집)이고, 레거시
 * W/O 는 그 위에 붙는 참고다. 예전 계약(`ASSY 완료 = 귀속 W/O 전량 완료`)을 뒤집은
 * 자리라, 그 방향이 되돌아가지 않도록 여기서 잠근다.
 */
describe('블록-ASSY 집계 — 판별이 기준, W/O 는 참고', () => {
  const sample = [
    assy('7004-310-S01', 6, 6, [wo('WO-00001', 'fit', 'done'), wo('WO-00002', 'weld', 'done')]),
    assy('7004-310-M02', 8, 3, [wo('WO-00003', 'fit', 'done'), wo('WO-00004', 'weld', 'inProgress')]),
    assy('7004-310-G03', 5, 0, [wo('WO-00005', 'fit', 'notStarted')]),
  ]

  it('판별 완료 = 인식 수량이 계획 분모를 채움 (W/O 상태와 무관)', () => {
    const summary = summarizeAssemblyBlock(sample, { moved: false, date: null })
    expect(summary.assys.map((u) => u.judged)).toEqual(['complete', 'partial', 'none'])
    expect(summary.assyJudged).toBe(1)
  })

  it('종합 실적률 = 판별 인식 합 ÷ 계획 분모 합 (W/O 완료율이 아니다)', () => {
    const summary = summarizeAssemblyBlock(sample, { moved: false, date: null })
    expect(summary.recognizedQty).toBe(9)
    expect(summary.reqQtyTotal).toBe(19)
    expect(summary.judgedRate).toBe(47.4)
    /* W/O 는 참고로 따로 남는다 — 두 수가 서로를 대신하지 않는다 */
    expect(summary.woDone).toBe(3)
    expect(summary.woTotal).toBe(5)
    expect(summary.woRate).toBe(60)
  })

  it('W/O 를 다 채워도 인식이 없으면 완료가 아니다 — 축이 뒤집혔다는 증거', () => {
    const woDoneButNotRecognized = [
      assy('7004-310-S01', 6, 0, [wo('WO-1', 'fit', 'done'), wo('WO-2', 'weld', 'done')]),
    ]
    const summary = summarizeAssemblyBlock(woDoneButNotRecognized, { moved: false, date: null })
    expect(summary.woRate).toBe(100)
    expect(summary.assys[0].judged).toBe('none')
    expect(summary.assys[0].done).toBe(false)
    expect(summary.assyDone).toBe(0)
  })

  it('인식이 다 됐으면 W/O 가 덜 완료여도 판별은 완료다 (참고가 기준을 막지 않는다)', () => {
    const summary = summarizeAssemblyBlock(
      [assy('7004-310-S01', 4, 4, [wo('WO-1', 'fit', 'done'), wo('WO-2', 'weld', 'notStarted')])],
      { moved: false, date: null }
    )
    expect(summary.assys[0].judged).toBe('complete')
    expect(summary.assys[0].done).toBe(true)
  })
})

describe('매칭 캐스케이드 — 불일치는 완료 처리 금지 (ASM-F10)', () => {
  const unmatched = (assyNo: string, tree = {}) =>
    assy(assyNo, 4, 4, [wo('WO-X', 'fit', 'done')], { ...tree, match: { state: 'unmatched' } })

  it('불일치면 판별이 끝나도 완료가 아니고 완료 보류로 남는다', () => {
    const summary = summarizeAssemblyBlock([unmatched('7004-310-S01')], { moved: false, date: null })
    const unit = summary.assys[0]
    expect(unit.judged).toBe('complete')
    expect(unit.done).toBe(false)
    expect(unit.blockedByMatch).toBe(true)
    expect(summary.assyJudged).toBe(1)
    expect(summary.assyDone).toBe(0)
    expect(summary.match.unmatched).toBe(1)
  })

  it('불일치에는 붙은 W/O 가 없다 — 레거시에 대상이 없다는 사실을 데이터로도 지킨다', () => {
    const summary = summarizeAssemblyBlock([unmatched('7004-310-S01')], { moved: false, date: null })
    expect(summary.assys[0].match.wos).toEqual([])
    expect(summary.assys[0].woTotal).toBe(0)
  })

  it('완료 보류는 위로 번진다 — 소조가 막히면 그 중조·대조도 닫히지 않는다', () => {
    const g = assy('7004-310-G01', 4, 4, [wo('WO-1', 'fit', 'done')])
    const m = assy('7004-310-M02', 4, 4, [wo('WO-2', 'fit', 'done')], { parent: g.assyNo, depth: 1 })
    const s = unmatched('7004-310-S03', { parent: m.assyNo, depth: 2 })
    const summary = summarizeAssemblyBlock([g, m, s], { moved: false, date: null })
    expect(summary.assys.map((u) => u.done)).toEqual([false, false, false])
    /* 위쪽 둘은 매칭 문제가 아니라 자식 때문에 막힌 것 — 판별 자체는 셋 다 완료다 */
    expect(summary.assyJudged).toBe(3)
    expect(summary.match.unmatched).toBe(1)
  })

  it('매칭 분포를 그대로 센다 (카드 범례의 원천)', () => {
    const summary = summarizeAssemblyBlock(
      [
        assy('7004-310-S01', 4, 4, [wo('WO-1', 'fit', 'done')]),
        assy('7004-310-S02', 4, 4, [wo('WO-2', 'fit', 'done')], {
          match: { state: 'fallback', flag: 'early' },
        }),
        unmatched('7004-310-S03'),
      ],
      { moved: false, date: null }
    )
    expect(summary.match).toEqual({ matched: 1, fallback: 1, unmatched: 1 })
  })

  it('검사장 이동은 완료 확정 전량이어야 한다 — 불일치가 남으면 블록이 안 닫힌다', () => {
    const summary = summarizeAssemblyBlock([unmatched('7004-310-S01')], {
      moved: true,
      date: '2026-09-01',
    })
    expect(findAssyViolations(summary)).toContain('inspection-before-done')
  })
})

describe('정합 검증기 — 판별 축의 규칙', () => {
  it('인식 수량이 분모를 넘으면 잡는다', () => {
    const bad = summarizeAssemblyBlock(
      [assy('7004-310-S01', 4, 5, [wo('WO-00001', 'fit', 'done')])],
      { moved: true, date: '2026-09-01' }
    )
    expect(findAssyViolations(bad)).toContain('7004-310-S01:count>req')
  })

  it('불일치에 W/O 가 붙어 있으면 상태와 데이터가 어긋난 것이다', () => {
    const raw = assy('7004-310-S01', 4, 4, [], {})
    const broken = summarizeAssemblyBlock(
      [{ ...raw, match: { ...raw.match, state: 'unmatched', wos: [wo('WO-1', 'fit', 'done')] } }],
      { moved: false, date: null }
    )
    expect(findAssyViolations(broken)).toContain('7004-310-S01:unmatched-has-wo')
    /* `done-unmatched` 는 집계를 거치면 나올 수 없다(불일치는 done 이 안 된다) —
       실연동 데이터가 그 조합을 들고 올 때를 위한 방어 규칙이라 여기서는 안 잡힌다 */
    expect(findAssyViolations(broken)).not.toContain('7004-310-S01:done-unmatched')
  })

  it('폴백이 아닌데 선행/지연 표식이 붙으면 잡는다', () => {
    const raw = assy('7004-310-S01', 4, 4, [wo('WO-1', 'fit', 'done')])
    const broken = summarizeAssemblyBlock(
      [{ ...raw, match: { ...raw.match, flag: 'early' } }],
      { moved: false, date: null }
    )
    expect(findAssyViolations(broken)).toContain('7004-310-S01:flag-without-fallback')
  })

  it('검사장 이동은 블록 레벨 사실 — moved=false 면 날짜도 싣지 않는다', () => {
    const summary = summarizeAssemblyBlock(
      [assy('7004-310-S01', 4, 4, [wo('WO-1', 'fit', 'done')])],
      { moved: false, date: '2026-09-01' }
    )
    expect(summary.inspectionMoved).toBe(false)
    expect(summary.inspectionDate).toBeNull()
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

  it('완료 확정 ASSY 는 판별 완료이고 매칭이 불일치가 아니다 (완료의 필요조건)', () => {
    for (const [proj, block] of SAMPLES) {
      for (const u of generateAssyUnits(proj, block, BASE).assys) {
        if (!u.done) continue
        expect(u.judged).toBe('complete')
        expect(u.match.state).not.toBe('unmatched')
        expect(u.woTotal).toBeGreaterThan(0)
      }
    }
  })

  it('W/O 상태는 판별에서 파생된다 — 인식 완료 ASSY 의 W/O 는 전량 완료', () => {
    for (const [proj, block] of SAMPLES) {
      for (const u of generateAssyUnits(proj, block, BASE).assys) {
        if (u.judged !== 'complete' || u.match.state === 'unmatched') continue
        expect(u.woDone).toBe(u.woTotal)
      }
      /* 반대로 인식이 없으면 완료된 W/O 도 없다 (W/O 가 앞서 가지 않는다) */
      for (const u of generateAssyUnits(proj, block, BASE).assys) {
        if (u.recognizedQty === 0) expect(u.woDone).toBe(0)
      }
    }
  })

  it('폴백 매칭에만 선행/지연 표식이 붙는다 (ASM-F09)', () => {
    for (const [proj, block] of SAMPLES) {
      for (const u of generateAssyUnits(proj, block, BASE).assys) {
        if (u.match.state === 'fallback') expect(u.match.flag).not.toBeNull()
        else expect(u.match.flag).toBeNull()
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

  /**
   * 관리번호·시각 형식이 **원천을 그대로 드러내는지**. 판별 행은 우리 수집(LiDAR)이라
   * ASSY_NO 를 달고 시각이 있고, W/O 행은 레거시 작업지시라 W/O 번호에 일자만 있다 —
   * 두 원천이 한 그리드에 섞여도 어느 쪽에서 온 행인지 형식으로 구분된다.
   */
  it('판별·BTS 행은 ASSY 키+일시, W/O 행은 W/O 키+일자만', async () => {
    const rows = await fetchCollectionEvents('7004', ['222', '310', '415', '521'], 'assembly', BASE)
    const timed = ['btsIn', 'btsOut', 'asmJudged']
    for (const row of rows) {
      const hasTime = timed.includes(row.kind ?? '')
      expect(row.mgmtNoType).toBe(hasTime ? 'ASSY' : 'WO')
      for (const instant of [row.occurred, row.completed]) {
        if (!instant) continue
        if (hasTime) expect(instant.time).toBeDefined()
        else expect(instant.time).toBeUndefined()
      }
    }
  })

  it('판별 행이 원천 — 인식이 있는 ASSY 마다 판별 행이 하나씩 선다', async () => {
    const rows = await fetchCollectionEvents('7004', ['222'], 'assembly', BASE)
    const summary = await fetchAssemblySummary('7004', '222', BASE)
    const judged = rows.filter((r) => r.kind === 'asmJudged')
    expect(judged.map((r) => r.mgmtNo).sort()).toEqual(
      summary.assys.filter((a) => a.recognizedQty > 0).map((a) => a.assyNo).sort()
    )
  })

  it('불일치 ASSY 는 W/O 참고 행을 내지 않는다 — 붙은 W/O 가 없기 때문이다', async () => {
    for (const block of ['222', '310', '415', '521']) {
      const summary = await fetchAssemblySummary('7004', block, BASE)
      const rows = await fetchCollectionEvents('7004', [block], 'assembly', BASE)
      const woNos = new Set(rows.filter((r) => r.mgmtNoType === 'WO').map((r) => r.mgmtNo))
      for (const assyUnit of summary.assys) {
        if (assyUnit.match.state !== 'unmatched') continue
        expect(assyUnit.match.wos).toEqual([])
        /* 판별 행은 서지만(우리가 인식했으니) W/O 행은 없다 */
        expect(rows.some((r) => r.kind === 'asmJudged' && r.mgmtNo === assyUnit.assyNo)).toBe(true)
        for (const no of woNos) expect(no).not.toBe(assyUnit.assyNo)
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

  it('스텝↔레거시 키 매핑은 상수 한 곳 — 3스텝이 순서대로 정의돼 있다', () => {
    /* 유도 규칙 자체의 검증은 paintingStepMapping.test.ts 가 맡는다 */
    expect(PAINTING_STEPS).toEqual(['SP', 'TUP', 'FINAL'])
    for (const step of PAINTING_STEPS) {
      const key = PAINTING_STEP_MAPPING[step]
      expect(key.pntWorkKind.length).toBeGreaterThan(0)
      expect(key.elmtItemCodes.length).toBeGreaterThan(0)
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
