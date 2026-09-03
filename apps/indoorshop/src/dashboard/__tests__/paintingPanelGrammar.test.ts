import { describe, expect, it } from 'vitest'
import { assemblyKo } from '../processes/assembly/i18n/ko'
import { outfittingKo } from '../processes/outfitting/i18n/ko'
import { paintingKo } from '../processes/painting/i18n/ko'
import { paintingEn } from '../processes/painting/i18n/en'

/**
 * 도장이 조립·의장의 우측 패널 문법을 **끝까지** 따르는가 (W6-6).
 *
 * `panelGrammar.test.ts` 가 조립·의장 둘을 대조하는 자리라면, 여기는 거기에 도장을 세운다.
 * 별도 파일로 두는 이유는 하나다 — 두 작업(W6-5·W6-6)이 같은 파일의 같은 줄에서 부딪히지
 * 않게. 검사하는 것은 같다: **같은 성격의 화면을 같은 낱말로 부르는가.**
 *
 * (공정을 가로지르는 검사라 어느 레이어에도 속하지 않는 `src/__tests__` 에 둔다 — 도장
 * 모듈 안에서 조립 로케일을 import 하면 모듈 경계 규칙 위반이다.)
 */

const ZONES = [
  ['조립', assemblyKo.assembly.mapEntry],
  ['의장', outfittingKo.outfitting.mapEntry],
  ['도장', paintingKo.painting.mapEntry],
] as const

describe('수집 현황의 바깥 두 줄과 나가는 문 — 도장도 같다', () => {
  it('첫 줄은 수집 블록, 마지막 줄은 최근 수집, 문은 공장 현황 보기', () => {
    for (const [name, entry] of ZONES) {
      const collection = entry.collection as Record<string, string>
      /* '감지' 는 용어 사전에서 걷어냈다 — 세 공정의 첫 줄은 '수집'(원천 유입)으로 통일한다
         (도장은 라이다 판별이 없고 BTS 반입이므로 '판별' 로는 참이 되지 않는다) */
      expect(`${name}: ${collection.detected}`).toContain('수집')
      expect(collection.lastScan).toBe('최근 수집')
    }
  })

  /* 나가는 문('공장 현황 보기')은 맵 진입 패널의 것이었다 — 그 화면이 걷히면서(R22)
     문이 남은 곳은 도장의 수집 본문 하나다. 남은 곳의 낱말은 그대로 잠근다. */
  it("남은 나가는 문은 '공장 현황 보기' 그대로다", () => {
    expect(paintingKo.painting.mapEntry.collection.openFactory).toBe('공장 현황 보기')
  })
})

describe('도장 제목·문구', () => {
  it("제목이 '공정 현황' 계열이고 구현 용어를 쓰지 않는다", () => {
    const title = paintingKo.painting.workspace.title
    expect(title).toContain('현황')
    for (const word of ['맵 진입', '배치', 'Layout', 'layout']) {
      expect(title).not.toContain(word)
    }
    expect(paintingEn.painting.workspace.title.toLowerCase()).not.toContain('layout')
  })

  it('공장 현황 화면의 뒤로가기가 공정 대문의 제목과 같은 낱말이다', () => {
    expect(paintingKo.painting.factoryStatus.backToZone).toBe(
      paintingKo.painting.workspace.title
    )
  })

  it('도면 뷰어 문구는 도장 로케일에 복제되지 않았다 — shared 에 하나만 있다', () => {
    expect(JSON.stringify(paintingKo.painting)).not.toContain('도면 보기')
  })
})
