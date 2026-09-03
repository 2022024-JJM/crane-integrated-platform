import { describe, expect, it } from 'vitest'
import { buildPaintingSteps } from '../model/aggregate'
import {
  generateDailyProgress,
  latestBatchDate,
  latestProgressOf,
} from '../api/dailyProgress'
import { generateAssyUnits, generatePaintingSteps } from '../api/performanceApi'
import { blocksInZone, listBlocks } from '../../../entities/vessel'
import type { PaintingStepPlan } from '../model/types'

/*
 * 도장 '진행중 %' — 일일공정률(YPWG413M 그레인) 검증 (W5-9).
 *
 * 못박는 것 셋:
 *  · **면적 가중 산식** — Σ(면적 × 공정률) ÷ Σ(면적). `STD_MH` 가 아니라
 *    `WORK_PLC_AREA` 를 쓰는 이유는 실데이터 결측률(STD_MH 30.4% vs 면적 0%)이다.
 *  · **오늘 데이터 부재** — 등록이 하루 1회 일괄이라 최신 실적일이 언제나 '어제'다.
 *  · **완료 스텝은 100%** — % 는 참고 수치이고 완료 판정(전량 완료)을 흔들지 않는다.
 */

const plan = (over: Partial<PaintingStepPlan> & Pick<PaintingStepPlan, 'step'>): PaintingStepPlan => ({
  elmtItemCodes: ['S1'],
  plannedRows: 1,
  doneRows: 0,
  woNo: 'WO-00000',
  startDate: null,
  endDate: null,
  confirmed: false,
  ...over,
})

describe('일일공정률 더미 — YPWG413M 그레인', () => {
  const BASE = '2026-09-03'

  it('최신 실적일은 언제나 어제다 — 오늘치 등록분은 없다', () => {
    expect(latestBatchDate(BASE)).toBe('2026-09-02')
    const rows = generateDailyProgress({
      workOrdNo: 'WO-12345',
      baseDate: BASE,
      targetRate: 80,
      startDate: '2026-08-25',
      seed: 'seed-a',
    })
    expect(rows.length).toBeGreaterThan(0)
    for (const r of rows) expect(r.actlDate <= '2026-09-02').toBe(true)
    expect(rows.some((r) => r.actlDate === BASE)).toBe(false)
    expect(latestProgressOf(rows)?.asOf).toBe('2026-09-02')
  })

  it('누적 공정률이 단조 증가하고 목표치를 넘지 않는다', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
      const rows = generateDailyProgress({
        workOrdNo: 'WO-1',
        baseDate: BASE,
        targetRate: 80,
        startDate: '2026-08-01',
        seed,
      })
      expect(rows.length).toBeGreaterThanOrEqual(1)
      rows.forEach((r, i) => {
        expect(r.dlyPrgsRate).toBeGreaterThan(0)
        expect(r.dlyPrgsRate).toBeLessThanOrEqual(80)
        if (i > 0) expect(r.dlyPrgsRate).toBeGreaterThanOrEqual(rows[i - 1].dlyPrgsRate)
      })
      /* 413M 키 3종이 모든 행에 선다 */
      for (const r of rows) {
        expect(r.actlDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(r.workOrdNo).toBe('WO-1')
        expect(r.workOganCode.length).toBeGreaterThan(0)
      }
    }
  })

  it('착수일이 배치 기준일보다 뒤면 등록분이 없다 — 아직 아무것도 안 올라왔다', () => {
    expect(
      generateDailyProgress({
        workOrdNo: 'WO-1',
        baseDate: BASE,
        targetRate: 50,
        startDate: '2026-09-10',
        seed: 'late',
      })
    ).toEqual([])
    expect(latestProgressOf([])).toBeNull()
  })
})

