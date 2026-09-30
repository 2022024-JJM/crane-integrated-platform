import { describe, expect, it } from 'vitest';
import {
  SCENE_SPLIT_SLOT_COUNT,
  SCENE_VIEW_NAME_MAX,
  SCENE_VIEWS_MAX,
  type SavedSceneView,
} from '../../model/view-types';
import {
  sanitizeMainViewByRegion,
  sanitizeSceneViews,
  sanitizeViewSplit,
  sceneViewNameKey,
} from '../sanitize-views';

function view(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 'v1',
    name: 'N',
    position: [10, 20, 30],
    target: [0, 0, 0],
    ...overrides,
  };
}

function saved(id: string, name = id): SavedSceneView {
  return { id, name, position: [1, 2, 3], target: [0, 0, 0] };
}

describe('sceneViewNameKey', () => {
  it('앞뒤 공백과 대소문자를 무시한다', () => {
    expect(sceneViewNameKey('  Dock A ')).toBe('dock a');
  });
});

describe('sanitizeSceneViews — 컨테이너', () => {
  it('배열이 아니면 null (undefined·null·객체·문자열)', () => {
    expect(sanitizeSceneViews(undefined)).toBeNull();
    expect(sanitizeSceneViews(null)).toBeNull();
    expect(sanitizeSceneViews({ id: 'v1' })).toBeNull();
    expect(sanitizeSceneViews('views')).toBeNull();
  });

  it('빈 배열·전부 무효인 배열은 null — 필드를 생략한다', () => {
    expect(sanitizeSceneViews([])).toBeNull();
    expect(sanitizeSceneViews([null, 3, 'x', {}])).toBeNull();
  });

  it('정상 항목은 필드를 보존하고 알 수 없는 필드는 싣지 않는다', () => {
    const out = sanitizeSceneViews([view({ extra: 1 })]);
    expect(out).toEqual([
      { id: 'v1', name: 'N', position: [10, 20, 30], target: [0, 0, 0] },
    ]);
  });
});

describe('sanitizeSceneViews — 구도', () => {
  it('position·target 이 Vector3 가 아니면 항목을 버린다', () => {
    expect(sanitizeSceneViews([view({ position: [1, 2] })])).toBeNull();
    expect(sanitizeSceneViews([view({ target: null })])).toBeNull();
    expect(sanitizeSceneViews([view({ position: ['1', 2, 3] })])).toBeNull();
    expect(
      sanitizeSceneViews([view({ target: [0, Number.NaN, 0] })]),
    ).toBeNull();
    expect(
      sanitizeSceneViews([view({ position: [Infinity, 0, 0] })]),
    ).toBeNull();
  });
});

describe('sanitizeSceneViews — 이름', () => {
  it('문자열이 아니거나 공백뿐이면 버린다', () => {
    expect(sanitizeSceneViews([view({ name: 3 })])).toBeNull();
    expect(sanitizeSceneViews([view({ name: '   ' })])).toBeNull();
  });

  it('앞뒤 공백을 떼고 최대 길이로 자른다 (경계: 정확값 통과, +1 은 잘림)', () => {
    const exact = 'a'.repeat(SCENE_VIEW_NAME_MAX);
    expect(sanitizeSceneViews([view({ name: ` ${exact} ` })])![0].name).toBe(
      exact,
    );
    const over = 'b'.repeat(SCENE_VIEW_NAME_MAX + 1);
    expect(sanitizeSceneViews([view({ name: over })])![0].name).toBe(
      over.slice(0, SCENE_VIEW_NAME_MAX),
    );
  });

  it('같은 이름(공백·대소문자 무시)은 뒤의 것을 버린다', () => {
    const out = sanitizeSceneViews([
      view({ id: 'a', name: 'Dock' }),
      view({ id: 'b', name: ' dock ' }),
      view({ id: 'c', name: 'Quay' }),
    ]);
    expect(out!.map((v) => v.id)).toEqual(['a', 'c']);
  });
});

