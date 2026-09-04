import { describe, expect, it } from 'vitest'
import { ko } from '../shared/lib/i18n/locales/ko'
import { en } from '../shared/lib/i18n/locales/en'
import {
  FAB_STAGES,
  FAB_STAGES_PENDING_SOURCE,
  fabStagesOfGroup,
} from '../shared/features/performance/model/types'

/**
 * **가공 절점 표기의 계약** (W7-6V 검증 자산 — 요구 원장 R4 → R33 → **R39**).
 *
 * 사용자 확정 **정본 10절점**, 두 단계로 묶인다:
 *   [적치] 강재 입고 → 1차 선별 → 2차 선별 → **강재 불출**
 *   [가공] **가공 입고** → 전처리 → 절단 → 사상 → **모둠선별** → 최종 불출
 *
 * R39 는 실창 검토의 정정이다 — '가공 입고' 를 세워 적치와 가공의 경계를 만들고,
 * '팔레트 편성' 을 현업 어휘 **'모둠선별'** 로 바꾸고, '변성' 을 뺐다. 셋 다 화면 낱말이라
 * 다음 손질에서 소리 없이 되돌아갈 수 있는 자리다 — 여기서 못 박는다.
 *
 * ⚠️ **S4 는 '강재 불출'** 이다 (정의서의 '전처리(불출)' 표기가 아니라 — 판별 근거 필드가
 * `강재불출.불출일자`). 전처리(S6)는 가공 쪽의 **별개 절점**이다.
 */

/** 그 로케일의 통합실적 문구 전부 — 중첩 객체를 한 덩이 문자열로 편다 */
function flattenText(node: unknown): string {
  if (typeof node === 'string') return node
  if (node && typeof node === 'object') return Object.values(node).map(flattenText).join('\n')
  return ''
}

describe('가공 절점 라벨 — 정본 10절점의 낱말 (R39)', () => {
  it("S4 는 '강재 불출', S5 는 신설된 '가공 입고' 다 — 적치와 가공의 경계가 여기다", () => {
    expect(ko.performance.stages.s4).toBe('S4 강재 불출')
    expect(ko.performance.stages.s5).toBe('S5 가공 입고')
    expect(ko.performance.stages.s6).toBe('S6 전처리')
    expect(en.performance.stages.s4).toBe('S4 Steel issue')
  })

  it('절점 이름이 사용자 확정 흐름 그대로다 — 순서·낱말 모두', () => {
    const labels = [
      ko.performance.stages.s1,
      ko.performance.stages.s2,
      ko.performance.stages.s3,
      ko.performance.stages.s4,
      ko.performance.stages.s5,
      ko.performance.stages.s6,
      ko.performance.stages.s7,
      ko.performance.stages.s8,
      ko.performance.stages.s9,
      ko.performance.stages.s10,
    ]
    expect(labels).toEqual([
      'S1 강재 입고',
      'S2 1차 선별',
      'S3 2차 선별',
      'S4 강재 불출',
      'S5 가공 입고',
      'S6 전처리',
      'S7 절단',
      'S8 사상',
      'S9 모둠선별',
      'S10 최종 불출',
    ])
    expect(labels).toHaveLength(FAB_STAGES.length)
  })

  it("'변성' 은 화면에서 사라졌다 — 절점이 아니다 (사용자 지시)", () => {
    expect(flattenText(ko.performance)).not.toContain('변성')
    expect(flattenText(en.performance)).not.toContain('Forming')
  })

  it("'팔레트' 는 절점 어휘에 남아 있지 않다 — '모둠선별' 로 바뀌었다", () => {
    const stageText = flattenText(ko.performance.stages)
    expect(stageText).not.toContain('팔레트')
    expect(stageText).toContain('모둠선별')
    expect(flattenText(en.performance.stages)).not.toContain('Palletiz')
  })

  it('단계 묶음 라벨이 적치/가공을 말한다 — 절점 스트립·카드가 이 낱말로 가른다', () => {
    expect(ko.performance.stages.group.stack).toBe('적치 단계')
    expect(ko.performance.stages.group.fab).toBe('가공 단계')
    expect(fabStagesOfGroup('stack')).toEqual(['S1', 'S2', 'S3', 'S4'])
    expect(fabStagesOfGroup('fab')).toEqual(['S5', 'S6', 'S7', 'S8', 'S9', 'S10'])
  })

  it("S4 의 판별 근거가 강재불출 원천을 가리킨다 — 라벨과 근거가 같은 절점을 말한다", () => {
    expect(ko.performance.stages.basisOf.S4).toContain('강재불출')
  })

  it('근거는 번호가 아니라 절점을 따라간다 — R39 로 밀린 뒤에도 같은 원천을 가리킨다', () => {
    expect(ko.performance.stages.basisOf.S7).toContain('절단완료') // 구 S6
    expect(ko.performance.stages.basisOf.S8).toContain('사상일') // 구 S7
    expect(ko.performance.stages.basisOf.S9).toContain('선별') // 구 S8 (팔레트 편성 → 모둠선별)
  })

  it('원천 확정 대기 절점은 근거를 지어내지 않는다 — 그 사실을 그대로 적는다', () => {
    for (const stage of FAB_STAGES_PENDING_SOURCE) {
      expect(ko.performance.stages.basisOf[stage]).toBe('원천 확정 대기')
      expect(en.performance.stages.basisOf[stage]).toBe('source column TBD')
    }
  })

  it('절점이 열이고 두 단계라는 사실을 화면이 함께 말한다', () => {
    const note = ko.performance.stages.nodeNote
    expect(note).toContain('10절점')
    expect(note).toContain('적치')
    expect(note).toContain('가공')
    expect(note).toContain('원천')
    expect(ko.performance.stages.overallNote).toContain('10절점')
  })
})
