import { describe, expect, it } from 'vitest'
import {
  PAINTING_ANCILLARY,
  PAINTING_STEP_MAPPING,
  PNT_WORK_KIND_PAINT,
  PNT_WORK_KIND_PREP,
  classifyPaintingRow,
  elmtItemCodeOfDetailProcessCode,
  paintingStepOf,
} from '../api/paintingStepMapping'
import { PAINTING_STEPS } from '../model/types'
import type { PaintingStepId } from '../model/types'

/*
 * 도장 스텝 매핑 유도 검증 (W5-8).
 *
 * 원본 CSV(YPWP720M, 3,996행)는 사외 실데이터라 레포에 두지 않는다. 대신 유도 과정에서
 * 나온 **대표 표본** — (PNT_WORK_KIND, ELMT_ITEM_CODE) 16개 조합 전부와 그 행수, 그리고
 * 사양 시퀀스 몇 개 — 만 fixture 로 옮겨 규칙이 그 표본을 전부 설명하는지 검사한다.
 * 표본은 코드값·집계 수치뿐이라 호선·블록 등 식별 정보를 담지 않는다.
 */

/** YPWP720M 3,996행에서 관측된 (공종, 요소코드) 조합 전부 — 16종, 이름과 1:1 */
const OBSERVED_COMBOS: {
  pntWorkKind: string
  elmtItemCode: string
  detailProcessName: string
  rows: number
  expect: { kind: 'step'; step: PaintingStepId } | { kind: 'ancillary'; name: string }
}[] = [
  // 도장 공종 'P'
  { pntWorkKind: 'P', elmtItemCode: 'S1', detailProcessName: 'S/P(1)', rows: 388, expect: { kind: 'step', step: 'SP' } },
  { pntWorkKind: 'P', elmtItemCode: 'S2', detailProcessName: 'S/P(2)', rows: 261, expect: { kind: 'step', step: 'SP' } },
  { pntWorkKind: 'P', elmtItemCode: 'S3', detailProcessName: 'S/P(3)', rows: 135, expect: { kind: 'step', step: 'SP' } },
  { pntWorkKind: 'P', elmtItemCode: 'S4', detailProcessName: 'S/P(4)', rows: 75, expect: { kind: 'step', step: 'SP' } },
  { pntWorkKind: 'P', elmtItemCode: 'S5', detailProcessName: 'S/P(5)', rows: 11, expect: { kind: 'step', step: 'SP' } },
  { pntWorkKind: 'P', elmtItemCode: 'S6', detailProcessName: 'S/P(6)', rows: 6, expect: { kind: 'step', step: 'SP' } },
  { pntWorkKind: 'P', elmtItemCode: 'U1', detailProcessName: 'T/UP(1)', rows: 272, expect: { kind: 'step', step: 'TUP' } },
  { pntWorkKind: 'P', elmtItemCode: 'U2', detailProcessName: 'T/UP(2)', rows: 90, expect: { kind: 'step', step: 'TUP' } },
  { pntWorkKind: 'P', elmtItemCode: 'R0', detailProcessName: 'RE-S/P', rows: 388, expect: { kind: 'step', step: 'TUP' } },
  { pntWorkKind: 'P', elmtItemCode: 'Q0', detailProcessName: 'FINAL', rows: 388, expect: { kind: 'step', step: 'FINAL' } },
  { pntWorkKind: 'P', elmtItemCode: 'T0', detailProcessName: 'TAPE제거', rows: 388, expect: { kind: 'ancillary', name: 'TAPE제거' } },
  // 전처리 공종 'C' — Q0·R0·T0 가 'P' 와 겹치므로 공종이 있어야 유일해진다
  { pntWorkKind: 'C', elmtItemCode: 'R0', detailProcessName: '작업준비', rows: 308, expect: { kind: 'ancillary', name: '작업준비' } },
  { pntWorkKind: 'C', elmtItemCode: 'B0', detailProcessName: '블라스팅', rows: 308, expect: { kind: 'ancillary', name: '블라스팅' } },
  { pntWorkKind: 'C', elmtItemCode: 'G0', detailProcessName: 'GRIT수거', rows: 308, expect: { kind: 'ancillary', name: 'GRIT수거' } },
  { pntWorkKind: 'C', elmtItemCode: 'Q0', detailProcessName: '검사', rows: 335, expect: { kind: 'ancillary', name: '검사' } },
  { pntWorkKind: 'C', elmtItemCode: 'T0', detailProcessName: 'TAPE설치', rows: 335, expect: { kind: 'ancillary', name: 'TAPE설치' } },
]

const TOTAL_ROWS = 3996

