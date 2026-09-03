import { describe, expect, it } from 'vitest'
import { ko } from '../shared/lib/i18n/locales/ko'
import { en } from '../shared/lib/i18n/locales/en'

/**
 * **가공 절점 표기의 계약** (W7-6V 검증 자산 — 요구 원장 R4).
 *
 * 사용자 확정 흐름: 강재 입고 → 1·2차 선별 → 강재 불출 → 전처리 → 절단 → 사상 →
 * 팔레트 편성 → 최종 불출. 수집 절점은 그중 다섯(S1~S5)이고, **S2 는 '강재 불출'** 이다
 * (정의서의 '전처리(불출)' 표기가 아니라 — 판별 근거 필드가 `강재불출.불출일자`).
 *
 * W7-6D 가 라벨을 고쳤지만 계약 테스트 없이 커밋됐다(b5058b1). 라벨은 i18n 값이라
 * 다음 손질에서 소리 없이 되돌아갈 수 있는 자리다 — 여기서 못 박는다.
 */
describe('가공 절점 라벨 — 실제 흐름의 낱말 (R4)', () => {
  it("S2 는 '강재 불출' 이다 — '불출'·'전처리(불출)' 로 되돌아가지 않는다", () => {
    expect(ko.performance.stages.s2).toBe('S2 강재 불출')
    expect(en.performance.stages.s2).toBe('S2 Steel issue')
  })

  it('S1·S5 는 띄어쓰기까지 흐름의 낱말 그대로다', () => {
    expect(ko.performance.stages.s1).toBe('S1 강재 반입')
    expect(ko.performance.stages.s5).toBe('S5 팔레트 편성')
  })

  it('S2 의 판별 근거가 강재불출 원천을 가리킨다 — 라벨과 근거가 같은 단계를 말한다', () => {
    expect(ko.performance.stages.basisOf.S2).toContain('강재불출')
  })

  it('절점이 다섯뿐인 이유를 화면이 말한다 — 선별·전처리·최종 불출은 절점이 아니다', () => {
    const note = ko.performance.stages.nodeNote
    expect(note).toContain('5절점')
    for (const missing of ['선별', '전처리', '최종 불출']) {
      expect(note).toContain(missing)
    }
  })
})
