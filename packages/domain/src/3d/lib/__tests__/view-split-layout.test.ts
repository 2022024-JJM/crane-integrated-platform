import { describe, expect, it } from 'vitest';
import type { SavedSceneView } from '../../model/view-types';
import { resolveSplitLayout, splitSlotPosition } from '../view-split-layout';

function view(id: string): SavedSceneView {
  return { id, name: id, position: [0, 10, 0], target: [0, 0, 0] };
}

const views = [view('a'), view('b'), view('c'), view('d')];

function tilesOf(slots: (string | null)[]) {
  const layout = resolveSplitLayout({ slots }, views);
  return layout
    ? {
        rows: layout.rows,
        cols: layout.cols,
        tiles: layout.tiles.map((t) => [t.slot, t.view.id, t.row, t.col]),
      }
    : null;
}

describe('splitSlotPosition', () => {
  it('칸 index 는 2열 격자의 행 우선이다 — 좌상·우상·좌하·우하', () => {
    expect(splitSlotPosition(0)).toEqual({ row: 0, col: 0 });
    expect(splitSlotPosition(1)).toEqual({ row: 0, col: 1 });
    expect(splitSlotPosition(2)).toEqual({ row: 1, col: 0 });
    expect(splitSlotPosition(3)).toEqual({ row: 1, col: 1 });
  });
});

describe('resolveSplitLayout — 분할 없음', () => {
  it('분할·뷰 목록이 없으면 null', () => {
    expect(resolveSplitLayout(undefined, views)).toBeNull();
    expect(resolveSplitLayout(null, views)).toBeNull();
    expect(resolveSplitLayout({ slots: ['a', 'b'] }, undefined)).toBeNull();
  });

  it('채운 칸이 2개 미만이면 null (0칸·1칸)', () => {
    expect(tilesOf([null, null, null, null])).toBeNull();
    expect(tilesOf(['a', null, null, null])).toBeNull();
  });

  it('존재하지 않는 뷰를 가리키는 칸은 빈 칸으로 본다', () => {
    expect(tilesOf(['a', 'zzz', null, null])).toBeNull();
    expect(tilesOf(['a', 'zzz', 'b', null])!.rows).toBe(2);
  });

  it('slots 가 배열이 아니면 null', () => {
    expect(
      resolveSplitLayout(
        { slots: 'ab' as unknown as (string | null)[] },
        views,
      ),
    ).toBeNull();
  });
});

describe('resolveSplitLayout — 빈 행·열 접기', () => {
  it('좌상·우상 → 좌우 2분할 (1행 2열)', () => {
    expect(tilesOf(['a', 'b', null, null])).toEqual({
      rows: 1,
      cols: 2,
      tiles: [
        [0, 'a', 0, 0],
        [1, 'b', 0, 1],
      ],
    });
  });

  it('좌하·우하만 채워도 좌우 2분할이고 행 index 는 0 으로 접힌다', () => {
    expect(tilesOf([null, null, 'a', 'b'])).toEqual({
      rows: 1,
      cols: 2,
      tiles: [
        [2, 'a', 0, 0],
        [3, 'b', 0, 1],
      ],
    });
  });

  it('좌상·좌하 → 상하 2분할 (2행 1열)', () => {
    expect(tilesOf(['a', null, 'b', null])).toEqual({
      rows: 2,
      cols: 1,
      tiles: [
        [0, 'a', 0, 0],
        [2, 'b', 1, 0],
      ],
    });
  });

  it('대각선 → 2×2 이고 두 칸이 빈다', () => {
    expect(tilesOf(['a', null, null, 'b'])).toEqual({
      rows: 2,
      cols: 2,
      tiles: [
        [0, 'a', 0, 0],
        [3, 'b', 1, 1],
      ],
    });
  });

  it('3칸 → 2×2 이고 한 칸이 빈다', () => {
    const layout = tilesOf(['a', 'b', 'c', null])!;
    expect(layout.rows).toBe(2);
    expect(layout.cols).toBe(2);
    expect(layout.tiles).toHaveLength(3);
  });

  it('4칸 → 2×2 전부 채움', () => {
    expect(tilesOf(['a', 'b', 'c', 'd'])).toEqual({
      rows: 2,
      cols: 2,
      tiles: [
        [0, 'a', 0, 0],
        [1, 'b', 0, 1],
        [2, 'c', 1, 0],
        [3, 'd', 1, 1],
      ],
    });
  });

  it('타일의 view 는 목록의 객체 참조 그대로다', () => {
    const layout = resolveSplitLayout({ slots: ['a', 'b'] }, views)!;
    expect(layout.tiles[0].view).toBe(views[0]);
  });
});
