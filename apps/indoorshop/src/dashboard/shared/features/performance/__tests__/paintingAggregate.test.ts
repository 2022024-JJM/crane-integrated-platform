import { describe, expect, it } from 'vitest'
import {
  buildPaintingSteps,
  countPaintingConfirmed,
  countPaintingDone,
  paintingStepStatus,
} from '../model/aggregate'
import { generatePaintingSteps } from '../api/performanceApi'
import type { PaintingStepPlan } from '../model/types'

/*
 * 도장 스텝 집계 — **존재 기반(existence-based)** 규칙을 못박는다 (W5-8, 사용자 확정
 * 2026-09-03). 고정 3단 사다리가 아니라는 것이 요지다:
 *  · 한 블록의 스텝 목록 = 그 블록에 **계획 행이 있는 스텝만** (RE-S/P 는 이벤트성)
 *  · 스텝의 분모 = 그 스텝으로 분류된 **계획 행 전부** (회차 × 존 × 내외 분산)
 *  · 스텝 완료 = 계획 행 **전량** 완료. 부분 완료는 진행중이다.
 *
 * 실데이터 근거(YPWP720M 20블록, dataflow §3.3): 스프레이 회차 1~6 가변(1회 3블록 ·
 * 4회 9블록 · 6회 1블록), T/UP 구성은 `R0+U1+U2` 15 / `R0+U1` 5, 블록·스텝당 계획 행은
 * S/P 2~99행. 전량완료/부분/미착수가 S/P 에서 3/9/8 로 갈린다.
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

describe('도장 스텝 집계 — 존재 기반', () => {
  it('계획 행이 없는 스텝은 목록에서 빠진다 — RE-S/P 없는 블록의 T/UP', () => {
    /* T/UP 구성이 R0 하나뿐인 블록에서 그 R0 가 계획되지 않으면 T/UP 자체가 없다 */
    const steps = buildPaintingSteps([
      plan({ step: 'SP', elmtItemCodes: ['S1', 'S2'], plannedRows: 8, doneRows: 8, startDate: '2026-09-01', endDate: '2026-09-03' }),
      plan({ step: 'TUP', elmtItemCodes: [], plannedRows: 0 }),
      plan({ step: 'FINAL', elmtItemCodes: ['Q0'], plannedRows: 4 }),
    ])
    expect(steps.map((s) => s.step)).toEqual(['SP', 'FINAL'])
    /* 분모가 3 이 아니라 2 다 — 없는 스텝을 분모에 넣으면 영영 못 채운다 */
    expect(steps.length).toBe(2)
    expect(countPaintingDone(steps)).toBe(1)
  })

  it('스텝이 하나뿐인 블록도 성립한다 — 회차 1회짜리', () => {
    const steps = buildPaintingSteps([
      plan({ step: 'SP', elmtItemCodes: ['S1'], plannedRows: 2, doneRows: 2, startDate: '2026-09-01', endDate: '2026-09-02' }),
    ])
    expect(steps).toHaveLength(1)
    expect(steps[0].elmtItemCodes).toEqual(['S1'])
    expect(steps[0].status).toBe('done')
    expect(countPaintingDone(steps)).toBe(steps.length) // 1/1 = 전부 완료
  })

  it('스텝 완료는 계획 행 전량 완료라야 한다 — 부분은 진행중', () => {
    expect(paintingStepStatus(plan({ step: 'SP', plannedRows: 99, doneRows: 98 }))).toBe('inProgress')
    expect(paintingStepStatus(plan({ step: 'SP', plannedRows: 99, doneRows: 99 }))).toBe('done')
    expect(paintingStepStatus(plan({ step: 'SP', plannedRows: 99, doneRows: 0 }))).toBe('notDue')
    /* 착수만 찍혀도 진행중이다 (SD_ACTL 있고 FD_ACTL 없는 행) */
    expect(
      paintingStepStatus(plan({ step: 'SP', plannedRows: 99, doneRows: 0, startDate: '2026-09-01' }))
    ).toBe('inProgress')
  })

  it('부분 완료면 완료일·확정을 세우지 않는다', () => {
    const [step] = buildPaintingSteps([
      plan({
        step: 'SP',
        plannedRows: 10,
        doneRows: 9,
        startDate: '2026-09-01',
        endDate: '2026-09-05',
        confirmed: true,
      }),
    ])
    expect(step.status).toBe('inProgress')
    expect(step.endDate).toBeNull()
    expect(step.confirmed).toBe(false)
    expect(countPaintingConfirmed([step])).toBe(0)
  })

  it('요소코드 구성이 블록마다 다르고 분모가 회차·존·내외로 불어난다', () => {
    const [step] = buildPaintingSteps([
      plan({ step: 'SP', elmtItemCodes: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'], plannedRows: 67, doneRows: 12 }),
    ])
    expect(step.elmtItemCodes).toHaveLength(6) // 실데이터 최대 회차
    expect(step.plannedRows).toBe(67)
    expect(step.doneRows).toBe(12)
    expect(step.status).toBe('inProgress')
  })

  it('완료 행이 계획 행을 넘지 않도록 접는다', () => {
    const [step] = buildPaintingSteps([plan({ step: 'SP', plannedRows: 5, doneRows: 9 })])
    expect(step.doneRows).toBe(5)
    expect(step.status).toBe('done')
  })

  it('순서는 언제나 S/P → T/UP → FINAL 이다 — 계획 입력 순서와 무관', () => {
    const steps = buildPaintingSteps([
      plan({ step: 'FINAL', elmtItemCodes: ['Q0'], plannedRows: 3 }),
      plan({ step: 'TUP', elmtItemCodes: ['U1', 'R0'], plannedRows: 6 }),
      plan({ step: 'SP', elmtItemCodes: ['S1'], plannedRows: 2 }),
    ])
    expect(steps.map((s) => s.step)).toEqual(['SP', 'TUP', 'FINAL'])
  })
})

