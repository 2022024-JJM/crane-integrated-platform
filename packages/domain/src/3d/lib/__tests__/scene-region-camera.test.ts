import { describe, expect, it } from 'vitest';
import {
  resolveSceneCameraForRegion,
  withRegionCamera,
} from '../scene-region-camera';
import type { SavedCameraInfo, SavedSceneInfo } from '../../model/types';

/**
 * scene-file-map 의 실제 표를 전제로 한다: dock-1·dock-2 는 okpo.json 을
 * 공유하고 goliath 는 단독 파일이다.
 */
const SHARED_A = 'dock-1';
const SHARED_B = 'dock-2';
const SOLO = 'goliath';

const cam = (n: number): SavedCameraInfo => ({
  position: [n, n, n],
  target: [0, 0, 0],
});

function scene(overrides: Partial<SavedSceneInfo> = {}): SavedSceneInfo {
  return { maps: [], models: [], texts: [], camera: null, ...overrides };
}

describe('resolveSceneCameraForRegion', () => {
  it('자기 region 슬롯을 camera 로 넣는다', () => {
    const s = scene({
      camera: cam(9),
      cameraByRegion: { [SHARED_A]: cam(1), [SHARED_B]: cam(2) },
    });
    expect(resolveSceneCameraForRegion(s, SHARED_A).camera).toEqual(cam(1));
    expect(resolveSceneCameraForRegion(s, SHARED_B).camera).toEqual(cam(2));
  });

  it('슬롯이 없으면 camera 폴백 그대로 — 같은 참조를 돌려준다', () => {
    const s = scene({ camera: cam(9), cameraByRegion: { [SHARED_B]: cam(2) } });
    expect(resolveSceneCameraForRegion(s, SHARED_A)).toBe(s);
    const noSlots = scene({ camera: cam(9) });
    expect(resolveSceneCameraForRegion(noSlots, SHARED_A)).toBe(noSlots);
    const noCamera = scene();
    expect(resolveSceneCameraForRegion(noCamera, SHARED_A)).toBe(noCamera);
  });

  it('슬롯 맵은 그대로 둔다 — 저장 때 다른 region 슬롯이 살아야 한다', () => {
    const slots = { [SHARED_A]: cam(1), [SHARED_B]: cam(2) };
    const s = scene({ camera: cam(9), cameraByRegion: slots });
    expect(resolveSceneCameraForRegion(s, SHARED_A).cameraByRegion).toBe(slots);
  });

  it('camera 가 이미 슬롯과 같은 참조면 같은 씬 참조', () => {
    const c = cam(1);
    const s = scene({ camera: c, cameraByRegion: { [SHARED_A]: c } });
    expect(resolveSceneCameraForRegion(s, SHARED_A)).toBe(s);
  });
});

describe('withRegionCamera — 공유 파일', () => {
  it('자기 슬롯과 camera 를 쓰고 다른 region 슬롯은 보존한다', () => {
    const s = scene({
      camera: cam(9),
      cameraByRegion: { [SHARED_A]: cam(1), [SHARED_B]: cam(2) },
    });
    const out = withRegionCamera(s, SHARED_A, cam(5));
    expect(out.camera).toEqual(cam(5));
    expect(out.cameraByRegion).toEqual({
      [SHARED_A]: cam(5),
      [SHARED_B]: cam(2),
    });
    // 입력은 건드리지 않는다.
    expect(s.cameraByRegion![SHARED_A]).toEqual(cam(1));
  });

  it('슬롯 맵이 없던 씬에도 새로 만든다', () => {
    const out = withRegionCamera(scene(), SHARED_A, cam(5));
    expect(out.cameraByRegion).toEqual({ [SHARED_A]: cam(5) });
    expect(out.camera).toEqual(cam(5));
  });

  it('null 카메라는 자기 슬롯을 지우고, 마지막 슬롯이면 필드를 뺀다', () => {
    const s = scene({
      camera: cam(9),
      cameraByRegion: { [SHARED_A]: cam(1), [SHARED_B]: cam(2) },
    });
    const out = withRegionCamera(s, SHARED_A, null);
    expect(out.camera).toBeNull();
    expect(out.cameraByRegion).toEqual({ [SHARED_B]: cam(2) });
    const last = withRegionCamera(out, SHARED_B, null);
    expect('cameraByRegion' in last).toBe(false);
  });
});

describe('withRegionCamera — 단독 파일', () => {
  it('camera 만 쓰고 cameraByRegion 은 제거한다', () => {
    const s = scene({
      camera: cam(9),
      cameraByRegion: { [SHARED_A]: cam(1) },
    });
    const out = withRegionCamera(s, SOLO, cam(5));
    expect(out.camera).toEqual(cam(5));
    expect('cameraByRegion' in out).toBe(false);
  });

  it('미등록 region 도 단독으로 취급한다', () => {
    const out = withRegionCamera(scene(), 'nowhere', cam(5));
    expect(out.camera).toEqual(cam(5));
    expect('cameraByRegion' in out).toBe(false);
  });
});