describe('sanitizeSceneViews — id·고정·개수', () => {
  it('id 가 없으면 발급하고, 같은 id 는 뒤의 것을 버린다', () => {
    const out = sanitizeSceneViews([
      view({ id: undefined, name: 'A' }),
      view({ id: 'dup', name: 'B' }),
      view({ id: 'dup', name: 'C' }),
    ]);
    expect(out).toHaveLength(2);
    expect(out![0].id.length).toBeGreaterThan(0);
    expect(out![1]).toMatchObject({ id: 'dup', name: 'B' });
  });

  it('pinned 는 true 만 남긴다 — 문자열·false 는 필드 자체가 빠진다', () => {
    expect(sanitizeSceneViews([view({ pinned: true })])![0].pinned).toBe(true);
    expect(
      sanitizeSceneViews([view({ pinned: 'yes' })])![0],
    ).not.toHaveProperty('pinned');
    expect(
      sanitizeSceneViews([view({ pinned: false })])![0],
    ).not.toHaveProperty('pinned');
  });

  it('최대 개수까지만 싣는다 (정확값 통과, +1 은 잘림)', () => {
    const exact = Array.from({ length: SCENE_VIEWS_MAX }, (_, i) =>
      view({ id: `v${i}`, name: `V${i}` }),
    );
    expect(sanitizeSceneViews(exact)).toHaveLength(SCENE_VIEWS_MAX);
    const over = [...exact, view({ id: 'extra', name: 'Extra' })];
    const out = sanitizeSceneViews(over)!;
    expect(out).toHaveLength(SCENE_VIEWS_MAX);
    expect(out.some((v) => v.id === 'extra')).toBe(false);
  });

  it('버려진 항목은 개수에 세지 않는다', () => {
    const items = [
      view({ id: 'bad', name: '' }),
      ...Array.from({ length: SCENE_VIEWS_MAX }, (_, i) =>
        view({ id: `v${i}`, name: `V${i}` }),
      ),
    ];
    expect(sanitizeSceneViews(items)).toHaveLength(SCENE_VIEWS_MAX);
  });
});

describe('sanitizeViewSplit — 컨테이너', () => {
  const views = [saved('a'), saved('b')];

  it('객체가 아니면 null (undefined·null·배열·문자열)', () => {
    expect(sanitizeViewSplit(undefined, views)).toBeNull();
    expect(sanitizeViewSplit(null, views)).toBeNull();
    expect(sanitizeViewSplit(['a'], views)).toBeNull();
    expect(sanitizeViewSplit('split', views)).toBeNull();
  });

  it('칸이 전부 비고 고정도 아니면 null — 필드를 생략한다', () => {
    expect(sanitizeViewSplit({ slots: [] }, views)).toBeNull();
    expect(sanitizeViewSplit({ slots: [null, null] }, views)).toBeNull();
    expect(sanitizeViewSplit({}, views)).toBeNull();
  });

  it('고정만 있고 칸이 비었어도 남긴다', () => {
    expect(sanitizeViewSplit({ pinned: true }, views)).toEqual({
      slots: [null, null, null, null],
      pinned: true,
    });
  });
});

describe('sanitizeViewSplit — 칸', () => {
  const views = [saved('a'), saved('b'), saved('c')];

  it('항상 칸 수 길이로 맞춘다 — 모자라면 빈 칸, 넘치면 자른다', () => {
    expect(sanitizeViewSplit({ slots: ['a'] }, views)!.slots).toEqual([
      'a',
      null,
      null,
      null,
    ]);
    const over = sanitizeViewSplit(
      { slots: ['a', null, null, null, 'b'] },
      views,
    )!;
    expect(over.slots).toHaveLength(SCENE_SPLIT_SLOT_COUNT);
    expect(over.slots).toEqual(['a', null, null, null]);
  });

  it('존재하지 않는 뷰·문자열이 아닌 값은 빈 칸이 된다', () => {
    expect(
      sanitizeViewSplit({ slots: ['zzz', 1, 'b', {}] }, views)!.slots,
    ).toEqual([null, null, 'b', null]);
  });

  it('같은 뷰가 두 칸에 있으면 뒤 칸을 비운다', () => {
    expect(
      sanitizeViewSplit({ slots: ['a', 'a', 'b', 'a'] }, views)!.slots,
    ).toEqual(['a', null, 'b', null]);
  });

  it('뷰 목록이 비면 칸도 전부 비어 null', () => {
    expect(sanitizeViewSplit({ slots: ['a', 'b'] }, [])).toBeNull();
  });

  it('pinned 는 true 만 남긴다', () => {
    expect(
      sanitizeViewSplit({ slots: ['a'], pinned: 'yes' }, views),
    ).not.toHaveProperty('pinned');
    expect(
      sanitizeViewSplit({ slots: ['a'], pinned: true }, views)!.pinned,
    ).toBe(true);
  });
});

describe('sanitizeMainViewByRegion', () => {
  const views = [saved('a'), saved('b')];

  it('객체가 아니면 null (undefined·null·배열·문자열)', () => {
    expect(sanitizeMainViewByRegion(undefined, views)).toBeNull();
    expect(sanitizeMainViewByRegion(null, views)).toBeNull();
    expect(sanitizeMainViewByRegion(['a'], views)).toBeNull();
    expect(sanitizeMainViewByRegion('a', views)).toBeNull();
  });

  it('존재하는 뷰를 가리키는 region 만 남기고, 남는 게 없으면 null', () => {
    expect(
      sanitizeMainViewByRegion(
        { 'dock-1': 'a', 'dock-2': 'zzz', '': 'b', 'dock-3': 3 },
        views,
      ),
    ).toEqual({ 'dock-1': 'a' });
    expect(sanitizeMainViewByRegion({ 'dock-1': 'zzz' }, views)).toBeNull();
    expect(sanitizeMainViewByRegion({}, views)).toBeNull();
    expect(sanitizeMainViewByRegion({ 'dock-1': 'a' }, [])).toBeNull();
  });
});
