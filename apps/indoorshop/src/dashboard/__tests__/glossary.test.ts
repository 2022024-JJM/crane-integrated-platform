import { describe, expect, it } from 'vitest'
import { ko } from '../shared/lib/i18n/locales/ko'
import { en } from '../shared/lib/i18n/locales/en'
import { assemblyKo } from '../processes/assembly/i18n/ko'
import { assemblyEn } from '../processes/assembly/i18n/en'
import { outfittingKo } from '../processes/outfitting/i18n/ko'
import { outfittingEn } from '../processes/outfitting/i18n/en'
import { paintingKo } from '../processes/painting/i18n/ko'
import { paintingEn } from '../processes/painting/i18n/en'
import { fabricationKo } from '../processes/fabrication/i18n/ko'
import { yardKo } from '../processes/yard/i18n/ko'
import {
  BANNED_EQUIPMENT_NAMES,
  BANNED_TERMS,
  findGlossaryViolations,
  flattenMessages,
} from '../shared/lib/i18n/glossary'

/**
 * **용어 사전의 계약** (W7-6D) — 걷어낸 낱말이 되살아나지 않는가.
 *
 * 용어 통일은 한 번 고치면 끝나는 일이 아니다. 다음에 화면을 더하는 사람은 사전이 있는지
 * 모르고, 자기 손에 익은 낱말('감지'·'판정')을 쓴다. 그러면 몇 달 뒤 같은 감사를 다시
 * 하게 된다. 그래서 사전을 문서가 아니라 **검사**로 둔다.
 *
 * 검사 대상은 i18n 트리의 **값(사용자가 읽는 문자열)** 뿐이다 — 키 이름(`detected`)·주석·
 * 레거시 필드명은 사용자가 읽지 않으므로 건드리지 않는다(사전 주석 참조).
 *
 * 자리가 `src/__tests__` 인 이유: 공정 로케일을 전부 나란히 놓고 봐야 하는 검사라
 * shared 안에 두면 모듈 경계(shared 는 공정을 모른다)를 어긴다. 사전 **모듈** 자체는
 * 공정을 import 하지 않으므로 `shared/lib/i18n/glossary.ts` 에 그대로 있다.
 */
const KO_TREES = [
  ['공통(shared)', ko],
  ['조립', assemblyKo],
  ['선행의장', outfittingKo],
  ['선행도장', paintingKo],
  ['가공', fabricationKo],
  ['야드', yardKo],
] as const

const EN_TREES = [
  ['shared', en],
  ['assembly', assemblyEn],
  ['outfitting', outfittingEn],
  ['painting', paintingEn],
] as const

/** 실패했을 때 어디를 고쳐야 하는지 한눈에 — 경로·문구·대안을 함께 낸다 */
function report(violations: ReturnType<typeof findGlossaryViolations>): string[] {
  return violations.map(
    (v) => `${v.path}\n      "${v.value}"\n      '${v.term}' → ${v.useInstead} (${v.why})`
  )
}

describe('도메인 용어 — 판별 / 수집 / (예외적) 인식', () => {
  for (const [name, tree] of KO_TREES) {
    it(`${name}: 걷어낸 낱말이 남아 있지 않다`, () => {
      expect(report(findGlossaryViolations(tree, BANNED_TERMS))).toEqual([])
    })
  }

  it("'감지'·'판정'은 예외가 없다 — 사전이 조용히 느슨해지지 않도록", () => {
    for (const term of ['감지', '판정']) {
      const rule = BANNED_TERMS.find((r) => r.term === term)!
      expect(rule.allowedPaths).toEqual([])
    }
  })

  it("'인식' 의 예외는 셋뿐이고, 셋 다 실제로 존재하는 키다", () => {
    const rule = BANNED_TERMS.find((r) => r.term === '인식')!
    expect(rule.allowedPaths).toHaveLength(3)
    const paths = new Set(
      KO_TREES.flatMap(([, tree]) => flattenMessages(tree).map((m) => m.path))
    )
    for (const allowed of rule.allowedPaths) {
      expect(`${allowed} 존재=${paths.has(allowed)}`).toBe(`${allowed} 존재=true`)
    }
  })

  it('예외 자리의 문구는 실제로 센서·기술 쪽 서술이다 — 실적을 세지 않는다', () => {
    const rule = BANNED_TERMS.find((r) => r.term === '인식')!
    const byPath = new Map(
      KO_TREES.flatMap(([, tree]) => flattenMessages(tree)).map((m) => [m.path, m.value])
    )
    for (const path of rule.allowedPaths) {
      const value = byPath.get(path)!
      /* 실적 수치를 세는 자리였다면 분수·건수 표현이 따라붙는다 */
      expect(`${path}: ${value}`).not.toMatch(/\{\{count\}\}|\{\{done\}\}|÷/)
    }
  })
})

