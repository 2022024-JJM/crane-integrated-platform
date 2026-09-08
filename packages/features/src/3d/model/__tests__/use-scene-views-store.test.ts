// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  SCENE_VIEWS_MAX,
  SCENE_VIEW_NAME_MAX,
  useSceneViewsStore,
} from '../use-scene-views-store';

const REGION = 'dock-1';
const KEY = `crane:scene-views:${REGION}`;

const pose = {
  position: [1, 2, 3] as [number, number, number],
  target: [0, 0, 0] as [number, number, number],
};

function storedViews(): unknown {
  const raw = window.localStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : null;
}

beforeEach(() => {
  window.localStorage.clear();
  useSceneViewsStore.setState({ viewsByRegion: {}, hydratedRegions: {} });
});

describe('hydrate', () => {
  it('저장소의 유효 항목만 읽어 들인다 (손상 항목은 조용히 버림)', () => {
    const valid = {
      id: 'v1',
      name: 'Dock view',
      position: [1, 2, 3],
      target: [0, 0, 0],
      createdAt: 1,
    };
    window.localStorage.setItem(
      KEY,
      JSON.stringify([
        valid,
        { ...valid, id: 'v2', name: '' }, // 빈 이름
        { ...valid, id: 'v3', position: [1, 2] }, // 벡터 손상
        { ...valid, id: 4 }, // id 타입 오류
        'garbage',
      ]),
    );

    useSceneViewsStore.getState().hydrate(REGION);
    const views = useSceneViewsStore.getState().viewsByRegion[REGION];
    expect(views.map((v) => v.id)).toEqual(['v1']);
  });

  it('배열이 아닌 저장값은 빈 목록', () => {
    window.localStorage.setItem(KEY, JSON.stringify({ nope: true }));
    useSceneViewsStore.getState().hydrate(REGION);
    expect(useSceneViewsStore.getState().viewsByRegion[REGION]).toEqual([]);
  });

  it('최대 개수 초과분은 잘라낸다', () => {
    const entries = Array.from({ length: SCENE_VIEWS_MAX + 3 }, (_, i) => ({
      id: `v${i}`,
      name: `view ${i}`,
      position: [0, 0, 0],
      target: [0, 0, 0],
      createdAt: i,
    }));
    window.localStorage.setItem(KEY, JSON.stringify(entries));
    useSceneViewsStore.getState().hydrate(REGION);
    expect(
      useSceneViewsStore.getState().viewsByRegion[REGION],
    ).toHaveLength(SCENE_VIEWS_MAX);
  });

  it('같은 region은 한 번만 hydrate한다', () => {
    window.localStorage.setItem(KEY, JSON.stringify([]));
    useSceneViewsStore.getState().hydrate(REGION);

    const valid = {
      id: 'late',
      name: 'Late',
      position: [0, 0, 0],
      target: [0, 0, 0],
      createdAt: 1,
    };
    window.localStorage.setItem(KEY, JSON.stringify([valid]));
    useSceneViewsStore.getState().hydrate(REGION);
    expect(useSceneViewsStore.getState().viewsByRegion[REGION]).toEqual([]);
  });
});

describe('addView', () => {
  it('추가에 성공하면 true, localStorage에도 영속화한다', () => {
    const ok = useSceneViewsStore.getState().addView(REGION, '  Dock view  ', pose);
    expect(ok).toBe(true);

    const views = useSceneViewsStore.getState().viewsByRegion[REGION];
    expect(views).toHaveLength(1);
    expect(views[0].name).toBe('Dock view'); // 트림된 이름
    expect(views[0].position).toEqual(pose.position);
    expect(storedViews()).toEqual(JSON.parse(JSON.stringify(views)));
  });

  it('빈 이름·최대 길이 초과는 거부한다', () => {
    const { addView } = useSceneViewsStore.getState();
    expect(addView(REGION, '   ', pose)).toBe(false);
    expect(addView(REGION, 'x'.repeat(SCENE_VIEW_NAME_MAX + 1), pose)).toBe(false);
    expect(addView(REGION, 'x'.repeat(SCENE_VIEW_NAME_MAX), pose)).toBe(true);
  });

  it('이름 중복은 대소문자 무관하게 거부한다', () => {
    const { addView } = useSceneViewsStore.getState();
    expect(addView(REGION, 'Dock View', pose)).toBe(true);
    expect(addView(REGION, 'dock view', pose)).toBe(false);
  });

  it('최대 개수를 넘으면 거부한다', () => {
    const { addView } = useSceneViewsStore.getState();
    for (let i = 0; i < SCENE_VIEWS_MAX; i++) {
      expect(addView(REGION, `view ${i}`, pose)).toBe(true);
    }
    expect(addView(REGION, 'one more', pose)).toBe(false);
  });

  it('region끼리는 독립이다', () => {
    const { addView } = useSceneViewsStore.getState();
    addView(REGION, 'Same name', pose);
    expect(addView('dock-2', 'Same name', pose)).toBe(true);
  });
});

describe('removeView', () => {
  it('id로 지우고 영속화한다', () => {
    useSceneViewsStore.getState().addView(REGION, 'A', pose);
    useSceneViewsStore.getState().addView(REGION, 'B', pose);
    const [a] = useSceneViewsStore.getState().viewsByRegion[REGION];

    useSceneViewsStore.getState().removeView(REGION, a.id);
    const views = useSceneViewsStore.getState().viewsByRegion[REGION];
    expect(views.map((v) => v.name)).toEqual(['B']);
    expect(storedViews()).toEqual(JSON.parse(JSON.stringify(views)));
  });

  it('없는 id는 no-op — 저장소도 건드리지 않는다', () => {
    useSceneViewsStore.getState().addView(REGION, 'A', pose);
    const before = window.localStorage.getItem(KEY);
    useSceneViewsStore.getState().removeView(REGION, 'missing');
    expect(window.localStorage.getItem(KEY)).toBe(before);
    expect(useSceneViewsStore.getState().viewsByRegion[REGION]).toHaveLength(1);
  });
});