describe('진행률 산식 — 면적 가중 평균', () => {
  it('Σ(면적 × 공정률) ÷ Σ(면적) 로 접는다 — 단순 평균과 다르다', () => {
    /* 큰 면적 행이 0%, 작은 면적 행이 100% — 단순 평균 50%, 면적 가중 10% */
    const [step] = buildPaintingSteps([
      plan({
        step: 'SP',
        plannedRows: 2,
        doneRows: 1,
        startDate: '2026-09-01',
        progressRows: [
          { areaSqm: 10, progressPct: 100 },
          { areaSqm: 90, progressPct: 0 },
        ],
        progressAsOf: '2026-09-02',
      }),
    ])
    expect(step.progressPct).toBe(10)
    expect(step.progressAsOf).toBe('2026-09-02')
    expect(step.status).toBe('inProgress')
  })

  it('진행 중 행의 공정률이 % 에 실제로 반영된다 — 행 완료율보다 앞선다', () => {
    /* 4행 중 1행 완료 → 행 완료율 25%. 진행 중 행이 80% 면 가중 % 는 그보다 높다 */
    const rows = [
      { areaSqm: 100, progressPct: 100 },
      { areaSqm: 100, progressPct: 80 },
      { areaSqm: 100, progressPct: 0 },
      { areaSqm: 100, progressPct: 0 },
    ]
    const [step] = buildPaintingSteps([
      plan({ step: 'SP', plannedRows: 4, doneRows: 1, startDate: '2026-09-01', progressRows: rows }),
    ])
    expect(step.progressPct).toBe(45) // (100+80)/4
    expect(step.doneRows / step.plannedRows).toBe(0.25)
    expect(step.progressPct).toBeGreaterThan(25)
  })

  it('완료 스텝은 언제나 100% — 재료가 어긋나도 카드가 모순을 말하지 않는다', () => {
    const [step] = buildPaintingSteps([
      plan({
        step: 'FINAL',
        elmtItemCodes: ['Q0'],
        plannedRows: 3,
        doneRows: 3,
        startDate: '2026-09-01',
        endDate: '2026-09-02',
        progressRows: [
          { areaSqm: 10, progressPct: 92 },
          { areaSqm: 10, progressPct: 100 },
          { areaSqm: 10, progressPct: 100 },
        ],
      }),
    ])
    expect(step.status).toBe('done')
    expect(step.progressPct).toBe(100)
  })

  it('413M 재료가 없으면 행 완료율로 물러선다 — 화면이 비지 않는다', () => {
    const [step] = buildPaintingSteps([
      plan({ step: 'SP', plannedRows: 8, doneRows: 2, startDate: '2026-09-01' }),
    ])
    expect(step.progressPct).toBe(25) // 2/8
    expect(step.progressAsOf).toBeNull()
  })

  it('면적이 전부 0 이면 단순 평균으로 물러선다', () => {
    const [step] = buildPaintingSteps([
      plan({
        step: 'SP',
        plannedRows: 2,
        doneRows: 0,
        startDate: '2026-09-01',
        progressRows: [
          { areaSqm: 0, progressPct: 100 },
          { areaSqm: 0, progressPct: 0 },
        ],
      }),
    ])
    expect(step.progressPct).toBe(50)
  })

  it('% 는 0~100 으로 잘리고 완료 판정을 흔들지 않는다', () => {
    const [over] = buildPaintingSteps([
      plan({
        step: 'SP',
        plannedRows: 4,
        doneRows: 3,
        startDate: '2026-09-01',
        progressRows: [{ areaSqm: 1, progressPct: 400 }],
      }),
    ])
    expect(over.progressPct).toBe(100)
    /* 99% 여도 전량 완료가 아니면 완료가 아니다 */
    expect(over.status).toBe('inProgress')
    expect(over.endDate).toBeNull()
  })

  it('미착수 스텝은 0% 다', () => {
    const [step] = buildPaintingSteps([plan({ step: 'SP', plannedRows: 5, doneRows: 0 })])
    expect(step.status).toBe('notDue')
    expect(step.progressPct).toBe(0)
  })
})

describe('도장 더미 — 진행률 계약', () => {
  const BASE = '2026-09-03'

  it('진행 중 스텝의 % 는 행 완료율 이상이고, 등록일은 어제 이하다', () => {
    let seen = 0
    for (let i = 0; i < 80; i += 1) {
      const { steps } = generatePaintingSteps('7004', `B${i}`, BASE)
      for (const s of steps) {
        expect(s.progressPct).toBeGreaterThanOrEqual(0)
        expect(s.progressPct).toBeLessThanOrEqual(100)
        if (s.status === 'done') expect(s.progressPct).toBe(100)
        if (s.status === 'notDue') expect(s.progressPct).toBe(0)
        if (s.status === 'inProgress') {
          seen += 1
          const rowRate = (s.doneRows / s.plannedRows) * 100
          expect(s.progressPct).toBeGreaterThanOrEqual(Math.floor(rowRate))
          if (s.progressAsOf) expect(s.progressAsOf <= latestBatchDate(BASE)).toBe(true)
        }
      }
    }
    expect(seen).toBeGreaterThan(0)
  })

  it('진행 중 스텝에는 413M 등록일이 실제로 붙는 케이스가 있다', () => {
    let withAsOf = 0
    for (let i = 0; i < 80; i += 1) {
      for (const s of generatePaintingSteps('7004', `B${i}`, BASE).steps) {
        if (s.status === 'inProgress' && s.progressAsOf != null) withAsOf += 1
      }
    }
    expect(withAsOf).toBeGreaterThan(0)
  })

  it('같은 입력이면 % 도 결정적이다', () => {
    const a = generatePaintingSteps('7004', '222', BASE)
    const b = generatePaintingSteps('7004', '222', BASE)
    expect(a.steps.map((s) => [s.progressPct, s.progressAsOf])).toEqual(
      b.steps.map((s) => [s.progressPct, s.progressAsOf])
    )
  })
})


