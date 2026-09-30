import { describe, expect, it } from 'vitest';
import {
  SCENE_VIEW_NAME_MAX,
  SCENE_VIEWS_MAX,
  type SavedCameraInfo,
  type SavedSceneInfo,
  type SavedSceneView,
} from '@crane/domain/3d';
import {
  isSceneViewLimitReached,
  validateSceneViewName,
  withMainView,
  withSceneViewAdded,
  withSceneViewMoved,
  withSceneViewPinned,
  withSceneViewPose,
  withSceneViewRemoved,
  withSceneViewRenamed,
  withSplitPinned,
  withSplitSlot,
} from '../view-editor';

function view(
  id: string,
  overrides: Partial<SavedSceneView> = {},
): SavedSceneView {
  return {
    id,
    name: id.toUpperCase(),
    position: [1, 2, 3],
    target: [0, 0, 0],
    ...overrides,
  };
}

function scene(overrides: Partial<SavedSceneInfo> = {}): SavedSceneInfo {
  return { maps: [], models: [], texts: [], camera: null, ...overrides };
}

const pose: SavedCameraInfo = { position: [10, 20, 30], target: [1, 1, 1] };
const pose2: SavedCameraInfo = { position: [5, 5, 5], target: [0, 0, 0] };

describe('validateSceneViewName', () => {
  it('빈 이름·공백뿐은 empty', () => {
    expect(validateSceneViewName([], '')).toBe('empty');
    expect(validateSceneViewName([], '   ')).toBe('empty');
  });

  it('최대 길이 정확값은 통과, +1 은 tooLong (앞뒤 공백은 제외)', () => {
    expect(
      validateSceneViewName([], 'a'.repeat(SCENE_VIEW_NAME_MAX)),
    ).toBeNull();
    expect(
      validateSceneViewName([], ` ${'a'.repeat(SCENE_VIEW_NAME_MAX)} `),
    ).toBeNull();
    expect(validateSceneViewName([], 'a'.repeat(SCENE_VIEW_NAME_MAX + 1))).toBe(
      'tooLong',
    );
  });

  it('같은 이름(공백·대소문자 무시)은 duplicate, 자기 자신은 제외한다', () => {
    const views = [view('a', { name: 'Dock' })];
    expect(validateSceneViewName(views, ' dock ')).toBe('duplicate');
    expect(validateSceneViewName(views, ' dock ', 'a')).toBeNull();
    expect(validateSceneViewName(undefined, 'Dock')).toBeNull();
  });
});

describe('isSceneViewLimitReached', () => {
  it('정확값이면 도달, 하나 적으면 아직', () => {
    const full = Array.from({ length: SCENE_VIEWS_MAX }, (_, i) =>
      view(`v${i}`),
    );
    expect(isSceneViewLimitReached(full)).toBe(true);
    expect(isSceneViewLimitReached(full.slice(1))).toBe(false);
    expect(isSceneViewLimitReached(undefined)).toBe(false);
  });
});

describe('withSceneViewAdded', () => {
  it('이름을 다듬어 목록 끝에 붙인다', () => {
    const out = withSceneViewAdded(scene(), 'new', '  N  ', pose);
    expect(out.views).toEqual([
      { id: 'new', name: 'N', position: pose.position, target: pose.target },
    ]);
  });

  it('무효한 이름·중복 이름·중복 id·최대 개수면 같은 참조를 돌려준다', () => {
    const base = scene({ views: [view('a', { name: 'A' })] });
    expect(withSceneViewAdded(base, 'b', '', pose)).toBe(base);
    expect(withSceneViewAdded(base, 'b', ' a ', pose)).toBe(base);
    expect(withSceneViewAdded(base, 'a', 'Other', pose)).toBe(base);
    const full = scene({
      views: Array.from({ length: SCENE_VIEWS_MAX }, (_, i) => view(`v${i}`)),
    });
    expect(withSceneViewAdded(full, 'x', 'X', pose)).toBe(full);
  });
});

describe('withSceneViewRenamed', () => {
  it('이름을 바꾸고 다른 뷰는 참조를 유지한다', () => {
    const a = view('a');
    const b = view('b');
    const out = withSceneViewRenamed(scene({ views: [a, b] }), 'a', ' New ');
    expect(out.views![0]).toEqual({ ...a, name: 'New' });
    expect(out.views![1]).toBe(b);
  });

  it('없는 id·같은 이름·무효 이름은 같은 참조', () => {
    const base = scene({
      views: [view('a', { name: 'A' }), view('b', { name: 'B' })],
    });
    expect(withSceneViewRenamed(base, 'zzz', 'X')).toBe(base);
    expect(withSceneViewRenamed(base, 'a', ' A ')).toBe(base);
    expect(withSceneViewRenamed(base, 'a', 'b')).toBe(base);
    expect(withSceneViewRenamed(base, 'a', '')).toBe(base);
  });
});