describe('영문도 같은 축을 쓴다 — judged / collected', () => {
  /* 한글이 판별로 모였는데 영문이 recognized·detected 로 갈라져 있으면, 두 언어를 오가는
     사용자에게는 통일이 안 된 것과 같다. 영문 실적 낱말은 judged 하나로 둔다. */
  const EN_BANNED = [
    {
      term: 'Recognized',
      useInstead: 'Judged',
      why: 'judged 로 통일한다',
      allowedPaths: [],
    },
    {
      term: 'recognition',
      useInstead: 'judgement',
      why: 'judged 로 통일한다',
      allowedPaths: ['zoneDetail.planItems.ocr'],
    },
    {
      term: 'Detected',
      useInstead: 'Judged / Collected',
      why: 'judged(우리 판정)·collected(원천 유입)로 가른다',
      allowedPaths: [],
    },
  ] as const

  for (const [name, tree] of EN_TREES) {
    it(`${name}: 실적 낱말이 judged 로 모여 있다`, () => {
      expect(report(findGlossaryViolations(tree, EN_BANNED))).toEqual([])
    })
  }
})

describe('설비 명칭 — 화면은 판넬 하나로 부른다', () => {
  for (const [name, tree] of KO_TREES) {
    it(`${name}: '캐비닛'·'Network Panel' 이 화면 문구에 없다`, () => {
      expect(report(findGlossaryViolations(tree, BANNED_EQUIPMENT_NAMES))).toEqual([])
    })
  }

  it('설비 종류 화면 이름이 로케일에 있고, 판넬은 현장 호칭이다', () => {
    expect(ko.equipment.type.PNL).toBe('판넬')
    expect(en.equipment.type.PNL).toBeTruthy()
  })

  it("UI 요소를 '패널' 로 부르지 않는다 — 설비 '판넬' 과 한 글자 차이라 섞인다", () => {
    for (const [name, tree] of KO_TREES) {
      const hits = flattenMessages(tree).filter((m) => m.value.includes('패널'))
      expect(`${name}: ${hits.map((h) => `${h.path}="${h.value}"`).join(' / ')}`).toBe(`${name}: `)
    }
  })
})

describe('사전 자체의 검증 — 검사기가 실제로 잡는가', () => {
  it('금지어가 든 문구를 찾아낸다', () => {
    const violations = findGlossaryViolations({ a: { b: '감지 블록' } }, BANNED_TERMS)
    expect(violations).toHaveLength(1)
    expect(violations[0].path).toBe('a.b')
    expect(violations[0].term).toBe('감지')
  })

  it('예외 경로는 넘어간다', () => {
    const rule = [{ term: '인식', useInstead: '판별', why: '…', allowedPaths: ['a.b'] }]
    expect(findGlossaryViolations({ a: { b: '인식 신뢰도' } }, rule)).toEqual([])
    expect(findGlossaryViolations({ a: { c: '인식 신뢰도' } }, rule)).toHaveLength(1)
  })

  it('키 이름은 보지 않는다 — 값만 본다', () => {
    expect(findGlossaryViolations({ 감지: '판별 블록' }, BANNED_TERMS)).toEqual([])
  })

  it('중첩된 트리를 끝까지 편다', () => {
    expect(flattenMessages({ a: { b: { c: 'x' } }, d: 'y' })).toEqual([
      { path: 'a.b.c', value: 'x' },
      { path: 'd', value: 'y' },
    ])
  })
})
