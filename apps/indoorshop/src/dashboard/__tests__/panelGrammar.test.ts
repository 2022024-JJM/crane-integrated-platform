import { describe, expect, it } from 'vitest'
import { ko } from '../shared/lib/i18n/locales/ko'
import { en } from '../shared/lib/i18n/locales/en'
import { assemblyKo } from '../processes/assembly/i18n/ko'
import { assemblyEn } from '../processes/assembly/i18n/en'
import { outfittingKo } from '../processes/outfitting/i18n/ko'
import { outfittingEn } from '../processes/outfitting/i18n/en'
import { paintingKo } from '../processes/painting/i18n/ko'
import { paintingEn } from '../processes/painting/i18n/en'

/**
 * 공정 화면들의 **문구 계약** — 공정을 가로지르는 검사라 어느 레이어에도 속하지 않는다.
 * (`src/__tests__` 는 processes/shared/app 어디에도 들지 않아 경계 규칙이 걸리지 않는다 —
 * 조립·의장·도장을 나란히 놓고 봐야 하는 검사가 있을 자리는 여기뿐이다.)
 *
 * 조립·의장이 같은 우측 패널 문법을 쓰기로 한 뒤(W6-5), 그 합의는 코드가 아니라 문구에
 * 먼저 드러난다 — 한쪽만 단 이름이 바뀌거나 한쪽에만 남은 옛 낱말('작업중/대기'·'맵 진입')이
 * 있으면 화면을 오갈 때 같은 것을 다르게 부르게 된다. 화면을 띄워 눈으로 확인하는 대신
 * 여기서 지킨다.
 */

/** 사용자에게 보이는 제목에 들어가면 안 되는 구현 용어 */
const IMPLEMENTATION_WORDS = ['맵 진입', 'Map Entry', '배치도', 'layout', 'Layout']

describe('공정 화면 제목', () => {
  const titles = [
    ['조립 ko', assemblyKo.assembly.mapEntry.title],
    ['조립 en', assemblyEn.assembly.mapEntry.title],
    ['의장 ko', outfittingKo.outfitting.mapEntry.title],
    ['의장 en', outfittingEn.outfitting.mapEntry.title],
    ['도장 ko', paintingKo.painting.workspace.title],
    ['도장 en', paintingEn.painting.workspace.title],
  ] as const

  it('제목에 구현 용어를 쓰지 않는다 — 사용자는 화면 구현 방식을 모른다', () => {
    for (const [name, title] of titles) {
      for (const word of IMPLEMENTATION_WORDS) {
        expect(`${name}: ${title}`).not.toContain(word)
      }
    }
  })

  it('세 공정 모두 "공정 현황" 계열 이름을 쓴다 — 같은 성격의 화면은 같게 부른다', () => {
    expect(assemblyKo.assembly.mapEntry.title).toContain('현황')
    expect(outfittingKo.outfitting.mapEntry.title).toContain('현황')
    expect(paintingKo.painting.workspace.title).toContain('현황')
  })
})

describe('걷어낸 옛 문법이 되살아나지 않는다', () => {
  it('의장 맵 진입에 블록 작업 상태(작업중/대기) 낱말이 남아 있지 않다', () => {
    const serialized = JSON.stringify(outfittingKo.outfitting.mapEntry)
    expect(serialized).not.toContain('작업중')
    expect(serialized).not.toContain('대기')
  })

  it("조립에 옛 '센서 상태' 단 키가 남아 있지 않다 — 라이다도 설비다", () => {
    const mapEntry = assemblyKo.assembly.mapEntry as Record<string, unknown>
    expect(mapEntry.modeSensors).toBeUndefined()
    expect(mapEntry.noSensors).toBeUndefined()
  })

  it('도면 뷰어 문구는 공정 무관 자리(shared)에 하나만 있다', () => {
    expect(ko.drawing.open).toBe('도면 보기')
    expect(en.drawing.open).toBeTruthy()
    for (const zone of [assemblyKo.assembly, outfittingKo.outfitting]) {
      expect(JSON.stringify(zone)).not.toContain('도면 보기')
    }
  })
})