describe('withSceneViewPose', () => {
  it('구도를 바꾸고 이름·고정은 유지한다', () => {
    const base = scene({ views: [view('a', { pinned: true })] });
    const out = withSceneViewPose(base, 'a', pose2);
    expect(out.views![0]).toEqual({
      ...view('a', { pinned: true }),
      position: pose2.position,
      target: pose2.target,
    });
  });

  it('같은 구도·없는 id 는 같은 참조', () => {
    const base = scene({ views: [view('a')] });
    expect(
      withSceneViewPose(base, 'a', { position: [1, 2, 3], target: [0, 0, 0] }),
    ).toBe(base);
    expect(withSceneViewPose(base, 'zzz', pose2)).toBe(base);
  });
});

describe('withSceneViewRemoved', () => {
  it('뷰를 지우고 마지막 뷰를 지우면 views 필드가 빠진다', () => {
    const out = withSceneViewRemoved(scene({ views: [view('a')] }), 'a');
    expect(out).not.toHaveProperty('views');
  });

  it('그 뷰가 든 분할 칸을 비우고, 칸이 전부 비면 분할 필드가 빠진다', () => {
    const base = scene({
      views: [view('a'), view('b')],
      viewSplit: { slots: ['a', 'b', null, null] },
    });
    const one = withSceneViewRemoved(base, 'a');
    expect(one.viewSplit).toEqual({ slots: [null, 'b', null, null] });
    const none = withSceneViewRemoved(one, 'b');
    expect(none).not.toHaveProperty('viewSplit');
  });

  it('고정된 분할은 칸이 전부 비어도 남는다', () => {
    const base = scene({
      views: [view('a')],
      viewSplit: { slots: ['a', null, null, null], pinned: true },
    });
    expect(withSceneViewRemoved(base, 'a').viewSplit).toEqual({
      slots: [null, null, null, null],
      pinned: true,
    });
  });

  it('없는 id 는 같은 참조', () => {
    const base = scene({ views: [view('a')] });
    expect(withSceneViewRemoved(base, 'zzz')).toBe(base);
  });
});

describe('withSceneViewPinned', () => {
  it('고정은 true 만 싣고 해제하면 필드가 빠진다', () => {
    const base = scene({ views: [view('a')] });
    const on = withSceneViewPinned(base, 'a', true);
    expect(on.views![0].pinned).toBe(true);
    const off = withSceneViewPinned(on, 'a', false);
    expect(off.views![0]).not.toHaveProperty('pinned');
  });

  it('같은 상태 재설정·없는 id 는 같은 참조', () => {
    const base = scene({ views: [view('a')] });
    expect(withSceneViewPinned(base, 'a', false)).toBe(base);
    expect(withSceneViewPinned(base, 'zzz', true)).toBe(base);
  });
});

describe('withSplitSlot', () => {
  const base = scene({ views: [view('a'), view('b')] });

  it('빈 분할에 뷰를 놓으면 칸 수 길이의 slots 가 생긴다', () => {
    expect(withSplitSlot(base, 1, 'a').viewSplit).toEqual({
      slots: [null, 'a', null, null],
    });
  });

  it('같은 뷰를 다른 칸에 놓으면 이동한다', () => {
    const placed = withSplitSlot(base, 0, 'a');
    expect(withSplitSlot(placed, 3, 'a').viewSplit!.slots).toEqual([
      null,
      null,
      null,
      'a',
    ]);
  });

  it('찬 칸에 다른 뷰를 놓으면 교체한다', () => {
    const placed = withSplitSlot(base, 0, 'a');
    expect(withSplitSlot(placed, 0, 'b').viewSplit!.slots).toEqual([
      'b',
      null,
      null,
      null,
    ]);
  });

  it('칸을 비우면 마지막 칸일 때 분할 필드가 빠진다 (고정이면 남는다)', () => {
    const placed = withSplitSlot(base, 0, 'a');
    expect(withSplitSlot(placed, 0, null)).not.toHaveProperty('viewSplit');
    const pinned = withSplitPinned(placed, true);
    expect(withSplitSlot(pinned, 0, null).viewSplit).toEqual({
      slots: [null, null, null, null],
      pinned: true,
    });
  });

  it('범위 밖 칸·없는 뷰·같은 값 재설정은 같은 참조', () => {
    expect(withSplitSlot(base, -1, 'a')).toBe(base);
    expect(withSplitSlot(base, 4, 'a')).toBe(base);
    expect(withSplitSlot(base, 1.5, 'a')).toBe(base);
    expect(withSplitSlot(base, 0, 'zzz')).toBe(base);
    expect(withSplitSlot(base, 0, null)).toBe(base);
    const placed = withSplitSlot(base, 0, 'a');
    expect(withSplitSlot(placed, 0, 'a')).toBe(placed);
  });

  it('길이가 모자란 저장본 slots 도 칸 수로 맞춰 놓는다', () => {
    const short = scene({ views: [view('a')], viewSplit: { slots: ['a'] } });
    expect(withSplitSlot(short, 3, 'a').viewSplit!.slots).toEqual([
      null,
      null,
      null,
      'a',
    ]);
  });
});