/** 관측된 사양 시퀀스 표본 (PNT_PRCS_SEQ 순) — 도장 4종 · 전처리 1종 */
const SPEC_SEQUENCES: { kind: string; steps: { elmtItemCode: string; name: string }[] }[] = [
  {
    kind: 'P',
    steps: [
      { elmtItemCode: 'S1', name: 'S/P(1)' },
      { elmtItemCode: 'U1', name: 'T/UP(1)' },
      { elmtItemCode: 'R0', name: 'RE-S/P' },
      { elmtItemCode: 'Q0', name: 'FINAL' },
      { elmtItemCode: 'T0', name: 'TAPE제거' },
    ],
  },
  {
    kind: 'P',
    steps: [
      { elmtItemCode: 'S1', name: 'S/P(1)' },
      { elmtItemCode: 'U1', name: 'T/UP(1)' },
      { elmtItemCode: 'S2', name: 'S/P(2)' },
      { elmtItemCode: 'U2', name: 'T/UP(2)' },
      { elmtItemCode: 'R0', name: 'RE-S/P' },
      { elmtItemCode: 'Q0', name: 'FINAL' },
      { elmtItemCode: 'T0', name: 'TAPE제거' },
    ],
  },
  {
    kind: 'P',
    steps: [
      { elmtItemCode: 'S1', name: 'S/P(1)' },
      { elmtItemCode: 'S2', name: 'S/P(2)' },
      { elmtItemCode: 'S3', name: 'S/P(3)' },
      { elmtItemCode: 'R0', name: 'RE-S/P' },
      { elmtItemCode: 'Q0', name: 'FINAL' },
      { elmtItemCode: 'T0', name: 'TAPE제거' },
    ],
  },
  {
    kind: 'P',
    steps: [
      { elmtItemCode: 'S1', name: 'S/P(1)' },
      { elmtItemCode: 'R0', name: 'RE-S/P' },
      { elmtItemCode: 'Q0', name: 'FINAL' },
      { elmtItemCode: 'T0', name: 'TAPE제거' },
    ],
  },
  {
    kind: 'C',
    steps: [
      { elmtItemCode: 'R0', name: '작업준비' },
      { elmtItemCode: 'B0', name: '블라스팅' },
      { elmtItemCode: 'G0', name: 'GRIT수거' },
      { elmtItemCode: 'Q0', name: '검사' },
      { elmtItemCode: 'T0', name: 'TAPE설치' },
    ],
  },
]

