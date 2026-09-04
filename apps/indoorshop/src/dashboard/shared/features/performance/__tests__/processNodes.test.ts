import { describe, expect, it } from 'vitest'
import {
  paintingStripNodes,
  rollupAssyWoNodes,
  summarizeAssemblyBlock,
  type AssyRaw,
} from '../model/aggregate'
import {
  ASSY_WO_ORDER,
  FAB_STAGES,
  FAB_STAGES_PENDING_SOURCE,
  FAB_STAGE_GROUP,
  FAB_STAGE_GROUPS,
  fabStagesOfGroup,
  type AssyWo,
  type PaintingStepState,
} from '../model/types'
import {
  fetchBlockSummary,
  fetchCollectionEvents,
  generatePaintingSteps,
  generateParts,
  planDatesOf,
} from '../api/performanceApi'
import { listBlocks } from '../../../entities/vessel'

/**
 * **공정별 절점 축의 계약** (R33 — 사용자 확정).
 *
 * 사용자가 절점을 딱 정해 주었다: 가공은 정본 10절점, 조립은 W/O 작업 순서(취부→용접→
 * 사상), 도장은 기확정 스텝(S/P·T/UP·FINAL). 의장은 절점이 없다(% 유지).
 *
 * **R39 정정** — 실창 검토로 가공 축이 다시 잡혔다: '가공 입고' 신설(적치↔가공 경계),
 * '팔레트 편성' → '모둠선별', '변성' 제거. 그리고 S4 까지가 적치, 그 다음이 가공이다.
 *
 * 축은 화면 세 곳(헤더 스트립·절점 카드·이벤트 그리드)이 함께 쓰는 뼈대라, 어느 한 곳만
 * 손질하면 같은 블록을 두고 서로 다른 이야기를 한다. 여기서 축 자체를 못 박는다.
 */
const BASE = '2026-09-02'

describe('가공 — 정본 10절점 (사용자 원문 순서 그대로)', () => {
  it('축은 강재 입고 → … → 최종 불출 열 칸이다', () => {
    expect(FAB_STAGES).toEqual(['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10'])
  })

  it('원천 확정 대기 절점은 축 안에 있다 — 축에서 빼는 것이 아니라 사정을 적는 것이다', () => {
    for (const stage of FAB_STAGES_PENDING_SOURCE) expect(FAB_STAGES).toContain(stage)
    /* 근거가 확정된 다섯(강재 입고·강재 불출·절단·사상·모둠선별)은 대기 목록에 없다.
       R39 로 번호가 밀렸어도 근거는 절점을 따라간다 — 구 S6·S7·S8 이 새 S7·S8·S9 다. */
    for (const confirmed of ['S1', 'S4', 'S7', 'S8', 'S9'] as const) {
      expect(FAB_STAGES_PENDING_SOURCE).not.toContain(confirmed)
    }
    /* 신설된 '가공 입고'(S5)는 아직 근거가 없다 */
    expect(FAB_STAGES_PENDING_SOURCE).toContain('S5')
  })

  it('축은 적치(S1~S4)와 가공(S5~S10) 두 묶음으로 갈린다 — 경계는 강재 불출 다음이다', () => {
    expect(fabStagesOfGroup('stack')).toEqual(['S1', 'S2', 'S3', 'S4'])
    expect(fabStagesOfGroup('fab')).toEqual(['S5', 'S6', 'S7', 'S8', 'S9', 'S10'])
    /* 묶음은 축 순서를 자르기만 한다 — 앞뒤로 섞이지 않는다 */
    const order = FAB_STAGES.map((s) => FAB_STAGE_GROUP[s])
    expect(order.indexOf('fab')).toBe(order.lastIndexOf('stack') + 1)
    expect(FAB_STAGE_GROUPS).toEqual(['stack', 'fab'])
    expect(fabStagesOfGroup('stack').length + fabStagesOfGroup('fab').length).toBe(
      FAB_STAGES.length
    )
  })

  it('부재 모집단이 열 절점을 모두 채운다 — 빠진 칸이 없다', () => {
    for (const part of generateParts('7004', '222', BASE)) {
      expect(Object.keys(part.statuses).sort()).toEqual([...FAB_STAGES].sort())
    }
  })

  it('절점 계획일 사다리는 순서대로 앞선다 — 최종 불출이 강재 입고보다 이르지 않다', () => {
    for (const block of listBlocks().slice(0, 12)) {
      const plans = planDatesOf(block.projNo, block.blockNo, BASE)
      const where = `${block.projNo}-${block.blockNo}`
      /* 지터(0~2일)가 있어 이웃끼리는 뒤집힐 수 있으므로 양 끝을 본다 */
      expect(plans.S10 > plans.S1, where).toBe(true)
      /* 적치의 끝(S4)보다 가공의 시작(S5)이 뒤에 온다 — 단계 경계가 계획에도 있다 */
      expect(plans.S5 >= plans.S4, where).toBe(true)
    }
  })

  it('시각은 원천에 있는 절점에만 — S4(강재 불출)·S7(절단) 둘뿐이다', async () => {
    const rows = await fetchCollectionEvents('7004', ['222', '310', '118'], 'fabrication', BASE)
    const seen = new Set<string>()
    for (const row of rows) {
      for (const instant of [row.occurred, row.completed]) {
        if (!instant) continue
        if (instant.time !== undefined) seen.add(String(row.stage))
      }
    }
    for (const stage of seen) expect(['S4', 'S7']).toContain(stage)
  })
})

