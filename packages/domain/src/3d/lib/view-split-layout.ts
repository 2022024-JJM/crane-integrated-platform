import {
  SCENE_SPLIT_COLUMNS,
  SCENE_SPLIT_SLOT_COUNT,
  type SavedSceneView,
  type SavedViewSplit,
} from '../model/view-types';

/**
 * 분할 화면의 타일 한 장 — 접힌 격자에서의 위치와 그 칸의 뷰.
 */
export interface SplitTile {
  /** 원래 칸 index(0~3). 타일 key·에디터 칸 표시에 쓴다. */
  slot: number;
  view: SavedSceneView;
  row: number;
  col: number;
}

export interface SplitLayout {
  rows: number;
  cols: number;
  tiles: SplitTile[];
}

/** 칸 index → 2×2 격자의 (행, 열). */
export function splitSlotPosition(slot: number): { row: number; col: number } {
  return {
    row: Math.floor(slot / SCENE_SPLIT_COLUMNS),
    col: slot % SCENE_SPLIT_COLUMNS,
  };
}

/**
 * 저장된 분할 → 화면 배치. 채운 칸이 2개 미만이면 분할이 없다(null).
 *
 * 빈 행·빈 열은 접는다: 좌상·우상만 채우면 좌우 2분할, 좌상·좌하만 채우면
 * 상하 2분할, 대각선이나 3칸 이상이면 2×2 이고 남는 칸은 비어 있다.
 * 존재하지 않는 뷰를 가리키는 칸은 빈 칸으로 본다(sanitize 가 비우지만
 * 런타임에 뷰 목록과 분할이 따로 갱신되는 순간을 방어한다).
 */
export function resolveSplitLayout(
  split: SavedViewSplit | null | undefined,
  views: readonly SavedSceneView[] | undefined,
): SplitLayout | null {
  if (!split || !Array.isArray(split.slots) || !views) return null;
  const viewById = new Map(views.map((view) => [view.id, view]));
  const filled: Array<{ slot: number; view: SavedSceneView }> = [];
  for (let slot = 0; slot < SCENE_SPLIT_SLOT_COUNT; slot += 1) {
    const id = split.slots[slot];
    if (typeof id !== 'string') continue;
    const view = viewById.get(id);
    if (view) filled.push({ slot, view });
  }
  if (filled.length < 2) return null;

  const rowsUsed = new Set<number>();
  const colsUsed = new Set<number>();
  for (const { slot } of filled) {
    const { row, col } = splitSlotPosition(slot);
    rowsUsed.add(row);
    colsUsed.add(col);
  }
  const rowIndex = new Map([...rowsUsed].sort().map((row, i) => [row, i]));
  const colIndex = new Map([...colsUsed].sort().map((col, i) => [col, i]));

  return {
    rows: rowIndex.size,
    cols: colIndex.size,
    tiles: filled.map(({ slot, view }) => {
      const { row, col } = splitSlotPosition(slot);
      return {
        slot,
        view,
        row: rowIndex.get(row) ?? 0,
        col: colIndex.get(col) ?? 0,
      };
    }),
  };
}