describe('도장 스텝 매핑 — YPWP720M 실데이터 유도 규칙', () => {
  it('관측된 16개 조합을 규칙이 전부 설명한다 — 미분류 0건', () => {
    expect(OBSERVED_COMBOS).toHaveLength(16)
    for (const combo of OBSERVED_COMBOS) {
      expect(classifyPaintingRow(combo), combo.detailProcessName).toEqual(combo.expect)
    }
  })

  it('(공종, 요소코드) 쌍이라야 상세공정명과 1:1 이다 — 요소코드만으로는 안 된다', () => {
    const byPair = new Set(OBSERVED_COMBOS.map((c) => `${c.pntWorkKind}/${c.elmtItemCode}`))
    const byElmt = new Set(OBSERVED_COMBOS.map((c) => c.elmtItemCode))
    expect(byPair.size).toBe(OBSERVED_COMBOS.length)
    expect(byElmt.size).toBeLessThan(OBSERVED_COMBOS.length) // Q0·R0·T0 가 두 공종에 겹친다
    for (const elmt of ['Q0', 'R0', 'T0']) {
      const kinds = OBSERVED_COMBOS.filter((c) => c.elmtItemCode === elmt).map((c) => c.pntWorkKind)
      expect(kinds.sort()).toEqual([PNT_WORK_KIND_PREP, PNT_WORK_KIND_PAINT])
    }
  })

  it('스텝 행 비율은 50.4%, 부대 49.6%, 미분류 0% 로 재현된다', () => {
    const sum = (kind: 'step' | 'ancillary') =>
      OBSERVED_COMBOS.filter((c) => classifyPaintingRow(c).kind === kind).reduce(
        (acc, c) => acc + c.rows,
        0
      )
    const stepRows = sum('step')
    const ancillaryRows = sum('ancillary')
    expect(stepRows + ancillaryRows).toBe(TOTAL_ROWS)
    expect(stepRows).toBe(2014)
    expect(ancillaryRows).toBe(1982)
    expect(Math.round((stepRows / TOTAL_ROWS) * 1000) / 10).toBe(50.4)
    const unknown = OBSERVED_COMBOS.filter((c) => classifyPaintingRow(c).kind === 'unknown')
    expect(unknown).toEqual([])
  })

  it('스텝별 행수 — S/P 876 · T/UP 750 · FINAL 388', () => {
    const rowsOf = (step: PaintingStepId) =>
      OBSERVED_COMBOS.filter((c) => paintingStepOf(c) === step).reduce((a, c) => a + c.rows, 0)
    expect(rowsOf('SP')).toBe(876)
    expect(rowsOf('TUP')).toBe(750)
    expect(rowsOf('FINAL')).toBe(388)
  })

  it('사양 시퀀스에서 스텝이 S/P → T/UP → FINAL 순서를 어기지 않는다', () => {
    const order: Record<PaintingStepId, number> = { SP: 0, TUP: 1, FINAL: 2 }
    for (const spec of SPEC_SEQUENCES) {
      const seen = spec.steps
        .map((s) => paintingStepOf({ pntWorkKind: spec.kind, elmtItemCode: s.elmtItemCode }))
        .filter((s): s is PaintingStepId => s !== null)
      // 전처리(C) 사양에는 스텝이 하나도 없다
      if (spec.kind === PNT_WORK_KIND_PREP) {
        expect(seen).toEqual([])
        continue
      }
      // S/P 는 T/UP 뒤에 다시 올 수 있으나(S/P(2) 재도장), FINAL 은 언제나 마지막 스텝이다
      expect(seen.at(-1)).toBe('FINAL')
      expect(seen.filter((s) => s === 'FINAL')).toHaveLength(1)
      expect(order[seen[0]]).toBe(order.SP)
    }
  })

  it('RE-S/P(R0) 는 T/UP 귀속 — 순서 근거(항상 FINAL 직전)를 표본이 뒷받침한다', () => {
    expect(paintingStepOf({ pntWorkKind: 'P', elmtItemCode: 'R0' })).toBe('TUP')
    for (const spec of SPEC_SEQUENCES.filter((s) => s.kind === 'P')) {
      const i = spec.steps.findIndex((s) => s.elmtItemCode === 'R0')
      expect(i).toBeGreaterThanOrEqual(0)
      expect(spec.steps[i + 1].elmtItemCode).toBe('Q0') // 바로 뒤가 FINAL
    }
  })

  it('알려지지 않은 조합은 unknown 으로 떨어진다 — 완료 처리 금지 신호', () => {
    expect(classifyPaintingRow({ pntWorkKind: 'P', elmtItemCode: 'Z9' })).toEqual({ kind: 'unknown' })
    expect(classifyPaintingRow({ pntWorkKind: 'X', elmtItemCode: 'S1' })).toEqual({ kind: 'unknown' })
    expect(paintingStepOf({ pntWorkKind: 'P', elmtItemCode: 'Z9' })).toBeNull()
    // 부대 작업은 unknown 이 아니다 — 아는 작업이지만 절점이 아닐 뿐
    expect(paintingStepOf({ pntWorkKind: 'P', elmtItemCode: 'T0' })).toBeNull()
    expect(classifyPaintingRow({ pntWorkKind: 'P', elmtItemCode: 'T0' }).kind).toBe('ancillary')
  })

  it('PNT_DETL_PRCS_CD 끝 2자리가 ELMT_ITEM_CODE 다 — 코드만으로도 판별된다', () => {
    // 실데이터 표본: PK0202S2(도장 사양 K/02, 2번째 공정, S/P(2)) · C1A005T0(전처리, TAPE설치)
    expect(elmtItemCodeOfDetailProcessCode('PK0202S2')).toBe('S2')
    expect(elmtItemCodeOfDetailProcessCode('C1A005T0')).toBe('T0')
    expect(
      paintingStepOf({
        pntWorkKind: 'PK0202S2'.slice(0, 1),
        elmtItemCode: elmtItemCodeOfDetailProcessCode('PK0202S2'),
      })
    ).toBe('SP')
    expect(
      paintingStepOf({
        pntWorkKind: 'C1A005T0'.slice(0, 1),
        elmtItemCode: elmtItemCodeOfDetailProcessCode('C1A005T0'),
      })
    ).toBeNull()
  })

  it('매핑 상수는 3스텝을 순서대로 덮고, 부대 목록과 겹치지 않는다', () => {
    expect(Object.keys(PAINTING_STEP_MAPPING)).toEqual([...PAINTING_STEPS])
    const stepPairs = new Set(
      PAINTING_STEPS.flatMap((s) =>
        PAINTING_STEP_MAPPING[s].elmtItemCodes.map(
          (e) => `${PAINTING_STEP_MAPPING[s].pntWorkKind}/${e}`
        )
      )
    )
    for (const a of PAINTING_ANCILLARY) {
      expect(stepPairs.has(`${a.pntWorkKind}/${a.elmtItemCode}`)).toBe(false)
    }
    for (const step of PAINTING_STEPS) {
      const key = PAINTING_STEP_MAPPING[step]
      expect(key.pntWorkKind).toBe(PNT_WORK_KIND_PAINT)
      expect(key.elmtItemCodes.length).toBe(key.detailProcessNames.length)
      expect(key.elmtItemCodes.length).toBeGreaterThan(0)
    }
  })
})