/* ── 조립 절점 — W/O 작업 순서 롤업 ─────────────────────────────────── */

const wo = (woNo: string, kind: AssyWo['kind'], status: AssyWo['status']): AssyWo => ({
  woNo,
  kind,
  status,
  actualDate: status === 'done' ? '2026-09-01' : null,
})

const assy = (assyNo: string, reqQty: number, recognizedQty: number, wos: AssyWo[]): AssyRaw => ({
  assyNo,
  strcCode: 'S',
  serNo: assyNo.slice(-2),
  tier: 'sub',
  parentAssyNo: null,
  depth: 0,
  reqQty,
  recognizedQty,
  judgedDate: recognizedQty > 0 ? '2026-09-01' : null,
  match: { state: 'matched', wos, flag: null, poolLabel: 'YPWG411M (하루치)' },
})

const blockOf = (assys: AssyRaw[]) => summarizeAssemblyBlock(assys, { moved: false, date: null })

describe('조립 — 절점 축 승격 (취부 → 용접 → 사상)', () => {
  it('축 순서는 작업 순서 그대로다', () => {
    expect(ASSY_WO_ORDER).toEqual(['fit', 'weld', 'grind'])
  })

  it('통과 = 그 종류 W/O 전량 완료 — 한 건이 남으면 절점은 닫히지 않는다', () => {
    const nodes = rollupAssyWoNodes(
      blockOf([
        assy('7004-222-S01', 4, 4, [wo('WO-1', 'fit', 'done'), wo('WO-2', 'weld', 'done')]),
        assy('7004-222-S02', 4, 2, [wo('WO-3', 'fit', 'done'), wo('WO-4', 'weld', 'inProgress')]),
      ])
    )
    expect(nodes.map((n) => n.kind)).toEqual(['fit', 'weld'])
    expect(nodes[0]).toMatchObject({ status: 'passed', doneWos: 2, totalWos: 2 })
    expect(nodes[1]).toMatchObject({ status: 'inProgress', doneWos: 1, totalWos: 2 })
  })

  it('진행중 = 완료·착수가 하나라도 있음, 미도래 = 아무것도 시작 안 함', () => {
    const nodes = rollupAssyWoNodes(
      blockOf([
        assy('7004-222-S01', 4, 0, [
          wo('WO-1', 'fit', 'inProgress'),
          wo('WO-2', 'weld', 'notStarted'),
        ]),
      ])
    )
    expect(nodes.find((n) => n.kind === 'fit')?.status).toBe('inProgress')
    expect(nodes.find((n) => n.kind === 'weld')?.status).toBe('notDue')
  })

  it('계획 W/O 가 없는 종류는 절점 목록에서 빠진다 — 없는 절점을 분모에 세우지 않는다', () => {
    const nodes = rollupAssyWoNodes(
      blockOf([assy('7004-222-S01', 4, 4, [wo('WO-1', 'fit', 'done')])])
    )
    expect(nodes.map((n) => n.kind)).toEqual(['fit'])
  })

  it('매칭 불일치 ASSY 는 붙은 W/O 가 없어 분모에 들어오지 않는다 (ASM-F10 은 ASSY 축이 잡는다)', () => {
    const unmatched: AssyRaw = {
      ...assy('7004-222-S02', 4, 4, []),
      match: { state: 'unmatched', wos: [], flag: null, poolLabel: 'YPWG411M / YPWS210V' },
    }
    const nodes = rollupAssyWoNodes(
      blockOf([assy('7004-222-S01', 4, 4, [wo('WO-1', 'fit', 'done')]), unmatched])
    )
    expect(nodes).toHaveLength(1)
    expect(nodes[0]).toMatchObject({ kind: 'fit', totalWos: 1, status: 'passed' })
  })

  it('단조성은 강제하지 않는다 — 블록 안 ASSY 들이 서로 다른 단계에 있는 것이 정상이다', () => {
    const nodes = rollupAssyWoNodes(
      blockOf([
        assy('7004-222-S01', 4, 4, [wo('WO-1', 'fit', 'notStarted'), wo('WO-2', 'weld', 'done')]),
      ])
    )
    expect(nodes.find((n) => n.kind === 'fit')?.status).toBe('notDue')
    expect(nodes.find((n) => n.kind === 'weld')?.status).toBe('passed')
  })
})

