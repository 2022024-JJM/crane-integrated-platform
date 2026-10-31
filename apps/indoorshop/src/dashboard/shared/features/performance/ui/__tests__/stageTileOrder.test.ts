import { describe, expect, it } from 'vitest'
import { defaultTileRows, dropOnTile, moveByKey, moveToNewRow } from '../stageTileOrder'

describe('가공 탭 카드 배치 — 줄의 목록', () => {
  it('기본은 작은 칸 셋이 한 줄, 적치 · 가공 판이 한 줄씩', () => {
    expect(defaultTileRows()).toEqual([['sections', 'legacy', 'overall'], ['stack'], ['fab']])
  })

  it('줄 사이에 놓으면 그 칸 혼자 새 줄을 쓴다 — 맨 위 · 사이 · 맨 아래', () => {
    const rows = defaultTileRows()
    expect(moveToNewRow(rows, 'overall', 0)).toEqual([['overall'], ['sections', 'legacy'], ['stack'], ['fab']])
    expect(moveToNewRow(rows, 'legacy', 2)).toEqual([['sections', 'overall'], ['stack'], ['legacy'], ['fab']])
    expect(moveToNewRow(rows, 'sections', 3)).toEqual([['legacy', 'overall'], ['stack'], ['fab'], ['sections']])
    /* 혼자 쓰던 줄에서 떠나면 빈 줄은 걷히고 자리가 당겨진다 */
    expect(moveToNewRow(rows, 'stack', 3)).toEqual([['sections', 'legacy', 'overall'], ['fab'], ['stack']])
  })

  it('작은 칸을 작은 칸 위에 놓으면 그 줄에 합류하고, 꽉 찬 줄이면 둘이 자리를 바꾼다', () => {
    const split = moveToNewRow(defaultTileRows(), 'overall', 1)
    expect(split).toEqual([['sections', 'legacy'], ['overall'], ['stack'], ['fab']])
    expect(dropOnTile(split, 'overall', 'sections')).toEqual([['overall', 'sections', 'legacy'], ['stack'], ['fab']])
    const lone = [['sections', 'legacy', 'overall'], ['stack'], ['fab']].map((r) => [...r]) as ReturnType<typeof defaultTileRows>
    expect(dropOnTile(lone, 'legacy', 'overall')).toEqual([['sections', 'overall', 'legacy'], ['stack'], ['fab']])
  })

  it('넓은 칸이 끼면 끈 칸이 그 줄 자리에 혼자 선다', () => {
    expect(dropOnTile(defaultTileRows(), 'fab', 'legacy')).toEqual([['fab'], ['sections', 'legacy', 'overall'], ['stack']])
    expect(dropOnTile(defaultTileRows(), 'overall', 'fab')).toEqual([['sections', 'legacy'], ['stack'], ['fab'], ['overall']])
  })

  it('키보드 — ← → 는 줄 안에서, ↑ ↓ 는 떼어 새 줄로 · 혼자면 옆 줄에 합류하거나 줄째 자리를 바꾼다', () => {
    const rows = defaultTileRows()
    expect(moveByKey(rows, 'legacy', 'right')).toEqual([['sections', 'overall', 'legacy'], ['stack'], ['fab']])
    const down = moveByKey(rows, 'overall', 'down')
    expect(down).toEqual([['sections', 'legacy'], ['overall'], ['stack'], ['fab']])
    expect(moveByKey(down, 'overall', 'up')).toEqual([['sections', 'legacy', 'overall'], ['stack'], ['fab']])
    expect(moveByKey(rows, 'fab', 'up')).toEqual([['sections', 'legacy', 'overall'], ['fab'], ['stack']])
  })
})
