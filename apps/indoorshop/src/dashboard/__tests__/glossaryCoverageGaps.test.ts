import { describe, expect, it } from 'vitest'
import { en } from '../shared/lib/i18n/locales/en'
import { assemblyEn } from '../processes/assembly/i18n/en'
import { outfittingEn } from '../processes/outfitting/i18n/en'
import { paintingEn } from '../processes/painting/i18n/en'
import { fabricationEn } from '../processes/fabrication/i18n/en'
import { yardEn } from '../processes/yard/i18n/en'
import { fabricationKo } from '../processes/fabrication/i18n/ko'
import { yardKo } from '../processes/yard/i18n/ko'
import { ko } from '../shared/lib/i18n/locales/ko'
import { assemblyKo } from '../processes/assembly/i18n/ko'
import { outfittingKo } from '../processes/outfitting/i18n/ko'
import { paintingKo } from '../processes/painting/i18n/ko'
import { findGlossaryViolations, flattenMessages } from '../shared/lib/i18n/glossary'

/**
 * **사전 검사의 사각을 메운다** (W7-6V 적대적 검증 자산).
 *
 * `glossary.test.ts` 의 검사망을 감사자 입장에서 두들겨 보니 세 구멍이 있었다:
 *
 *  1. 영문 검사가 shared·조립·의장·도장 4개 트리만 훑는다 — 가공·야드 en 트리는
 *     지금은 깨끗하지만 검사 밖이라, 다음에 그 화면에 영문 문구를 더하는 사람은
 *     recognized/detected 를 다시 쓸 수 있다.
 *  2. 설비 명칭 금지('캐비닛'·'Network Panel')가 ko 트리에서만 돈다 — en 값은 안 본다.
 *  3. '검출' 은 어느 목록에도 없다 — 감지·판정과 같은 계열의 낱말인데 아직 아무도 안 써서
 *     비어 있을 뿐이다. 쓰이기 전에 잠근다.
 *
 * 여기서는 그 사각만 추가로 덮는다 — 본 검사(glossary.test.ts)를 고치지 않는 것은
 * 검증 워커가 수정 코드를 건드리지 않는다는 규칙 때문이고, 파일이 둘이어도 검사는 합집합이다.
 */
const ALL_EN_TREES = [
  ['shared', en],
  ['assembly', assemblyEn],
  ['outfitting', outfittingEn],
  ['painting', paintingEn],
  ['fabrication', fabricationEn],
  ['yard', yardEn],
] as const

const ALL_KO_TREES = [
  ['공통', ko],
  ['조립', assemblyKo],
  ['의장', outfittingKo],
  ['도장', paintingKo],
  ['가공', fabricationKo],
  ['야드', yardKo],
] as const

describe('사각 1 — 가공·야드 영문 트리도 judged / collected 축을 지킨다', () => {
  const EN_BANNED = [
    { term: 'Recognized', useInstead: 'Judged', why: 'judged 로 통일', allowedPaths: [] },
    { term: 'recognition', useInstead: 'judgement', why: 'judged 로 통일', allowedPaths: [] },
    {
      term: 'Detected',
      useInstead: 'Judged / Collected',
      why: 'judged(우리 판정)·collected(원천 유입)',
      allowedPaths: [],
    },
  ] as const

  for (const [name, tree] of [ALL_EN_TREES[4], ALL_EN_TREES[5]] as const) {
    it(`${name}: 실적 낱말이 judged 로 모여 있다`, () => {
      expect(findGlossaryViolations(tree, EN_BANNED)).toEqual([])
    })
  }
})

describe('사각 2 — 설비 명칭 금지를 영문 값에도 건다', () => {
  it("도면 이름 'Network Panel'(원표기) 이 영문 화면 문구에 없다", () => {
    /* en.equipment.type.PNL 은 'Network panel'(소문자 p) — 영문 화면 이름으로 의도된
       선택이라 그대로 두되, 도면 원표기(대문자 P)가 그대로 새는 것만 막는다. */
    for (const [name, tree] of ALL_EN_TREES) {
      const hits = flattenMessages(tree).filter((m) => m.value.includes('Network Panel'))
      expect(`${name}: ${hits.map((h) => h.path).join(',')}`).toBe(`${name}: `)
    }
  })

  it("코드 개념어 'Cabinet' 이 영문 화면 문구에 없다", () => {
    for (const [name, tree] of ALL_EN_TREES) {
      const hits = flattenMessages(tree).filter((m) => /\bCabinet\b/.test(m.value))
      expect(`${name}: ${hits.map((h) => h.path).join(',')}`).toBe(`${name}: `)
    }
  })

  it("영문 판넬 라벨은 'Network panel' — 바꾸려면 의식적으로 (특성화)", () => {
    /* 한글은 '판넬'(현장 호칭)로 확정됐지만 영문은 사실상 도면 이름의 소문자판이다.
       잘못이라 단정하지 않고 핀만 박는다 — 여기가 깨지면 명칭 결정을 다시 한 것이다. */
    expect(en.equipment.type.PNL).toBe('Network panel')
  })
})

describe("사각 3 — '검출' 을 쓰이기 전에 잠근다", () => {
  const RULE = [
    {
      term: '검출',
      useInstead: '판별(우리 판정) 또는 수집(원천 유입)',
      why: "감지·판정과 같은 계열이다 — 사전 확정(판별/수집/인식) 밖의 낱말",
      allowedPaths: [],
    },
  ] as const

  for (const [name, tree] of ALL_KO_TREES) {
    it(`${name}: '검출' 이 화면 문구에 없다`, () => {
      expect(findGlossaryViolations(tree, RULE)).toEqual([])
    })
  }
})