/*
 * **도장 단계 블록만 생애주기 시간축을 과거로 민다** (코디네이터 판단, 2026-09-03).
 *
 * 도장 n일차 블록이면 조립은 그 전에 끝난 게 정합이다. 더미가 모든 블록의 조립 완료를
 * 기준일 언저리에 두던 탓에 도장 재공 블록에도 일일공정률을 놓을 과거 구간이 없었다.
 * 여기서 못박는 것: 도장 블록은 밀렸고, **조립·의장 블록은 밀리지 않았다.**
 */
describe('생애주기 시간 이동 — 도장 단계 블록만', () => {
  const BASE = '2026-09-03'
  const daysBetween = (from: string, to: string) =>
    Math.round(
      (new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86_400_000
    )

  it('도장 재공 블록은 검사장 이동이 기준일 7~10일 전이다 (갓 반입은 제외)', () => {
    const painting = blocksInZone('painting').filter((b) => !b.justArrived)
    expect(painting.length).toBeGreaterThan(0)
    for (const b of painting) {
      const asm = generateAssyUnits(b.projNo, b.blockNo, BASE)
      expect(asm.inspectionMoved, `${b.projNo}-${b.blockNo}`).toBe(true)
      const back = daysBetween(asm.inspectionDate!, BASE)
      expect(back, `${b.projNo}-${b.blockNo}`).toBeGreaterThanOrEqual(7)
      expect(back, `${b.projNo}-${b.blockNo}`).toBeLessThanOrEqual(10)
      /* 조립 판별은 검사장 이동보다 앞선다 — 생애주기 순서 */
      for (const a of asm.assys) {
        if (a.judgedDate == null) continue
        expect(a.judgedDate <= asm.inspectionDate!, `${a.assyNo}`).toBe(true)
      }
    }
  })

  it('조립·의장 단계 블록의 날짜는 건드리지 않았다 — 기준일 언저리 그대로', () => {
    let checked = 0
    for (const b of listBlocks()) {
      if (b.zone === 'painting') continue
      const asm = generateAssyUnits(b.projNo, b.blockNo, BASE)
      if (!asm.inspectionMoved) continue
      /* 종전 규칙: 검사장 이동 = 기준일 -0~2일 */
      const back = daysBetween(asm.inspectionDate!, BASE)
      expect(back, `${b.projNo}-${b.blockNo}`).toBeGreaterThanOrEqual(0)
      expect(back, `${b.projNo}-${b.blockNo}`).toBeLessThanOrEqual(2)
      checked += 1
    }
    expect(checked).toBeGreaterThan(0)
  })

  it('도장 재공 블록에는 진행 중 스텝이 있고 그 %가 어제 등록분에서 온다', () => {
    for (const b of blocksInZone('painting').filter((x) => !x.justArrived)) {
      const pnt = generatePaintingSteps(b.projNo, b.blockNo, BASE)
      expect(pnt.phase, `${b.projNo}-${b.blockNo}`).toBe('inShop')
      const inProgress = pnt.steps.filter((s) => s.status === 'inProgress')
      expect(inProgress.length, `${b.projNo}-${b.blockNo}`).toBeGreaterThan(0)
      for (const s of inProgress) {
        expect(s.progressAsOf, `${b.projNo}-${b.blockNo} ${s.step}`).toBe(latestBatchDate(BASE))
        expect(s.progressPct).toBeGreaterThan(0)
        expect(s.progressPct).toBeLessThan(100)
      }
    }
  })

  it('진행 중 스텝에 일일 이력이 3일치 이상 깔린다 — 하루 1회 일괄의 누적', () => {
    for (const b of blocksInZone('painting').filter((x) => !x.justArrived)) {
      const pnt = generatePaintingSteps(b.projNo, b.blockNo, BASE)
      for (const s of pnt.steps.filter((x) => x.status === 'inProgress')) {
        const rows = generateDailyProgress({
          workOrdNo: s.woNo,
          baseDate: BASE,
          targetRate: 99,
          startDate: s.startDate,
          seed: `${b.projNo}-${b.blockNo}-pnt-${s.step}-413m`,
        })
        expect(rows.length, `${b.projNo}-${b.blockNo} ${s.step}`).toBeGreaterThanOrEqual(3)
      }
    }
  })

  it('스텝 날짜가 미래로 새지 않는다 — 통과·진행중인데 아직 안 온 날짜는 없다', () => {
    for (const b of listBlocks()) {
      const pnt = generatePaintingSteps(b.projNo, b.blockNo, BASE)
      for (const s of pnt.steps) {
        if (s.startDate) expect(s.startDate <= BASE, `${b.projNo}-${b.blockNo} ${s.step}`).toBe(true)
        if (s.endDate) expect(s.endDate <= BASE, `${b.projNo}-${b.blockNo} ${s.step}`).toBe(true)
      }
    }
  })
})
