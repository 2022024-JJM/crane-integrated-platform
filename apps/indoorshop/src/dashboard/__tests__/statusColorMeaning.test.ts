import { describe, expect, it } from 'vitest'
import { STATUS_HEX, STATUS_STYLE, type StatusMeaning } from '../shared/ui/statusPalette'
import { LOCATION_STATUS_META } from '../shared/entities/location/model/types'
import { ZONE_CHECK_META, ZONE_HEALTH_MEANING } from '../shared/entities/zone/model/types'
import { OUTFITTING_STATUS_META } from '../processes/outfitting/model/block'
import { bayColor, paletteOf } from '../shared/features/yard-map/lib/yardColors'

/**
 * **같은 뜻은 같은 색** — 화면을 가로지르는 계약.
 *
 * 감사에서 걸린 것은 개별 화면의 배색이 아니라 화면 사이의 어긋남이었다. 야드에서
 * 초록이 작업중인데 통합실적에서는 완료였고, 의장에서는 완료가 붉은 계열이라 3m 밖에서
 * 장애로 읽혔다. 그래서 각 화면이 **어떤 의미를 골랐는지**를 여기서 한 번에 본다 —
 * 색 값 자체가 아니라 의미의 배정이 어긋나면 실패해야 한다.
 *
 * (공정을 가로지르는 검사라 어느 레이어에도 속하지 않는 `src/__tests__` 에 둔다.)
 */

/** 화면·엔티티가 고른 의미. 왼쪽 사람 말이 오른쪽 의미와 같아야 한다 */
const CLAIMS: [label: string, actual: StatusMeaning, expected: StatusMeaning][] = [
  ['정반 재실(야드·조립) = 작업이 도는 중', LOCATION_STATUS_META.occupied.meaning, 'inProgress'],
  ['정반 미확인 = 확인이 필요함', LOCATION_STATUS_META.unknown.meaning, 'warning'],
  ['정반 공석 = 뜻 없음', LOCATION_STATUS_META.empty.meaning, 'idle'],
  ['의장 블록 작업중', OUTFITTING_STATUS_META.in_progress.meaning, 'inProgress'],
  ['의장 블록 완료', OUTFITTING_STATUS_META.completed.meaning, 'done'],
  ['의장 블록 대기', OUTFITTING_STATUS_META.waiting.meaning, 'idle'],
  ['공정존 점검 정상', ZONE_CHECK_META.ok.meaning, 'done'],
  ['공정존 점검 주의', ZONE_CHECK_META.warn.meaning, 'warning'],
  ['공정존 점검 불량', ZONE_CHECK_META.fail.meaning, 'error'],
  ['공정존 건전성 양호', ZONE_HEALTH_MEANING.healthy, 'done'],
  ['공정존 건전성 불량', ZONE_HEALTH_MEANING.unhealthy, 'error'],
]

describe('상태 색 의미 — 화면이 달라도 뜻은 하나', () => {
  it.each(CLAIMS)('%s', (_label, actual, expected) => {
    expect(actual).toBe(expected)
  })

  it('의미를 고른 곳은 색도 팔레트에서 받는다 — 제 색을 따로 적어 두지 않는다', () => {
    expect(LOCATION_STATUS_META.occupied.dot).toBe(STATUS_STYLE.inProgress.fill)
    expect(LOCATION_STATUS_META.occupied.ink).toBe(STATUS_STYLE.inProgress.ink)
    expect(OUTFITTING_STATUS_META.completed.dot).toBe(STATUS_STYLE.done.fill)
    expect(ZONE_CHECK_META.fail.dotClass).toBe(STATUS_STYLE.error.fill)
  })

  it('야드 맵(캔버스)이 칠하는 정반 색이 목록·칩과 같은 색이다', () => {
    for (const theme of ['light', 'dark'] as const) {
      const palette = paletteOf(theme)
      expect(bayColor('occupied', palette)).toBe(STATUS_HEX[theme].inProgress)
      expect(bayColor('empty', palette)).toBe(STATUS_HEX[theme].idle)
    }
  })

  it('작업중이 완료와 같은 색이 아니고, 이상과도 같은 색이 아니다', () => {
    for (const theme of ['light', 'dark'] as const) {
      const hex = STATUS_HEX[theme]
      expect(hex.inProgress).not.toBe(hex.done)
      expect(hex.inProgress).not.toBe(hex.error)
    }
  })
})
