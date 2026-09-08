import { describe, expect, it } from 'vitest'
import { assyTreeOrder, summarizeAssemblyBlock } from '../model/aggregate'
import { generateAssyUnits } from '../api/performanceApi'
import { assyFocusLinkFor, listBlocks, parseAssyNo, parseSelectionParams } from '../../../entities/vessel'
import type { AssyRaw } from '../model/aggregate'

/*
 * **ASSY 단위 통합실적률** (W6-2, 사용자 요구).
 *
 * 블록 레벨로만 보면 "이 블록 60%" 까지만 알고 어느 덩이가 밀렸는지는 못 본다. 그래서
 * 노드마다 두 값을 낸다 — 자기 단독(`selfRate`)과 자기+하위 롤업(`rollupRate`).
 * 산식 축은 W5-7 그대로 **판별 인식 ÷ 계획(REQ_QTY)** 이고 W/O 는 참고다.
 */

const raw = (
  assyNo: string,
  parentAssyNo: string | null,
  depth: number,
  tier: AssyRaw['tier'],
  reqQty: number,
  recognizedQty: number
): AssyRaw => ({
  assyNo,
  strcCode: tier === 'grand' ? 'G' : tier === 'mid' ? 'M' : 'S',
  serNo: assyNo.slice(-2),
  tier,
  parentAssyNo,
  depth,
  reqQty,
  recognizedQty,
  judgedDate: recognizedQty > 0 ? '2026-09-01' : null,
  match: { state: 'matched', wos: [], flag: null, poolLabel: 'YPWG411M (하루치)' },
})

/** 대조 G01 ← 중조 M02 ← 소조 S03·S04 (한 가지) */
const TREE: AssyRaw[] = [
  raw('7004-999-G01', null, 0, 'grand', 10, 10),
  raw('7004-999-M02', '7004-999-G01', 1, 'mid', 6, 3),
  raw('7004-999-S03', '7004-999-M02', 2, 'sub', 4, 0),
  raw('7004-999-S04', '7004-999-M02', 2, 'sub', 5, 5),
]

describe('ASSY 단위 실적률 — 자기 단독 · 자기+하위 롤업', () => {
  const summary = summarizeAssemblyBlock(TREE, { moved: false, date: null })
  const at = (assyNo: string) => summary.assys.find((a) => a.assyNo === assyNo)!

  it('자기 단독은 그 덩이의 인식 ÷ 계획이다', () => {
    expect(at('7004-999-G01').selfRate).toBe(100) // 10/10
    expect(at('7004-999-M02').selfRate).toBe(50) //  3/6
    expect(at('7004-999-S03').selfRate).toBe(0) //   0/4
    expect(at('7004-999-S04').selfRate).toBe(100) // 5/5
  })

  it('롤업은 자기+하위 합산이다 — 대조는 자기만 끝나도 가지가 남으면 100%가 아니다', () => {
    const g = at('7004-999-G01')
    expect(g.rollupRecognizedQty).toBe(18) // 10+3+0+5
    expect(g.rollupReqQty).toBe(25) //        10+6+4+5
    expect(g.rollupRate).toBe(72)
    expect(g.selfRate).toBe(100) // 자기는 끝났는데
    expect(g.rollupRate).toBeLessThan(g.selfRate) // 가지는 아직이다 — 이 차이를 화면이 낸다
    expect(g.descendantCount).toBe(3)
  })

  it('중간 노드도 제 가지만 합산한다', () => {
    const m = at('7004-999-M02')
    expect(m.rollupRecognizedQty).toBe(8) // 3+0+5
    expect(m.rollupReqQty).toBe(15) //       6+4+5
    expect(m.rollupRate).toBe(53.3)
    expect(m.descendantCount).toBe(2)
  })

  it('하위가 없는 소조는 롤업과 단독이 같다 — 화면이 하나만 적는 근거', () => {
    for (const no of ['7004-999-S03', '7004-999-S04']) {
      const u = at(no)
      expect(u.descendantCount).toBe(0)
      expect(u.rollupRate).toBe(u.selfRate)
      expect(u.rollupReqQty).toBe(u.reqQty)
    }
  })

  it('계획 분모가 0 이면 0% — 나눗셈을 지어내지 않는다', () => {
    const zero = summarizeAssemblyBlock([raw('7004-998-G01', null, 0, 'grand', 0, 0)], {
      moved: false,
      date: null,
    })
    expect(zero.assys[0].selfRate).toBe(0)
    expect(zero.assys[0].rollupRate).toBe(0)
  })

  it('루트 롤업 합이 블록 요약과 같다 — 두 층이 다른 수를 말하지 않는다', () => {
    const roots = summary.assys.filter((a) => a.parentAssyNo == null)
    const rec = roots.reduce((acc, r) => acc + r.rollupRecognizedQty, 0)
    const req = roots.reduce((acc, r) => acc + r.rollupReqQty, 0)
    expect(rec).toBe(summary.recognizedQty)
    expect(req).toBe(summary.reqQtyTotal)
    expect(Math.round((rec / req) * 1000) / 10).toBe(summary.judgedRate)
  })

  it('로스터 전 블록에서 롤업이 성립한다 — 자기 ≤ 롤업 분모, 루트 합 = 블록 합', () => {
    for (const b of listBlocks()) {
      const s = generateAssyUnits(b.projNo, b.blockNo, '2026-09-03')
      const where = `${b.projNo}-${b.blockNo}`
      for (const u of s.assys) {
        expect(u.rollupReqQty, `${where} ${u.assyNo}`).toBeGreaterThanOrEqual(u.reqQty)
        expect(u.rollupRecognizedQty, `${where} ${u.assyNo}`).toBeGreaterThanOrEqual(u.recognizedQty)
        expect(u.selfRate).toBeGreaterThanOrEqual(0)
        expect(u.selfRate).toBeLessThanOrEqual(100)
        expect(u.rollupRate).toBeLessThanOrEqual(100)
      }
      const roots = s.assys.filter((a) => a.parentAssyNo == null)
      expect(roots.reduce((a, r) => a + r.rollupReqQty, 0), where).toBe(s.reqQtyTotal)
      expect(roots.reduce((a, r) => a + r.rollupRecognizedQty, 0), where).toBe(s.recognizedQty)
    }
  })
})