describe('도장 더미 — 존재 기반 계약', () => {
  const BASE = '2026-09-03'
  const SAMPLES: [string, string][] = [
    ['7004', '222'],
    ['7004', '310'],
    ['7004', '401'],
    ['2378', '625'],
    ['4506', '116'],
    ['5515', '107'],
  ]

  it('T/UP 구성이 블록마다 갈린다 — RE-S/P(R0)는 이벤트성이라 없는 블록이 나온다', () => {
    /* 실데이터 20블록은 T/UP 이 R0+U1+U2 15 · R0+U1 5 로 갈렸다. U1 은 20/20 이므로
       T/UP 스텝 자체가 사라지지는 않고 **분모(요소코드·계획 행)** 가 달라진다.
       스텝이 통째로 빠지는 경로는 buildPaintingSteps 단위 테스트가 덮는다. */
    const shapes = new Set<string>()
    let withoutR0 = 0
    for (let i = 0; i < 60; i += 1) {
      const pnt = generatePaintingSteps('7004', `B${i}`, BASE)
      expect(pnt.steps.length).toBeGreaterThan(0)
      expect(pnt.steps.length).toBeLessThanOrEqual(3)
      const tup = pnt.steps.find((s) => s.step === 'TUP')
      if (!tup) continue
      shapes.add(tup.elmtItemCodes.join('+'))
      if (!tup.elmtItemCodes.includes('R0')) withoutR0 += 1
    }
    expect(shapes.size).toBeGreaterThan(1)
    expect(withoutR0).toBeGreaterThan(0)
  })

  it('계획 행(분모)이 블록마다 다르다 — 회차 × 존 × 내외 분산', () => {
    const denominators = new Set<number>()
    for (let i = 0; i < 60; i += 1) {
      const sp = generatePaintingSteps('7004', `B${i}`, BASE).steps.find((s) => s.step === 'SP')
      if (sp) denominators.add(sp.plannedRows)
    }
    expect(denominators.size).toBeGreaterThan(3)
  })

  it('스프레이 회차가 1~6 으로 갈린다 — 고정 사다리가 아니다', () => {
    const rounds = new Set<number>()
    for (let i = 0; i < 60; i += 1) {
      const sp = generatePaintingSteps('7004', `B${i}`, BASE).steps.find((s) => s.step === 'SP')
      if (sp) rounds.add(sp.elmtItemCodes.length)
    }
    expect(Math.min(...rounds)).toBe(1)
    expect(Math.max(...rounds)).toBeGreaterThanOrEqual(4)
    expect(rounds.size).toBeGreaterThan(2)
  })

  it('완료 스텝은 계획 행이 전량 차 있고, 미완료 스텝은 그렇지 않다', () => {
    for (const [proj, block] of SAMPLES) {
      const { steps } = generatePaintingSteps(proj, block, BASE)
      for (const s of steps) {
        expect(s.plannedRows).toBeGreaterThan(0)
        expect(s.elmtItemCodes.length).toBeGreaterThan(0)
        if (s.status === 'done') {
          expect(s.doneRows).toBe(s.plannedRows)
          expect(s.endDate).toBeTruthy()
        } else {
          expect(s.doneRows).toBeLessThan(s.plannedRows)
          expect(s.endDate).toBeNull()
        }
      }
    }
  })

  it('반입 전이어도 계획(분모)은 서 있고 완료 행만 0 이다', () => {
    for (let i = 0; i < 60; i += 1) {
      const pnt = generatePaintingSteps('7004', `B${i}`, BASE)
      if (pnt.phase !== 'beforeIn') continue
      expect(pnt.steps.length).toBeGreaterThan(0)
      for (const s of pnt.steps) {
        expect(s.plannedRows).toBeGreaterThan(0)
        expect(s.doneRows).toBe(0)
        expect(s.status).toBe('notDue')
      }
      expect(pnt.doneSteps).toBe(0)
      return
    }
  })

  it('요약 카운트의 분모는 steps.length — 존재 기반이다', () => {
    for (const [proj, block] of SAMPLES) {
      const pnt = generatePaintingSteps(proj, block, BASE)
      expect(pnt.doneSteps).toBe(pnt.steps.filter((s) => s.status === 'done').length)
      expect(pnt.doneSteps).toBeLessThanOrEqual(pnt.steps.length)
      expect(pnt.confirmedSteps).toBeLessThanOrEqual(pnt.doneSteps)
      if (pnt.phase === 'shippedOut') expect(pnt.doneSteps).toBe(pnt.steps.length)
    }
  })
})
