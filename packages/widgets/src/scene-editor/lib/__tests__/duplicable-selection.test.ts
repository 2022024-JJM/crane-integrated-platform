import { describe, expect, it } from 'vitest';
import type { SavedSceneInfo } from '@crane/domain/3d';
import { hasDuplicableSelection } from '../duplicable-selection';

const model = (id: string): SavedSceneInfo['models'][number] => ({
  id,
  equipName: id,
  path: '/a.glb',
  opacity: 1,
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  valueMapList: [],
});

const text = (id: string): NonNullable<SavedSceneInfo['texts']>[number] => ({
  id,
  content: 'T',
  color: '#fff',
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
});

const map = (id: string): SavedSceneInfo['maps'][number] => ({
  id,
  path: '/maps/a.glb',
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  locked: false,
});

function scene(overrides: Partial<SavedSceneInfo> = {}): SavedSceneInfo {
  return {
    maps: [map('map1'), map('map2')],
    models: [model('m1')],
    texts: [text('t1')],
    camera: null,
    ...overrides,
  };
}

const ids = (...list: string[]) => new Set(list);

describe('hasDuplicableSelection', () => {
  it('모델 또는 텍스트가 선택돼 있으면 true', () => {
    expect(hasDuplicableSelection(ids('m1'), scene())).toBe(true);
    expect(hasDuplicableSelection(ids('t1'), scene())).toBe(true);
  });

  it('지도만 선택돼 있으면 단일·복수 모두 false', () => {
    expect(hasDuplicableSelection(ids('map1'), scene())).toBe(false);
    expect(hasDuplicableSelection(ids('map1', 'map2'), scene())).toBe(false);
  });

  it('지도와 모델이 섞여 있으면(Ctrl+A) 모델 쪽 때문에 true', () => {
    expect(hasDuplicableSelection(ids('map1', 'map2', 'm1'), scene())).toBe(
      true,
    );
  });

  it('빈 선택·씬 없음은 false', () => {
    expect(hasDuplicableSelection(ids(), scene())).toBe(false);
    expect(hasDuplicableSelection(ids('m1'), null)).toBe(false);
  });

  it('씬에 없는 id 만 선택돼 있으면 false', () => {
    expect(hasDuplicableSelection(ids('ghost'), scene())).toBe(false);
  });

  it('texts 필드가 없는 씬도 모델 선택이면 true, 텍스트 id 면 false', () => {
    const noTexts = scene({ texts: undefined });
    expect(hasDuplicableSelection(ids('m1'), noTexts)).toBe(true);
    expect(hasDuplicableSelection(ids('t1'), noTexts)).toBe(false);
  });
});
