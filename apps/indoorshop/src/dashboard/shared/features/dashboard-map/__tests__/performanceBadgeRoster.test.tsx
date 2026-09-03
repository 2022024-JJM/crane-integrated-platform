import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../lib/testing/renderWithProviders'
import { PerformanceBadge } from '../ui/PerformanceBadge'
import { findBlock, listBlocks, searchRosterBlocks } from '../../../entities/vessel'

/*
 * 드릴다운 실적 배지의 블록 라벨 — **로스터가 유일한 원천**이라는 계약 (UX 감사 F-42).
 *
 * 감사에서 "드릴다운은 `7604-222` 라는데 같은 화면의 검색은 없다 한다"가 보고됐다.
 * 추적 결과 화면 원천은 이미 로스터 하나였고(배지 → performanceApi → 로스터), 문제의
 * `7604` 는 JPEG 압축 스크린샷에서 mono 숫자 `0` 이 뭉개져 읽힌 것이었다(같은 샷의
 * `48/50` 도 `48/58` 로 읽힌다). 즉 지금은 결함이 없다 — 그래서 이 테스트는 수리가
 * 아니라 **재발 방지**다: 배지가 언젠가 로스터 아닌 곳에서 라벨을 만들기 시작하면
 * ("표기는 있는데 검색은 없다"의 진짜 사고 계급) 여기가 먼저 깨진다.
 *
 * DOM 에 실제로 그려진 글자를 검사한다 — 데이터 계층만 보면 "원천은 맞는데 표기가
 * 딴 값을 조립하는" 회귀를 놓친다.
 */

/** 배지가 그리는 블록 라벨 꼴 — `7004-222`. 비율(48/50)·퍼센트(96%)는 걸리지 않는다 */
const BLOCK_LABEL = /^\d+-\w+$/

/** 로스터에 재공 블록이 있는 공장 전부 — 배지가 설 수 있는 모든 자리를 훑는다 */
const factoriesWithBlocks = [...new Set(listBlocks().map((block) => block.factory))]

describe('드릴다운 실적 배지 라벨 = 로스터 (표기≠검색 재발 방지)', () => {
  it('배지에 뜨는 모든 블록 라벨이 로스터에 실재하고, 같은 화면 검색에도 걸린다', async () => {
    expect(factoriesWithBlocks.length).toBeGreaterThan(0)

    for (const factory of factoriesWithBlocks) {
      const { container, unmount } = renderWithProviders(<PerformanceBadge factory={factory} process="조립" />)

      /* 배지는 performanceApi 를 늦게 실어 온다 — 첫 라벨이 설 때까지 기다린다 */
      await screen.findAllByText(BLOCK_LABEL)

      const labels = [...container.querySelectorAll('span')]
        .map((span) => span.textContent?.trim() ?? '')
        .filter((text) => BLOCK_LABEL.test(text))
      expect(labels.length).toBeGreaterThan(0)

      for (const label of labels) {
        const [projNo, ...rest] = label.split('-')
        const blockNo = rest.join('-')

        /* 표기된 라벨은 로스터의 블록이어야 한다 — 다른 원천의 라벨이면 여기서 깨진다 */
        expect(findBlock(projNo, blockNo), `${factory} 배지의 ${label} 이 로스터에 없다`).not.toBeNull()

        /* 그리고 같은 화면의 블록 검색(같은 로스터 색인)에도 그대로 걸려야 한다 */
        const hits = searchRosterBlocks(label)
        expect(
          hits.some((hit) => hit.projNo === projNo && hit.blockNo === blockNo),
          `${factory} 배지의 ${label} 을 블록 검색이 못 찾는다`
        ).toBe(true)

        /* 라벨의 표기 자리도 로스터 값 그대로다 — 변형(자릿수·구분자)이 끼면 잡는다 */
        expect(label).toBe(`${projNo}-${blockNo}`)
      }

      unmount()
    }
  })

  it('배지의 블록 목록은 그 공장의 로스터 블록 집합과 같다 (상한 4)', async () => {
    for (const factory of factoriesWithBlocks) {
      const rosterKeys = new Set(
        listBlocks()
          .filter((block) => block.factory === factory)
          .map((block) => `${block.projNo}-${block.blockNo}`)
      )

      const { container, unmount } = renderWithProviders(<PerformanceBadge factory={factory} process="조립" />)
      await screen.findAllByText(BLOCK_LABEL)

      const labels = [...container.querySelectorAll('span')]
        .map((span) => span.textContent?.trim() ?? '')
        .filter((text) => BLOCK_LABEL.test(text))

      /* 표기 ⊆ 로스터(그 공장) — 다른 공장·다른 우주의 블록이 끼면 깨진다 */
      for (const label of labels) {
        expect(rosterKeys.has(label), `${factory} 배지에 로스터 밖 라벨 ${label}`).toBe(true)
      }
      /* 개수도 로스터가 정한다 (배지는 완료율 낮은 순 4건까지) */
      expect(labels.length).toBe(Math.min(4, rosterKeys.size))

      unmount()
    }
  })
})
