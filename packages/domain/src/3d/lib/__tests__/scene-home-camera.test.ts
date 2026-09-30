import { describe, expect, it } from 'vitest';
import type { SavedSceneInfo } from '../../model/types';
import type { SavedSceneView } from '../../model/view-types';
import { resolveMainView, resolveSceneHomeCamera } from '../scene-home-camera';

function view(id: string): SavedSceneView {
  return { id, name: id, position: [1, 2, 3], target: [4, 5, 6] };
}

function scene(overrides: Partial<SavedSceneInfo> = {}): SavedSceneInfo {
  return {
    maps: [],
    models: [],
    texts: [],
    camera: { position: [9, 9, 9], target: [0, 0, 0] },
    ...overrides,
  };
}

describe('resolveMainView', () => {
  it('region 슬롯이 가리키는 뷰를 돌려준다 — 다른 region 슬롯은 무시', () => {
    const s = scene({
      views: [view('a'), view('b')],
      mainViewByRegion: { 'dock-1': 'a', 'dock-2': 'b' },
    });
    expect(resolveMainView(s, 'dock-1')?.id).toBe('a');
    expect(resolveMainView(s, 'dock-2')?.id).toBe('b');
    expect(resolveMainView(s, 'dock-9')).toBeNull();
  });

  it('씬 없음·슬롯 없음·깨진 참조(없는 뷰)는 null', () => {
    expect(resolveMainView(null, 'dock-1')).toBeNull();
    expect(resolveMainView(scene({ views: [view('a')] }), 'dock-1')).toBeNull();
    expect(
      resolveMainView(
        scene({ views: [view('a')], mainViewByRegion: { 'dock-1': 'zzz' } }),
        'dock-1',
      ),
    ).toBeNull();
  });
});

describe('resolveSceneHomeCamera', () => {
  it('메인 뷰가 있으면 그 구도이고, 뷰 객체 참조 그대로다(의존성 안정)', () => {
    const s = scene({
      views: [view('a')],
      mainViewByRegion: { 'dock-1': 'a' },
    });
    const home = resolveSceneHomeCamera(s, 'dock-1');
    expect(home).toMatchObject({ position: [1, 2, 3], target: [4, 5, 6] });
    expect(home).toBe(s.views![0]);
    expect(resolveSceneHomeCamera(s, 'dock-1')).toBe(home);
  });

  it('폴백은 camera 객체 참조 그대로다', () => {
    const s = scene();
    expect(resolveSceneHomeCamera(s, 'dock-1')).toBe(s.camera);
  });

  it('메인 뷰가 없거나 깨졌으면 저장 시점 카메라(camera)로 폴백', () => {
    expect(resolveSceneHomeCamera(scene(), 'dock-1')).toEqual({
      position: [9, 9, 9],
      target: [0, 0, 0],
    });
    expect(
      resolveSceneHomeCamera(
        scene({ views: [view('a')], mainViewByRegion: { 'dock-1': 'zzz' } }),
        'dock-1',
      ),
    ).toEqual({ position: [9, 9, 9], target: [0, 0, 0] });
  });

  it('camera 도 없으면 null, 씬이 없어도 null', () => {
    expect(
      resolveSceneHomeCamera(scene({ camera: null }), 'dock-1'),
    ).toBeNull();
    expect(resolveSceneHomeCamera(undefined, 'dock-1')).toBeNull();
  });
});
