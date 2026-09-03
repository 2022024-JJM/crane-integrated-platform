import { describe, expect, it } from 'vitest'
import { ko } from '../shared/lib/i18n/locales/ko'
import { en } from '../shared/lib/i18n/locales/en'
import { FAB_STAGES, FAB_STAGES_PENDING_SOURCE } from '../shared/features/performance/model/types'

/**
 * **가공 절점 표기의 계약** (W7-6V 검증 자산 — 요구 원장 R4 → R33).
 *
 * 사용자 확정 **정본 10절점**: 강재 입고 → 1차 선별 → 2차 선별 → **강재 불출** → 전처리 →
 * 절단 → 사상 → 팔레트(편성) → 변성 → 최종 불출. 예전 구현은 이 축의 축약본(5절점)이었고,
 * "선별·전처리·최종 불출은 절점이 아니다" 라고 화면이 적었다 — R33 에서 축을 정본으로
 * 세우면서 그 문구가 뒤집혔으므로, 되돌아가지 않도록 여기서 다시 못 박는다.
 *
 * ⚠️ **S4 는 '강재 불출'** 이다 (정의서의 '전처리(불출)' 표기가 아니라 — 판별 근거 필드가
 * `강재불출.불출일자`). 전처리(S5)는 그 다음의 **별개 절점**이다.
 *
 * 라벨은 i18n 값이라 다음 손질에서 소리 없이 되돌아갈 수 있는 자리다.
 */
describe('가공 절점 라벨 — 정본 10절점의 낱말 (R33)', () => {
  it("S4 는 '강재 불출' 이고 S5 는 '전처리' 다 — 둘은 별개 절점이다", () => {
    expect(ko.performance.stages.s4).toBe('S4 강재 불출')
    expect(ko.performance.stages.s5).toBe('S5 전처리')
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
      'S5 전처리',
      'S6 절단',
      'S7 사상',
      'S8 팔레트 편성',
      'S9 변성',
      'S10 최종 불출',
    ])
    expect(labels).toHaveLength(FAB_STAGES.length)
  })

  it("S4 의 판별 근거가 강재불출 원천을 가리킨다 — 라벨과 근거가 같은 절점을 말한다", () => {
    expect(ko.performance.stages.basisOf.S4).toContain('강재불출')
  })

  it('원천 확정 대기 절점은 근거를 지어내지 않는다 — 그 사실을 그대로 적는다', () => {
    for (const stage of FAB_STAGES_PENDING_SOURCE) {
      expect(ko.performance.stages.basisOf[stage]).toBe('원천 확정 대기')
      expect(en.performance.stages.basisOf[stage]).toBe('source column TBD')
    }
  })

  it("절점이 열이라는 사실과 원천 대기 사정을 화면이 함께 말한다", () => {
    const note = ko.performance.stages.nodeNote
    expect(note).toContain('10절점')
    expect(note).toContain('원천')
    expect(ko.performance.stages.overallNote).toContain('10절점')
  })
})