/* ── 도장 절점 — 스텝을 같은 스트립 문법으로 (정의는 그대로) ─────────── */

const step = (over: Partial<PaintingStepState>): PaintingStepState => ({
  step: 'SP',
  status: 'notDue',
  woNo: 'W-1',
  elmtItemCodes: ['S1'],
  plannedRows: 4,
  doneRows: 0,
  progressPct: 0,
  progressAsOf: null,
  progressHistory: [],
  startDate: null,
  endDate: null,
  confirmed: false,
  ...over,
})

describe('도장 — 절점 스트립 정렬 (스텝 정의는 바꾸지 않는다)', () => {
  it("스텝 상태를 절점 어휘로만 옮긴다 — done → passed, 나머지는 그대로", () => {
    const nodes = paintingStripNodes([
      step({ step: 'SP', status: 'done', doneRows: 4 }),
      step({ step: 'TUP', status: 'inProgress', doneRows: 1 }),
      step({ step: 'FINAL', status: 'notDue' }),
    ])
    expect(nodes.map((n) => n.status)).toEqual(['passed', 'inProgress', 'notDue'])
    expect(nodes[0]).toMatchObject({ step: 'SP', doneRows: 4, plannedRows: 4 })
  })

  it('존재 기반 분모를 그대로 물려받는다 — 스텝 수가 3 으로 고정되지 않는다', () => {
    const nodes = paintingStripNodes([step({ step: 'SP', plannedRows: 67, doneRows: 12 })])
    expect(nodes).toHaveLength(1)
    expect(nodes[0].plannedRows).toBe(67)
  })

  it('실제 블록에서도 스텝 목록과 절점 목록이 1:1 이다', () => {
    for (const block of listBlocks().slice(0, 12)) {
      const pnt = generatePaintingSteps(block.projNo, block.blockNo, BASE)
      const nodes = paintingStripNodes(pnt.steps)
      expect(nodes.map((n) => n.step)).toEqual(pnt.steps.map((s) => s.step))
    }
  })
})

describe('블록 헤더 — 세 권역이 같은 절점 문법으로 선다', () => {
  it('가공 10칸 · 조립(취부→용접→사상) · 도장(존재 기반) 이 한 요약에 함께 담긴다', async () => {
    for (const block of listBlocks().slice(0, 12)) {
      const summary = await fetchBlockSummary(block.projNo, block.blockNo, BASE)
      const where = `${block.projNo}-${block.blockNo}`
      expect(summary.progress.nodes.map((n) => n.stage), where).toEqual([...FAB_STAGES])
      /* 조립 절점은 작업 순서를 지킨다 (없는 종류는 빠질 뿐, 순서가 뒤집히지 않는다) */
      const kinds = summary.asmNodes.map((n) => n.kind)
      expect(kinds, where).toEqual(ASSY_WO_ORDER.filter((k) => kinds.includes(k)))
      /* 도장 스텝 완료 수의 분모는 절점 수다 — 3 고정이 아니다 */
      expect(summary.pntDone, where).toBeLessThanOrEqual(summary.pntNodes.length)
      expect(summary.pntNodes.map((n) => n.step), where).toEqual(
        generatePaintingSteps(block.projNo, block.blockNo, BASE).steps.map((s) => s.step)
      )
    }
  })

  it('조립 절점 롤업이 헤더의 W/O 참고 수치와 같은 원천을 쓴다', async () => {
    for (const block of listBlocks().slice(0, 12)) {
      const summary = await fetchBlockSummary(block.projNo, block.blockNo, BASE)
      const where = `${block.projNo}-${block.blockNo}`
      const total = summary.asmNodes.reduce((a, n) => a + n.totalWos, 0)
      const done = summary.asmNodes.reduce((a, n) => a + n.doneWos, 0)
      expect(total, where).toBe(summary.woTotal)
      expect(done, where).toBe(summary.woDone)
    }
  })
})