describe('withSplitPinned', () => {
  it('칸 없이 고정만 켜면 빈 칸 분할이 생기고, 끄면 필드가 빠진다', () => {
    const on = withSplitPinned(scene(), true);
    expect(on.viewSplit).toEqual({
      slots: [null, null, null, null],
      pinned: true,
    });
    expect(withSplitPinned(on, false)).not.toHaveProperty('viewSplit');
  });

  it('칸이 있으면 끄더라도 칸은 남고 pinned 필드만 빠진다', () => {
    const base = scene({
      views: [view('a')],
      viewSplit: { slots: ['a', null, null, null], pinned: true },
    });
    expect(withSplitPinned(base, false).viewSplit).toEqual({
      slots: ['a', null, null, null],
    });
  });

  it('같은 상태 재설정은 같은 참조', () => {
    const base = scene();
    expect(withSplitPinned(base, false)).toBe(base);
    const on = withSplitPinned(base, true);
    expect(withSplitPinned(on, true)).toBe(on);
  });
});

describe('withSceneViewMoved', () => {
  const base = scene({ views: [view('a'), view('b'), view('c')] });
  const order = (s: SavedSceneInfo) => (s.views ?? []).map((v) => v.id);

  it('앞으로 옮기기 — insertBefore 는 현재 목록 기준이다', () => {
    expect(order(withSceneViewMoved(base, 'c', 0))).toEqual(['c', 'a', 'b']);
    expect(order(withSceneViewMoved(base, 'c', 1))).toEqual(['a', 'c', 'b']);
  });

  it('뒤로 옮기기 — 자기 자리를 뺀 뒤 끼운다', () => {
    expect(order(withSceneViewMoved(base, 'a', 2))).toEqual(['b', 'a', 'c']);
    expect(order(withSceneViewMoved(base, 'a', 3))).toEqual(['b', 'c', 'a']);
  });

  it('자기 앞·자기 바로 뒤는 제자리라 같은 참조', () => {
    expect(withSceneViewMoved(base, 'b', 1)).toBe(base);
    expect(withSceneViewMoved(base, 'b', 2)).toBe(base);
  });

  it('범위 밖은 양끝으로 클램프하고, 없는 id·정수 아님은 같은 참조', () => {
    expect(order(withSceneViewMoved(base, 'a', 99))).toEqual(['b', 'c', 'a']);
    expect(order(withSceneViewMoved(base, 'c', -5))).toEqual(['c', 'a', 'b']);
    expect(withSceneViewMoved(base, 'zzz', 0)).toBe(base);
    expect(withSceneViewMoved(base, 'a', 1.5)).toBe(base);
  });

  it('다른 뷰 객체와 분할 칸은 그대로다', () => {
    const withSplit = scene({
      views: [view('a'), view('b')],
      viewSplit: { slots: ['a', 'b', null, null] },
    });
    const moved = withSceneViewMoved(withSplit, 'b', 0);
    expect(moved.views![1]).toBe(withSplit.views![0]);
    expect(moved.viewSplit).toBe(withSplit.viewSplit);
  });
});

describe('withMainView', () => {
  const base = scene({ views: [view('a'), view('b')] });

  it('region 슬롯에 뷰를 지정하고 다른 region 은 건드리지 않는다', () => {
    const one = withMainView(base, 'dock-1', 'a');
    expect(one.mainViewByRegion).toEqual({ 'dock-1': 'a' });
    const two = withMainView(one, 'dock-2', 'b');
    expect(two.mainViewByRegion).toEqual({ 'dock-1': 'a', 'dock-2': 'b' });
    expect(withMainView(two, 'dock-1', 'b').mainViewByRegion).toEqual({
      'dock-1': 'b',
      'dock-2': 'b',
    });
  });

  it('비우면 그 region 만 빠지고, 마지막 슬롯이 빠지면 필드가 사라진다', () => {
    const two = withMainView(withMainView(base, 'dock-1', 'a'), 'dock-2', 'b');
    const one = withMainView(two, 'dock-1', null);
    expect(one.mainViewByRegion).toEqual({ 'dock-2': 'b' });
    expect(withMainView(one, 'dock-2', null)).not.toHaveProperty(
      'mainViewByRegion',
    );
  });

  it('없는 뷰·빈 region·같은 값 재설정은 같은 참조', () => {
    expect(withMainView(base, 'dock-1', 'zzz')).toBe(base);
    expect(withMainView(base, '', 'a')).toBe(base);
    expect(withMainView(base, 'dock-1', null)).toBe(base);
    const set = withMainView(base, 'dock-1', 'a');
    expect(withMainView(set, 'dock-1', 'a')).toBe(set);
  });

  it('뷰를 지우면 그 뷰를 가리키던 region 슬롯이 빈다', () => {
    const two = withMainView(withMainView(base, 'dock-1', 'a'), 'dock-2', 'b');
    const removed = withSceneViewRemoved(two, 'a');
    expect(removed.mainViewByRegion).toEqual({ 'dock-2': 'b' });
    expect(withSceneViewRemoved(removed, 'b')).not.toHaveProperty(
      'mainViewByRegion',
    );
  });
});