describe('ASSY 딥링크 — `?assy=` 로 바로 진입·포커스', () => {
  const params = (q: string) => new URLSearchParams(q)

  it('ASSY_NO 조합식에서 호선·블록이 나온다 — 링크가 자립한다', () => {
    expect(parseAssyNo('2543-642-G01')).toEqual({ projNo: '2543', blockNo: '642' })
    expect(parseAssyNo('7004-222-M02')).toEqual({ projNo: '7004', blockNo: '222' })
    expect(parseAssyNo('7004-222')).toBeNull() // 급·순번이 없다
    expect(parseAssyNo('nope')).toBeNull()
  })

  it('`?assy=` 하나만 있어도 호선·블록 조회가 함께 선다', () => {
    expect(parseSelectionParams(params('assy=7004-222-M02'))).toEqual({
      projNo: '7004',
      blocks: ['222'],
      assys: ['7004-222-M02'],
    })
  })

  it('여러 ASSY 는 같은 블록의 것만 남긴다 — 자리 하나에 묶인 덩이들이다', () => {
    const sel = parseSelectionParams(params('assy=7004-222-S03,7004-222-S04,2543-642-G01'))
    expect(sel).toEqual({
      projNo: '7004',
      blocks: ['222'],
      assys: ['7004-222-S03', '7004-222-S04'],
    })
  })

  it('로스터에 없는 블록의 ASSY 는 무시하고 종전 규칙으로 떨어진다', () => {
    expect(parseSelectionParams(params('assy=9999-000-G01&vessel=7004&block=222'))).toEqual({
      projNo: '7004',
      blocks: ['222'],
    })
    expect(parseSelectionParams(params('assy=9999-000-G01'))).toBeNull()
  })

  it('링크 생성 — 호선·블록·ASSY 를 한 URL 에 싣는다', () => {
    expect(assyFocusLinkFor(['7004-222-M02'])).toBe(
      '/indoorshop/performance?vessel=7004&block=222&assy=7004-222-M02'
    )
    expect(assyFocusLinkFor(['7004-222-S03', '7004-222-S04'])).toBe(
      '/indoorshop/performance?vessel=7004&block=222&assy=7004-222-S03%2C7004-222-S04'
    )
    expect(assyFocusLinkFor(['9999-000-G01'])).toBeNull()
    expect(assyFocusLinkFor([])).toBeNull()
  })

  it('링크를 되읽으면 같은 선택이 나온다 (왕복)', () => {
    const link = assyFocusLinkFor(['7004-222-M02'])!
    const back = parseSelectionParams(new URLSearchParams(link.split('?')[1]))
    expect(back).toEqual({ projNo: '7004', blocks: ['222'], assys: ['7004-222-M02'] })
  })

  it('로스터 ASSY 소재의 번호가 실적 트리에 그대로 있다 — 지목한 줄을 찾을 수 있다', () => {
    for (const b of listBlocks()) {
      if (!b.assyUnits) continue
      const tree = assyTreeOrder(generateAssyUnits(b.projNo, b.blockNo, '2026-09-03').assys)
      const known = new Set(tree.map((u) => u.assyNo))
      for (const unit of b.assyUnits) {
        expect(known.has(unit.assyNo), unit.assyNo).toBe(true)
        /* 그 번호로 만든 딥링크가 그 블록을 가리킨다 */
        expect(assyFocusLinkFor([unit.assyNo])).toContain(`block=${b.blockNo}`)
      }
    }
  })
})
