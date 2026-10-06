import { create } from 'zustand';
import {
  isRenderScale,
  readGraphicsSettings,
  writeGraphicsSettings,
  type RenderScale,
} from '../lib/graphics-settings-storage';

/**
 * 3D 화면 그래픽 설정의 React 상태 — 설정 페이지의 그래픽 카드가 바꾸고
 * localStorage `crane:graphics-settings`(lib/graphics-settings-storage)에
 * 영속된다. 씬·리전과 무관한 이 브라우저의 설정이다.
 *
 * 읽는 쪽은 캔버스의 dpr 을 정하는 use-scene-canvas-dpr 하나다.
 */
interface SceneGraphicsState {
  /** 3D 캔버스 해상도 배율. 1 이 기본(줄이지 않음). */
  renderScale: RenderScale;
  /** 목록에 없는 값과 같은 값 재설정은 no-op(상태 참조 유지, 저장 안 함). */
  setRenderScale: (scale: RenderScale) => void;
}

export const useSceneGraphicsStore = create<SceneGraphicsState>((set, get) => ({
  renderScale: readGraphicsSettings().renderScale,

  setRenderScale: (scale) => {
    if (!isRenderScale(scale) || scale === get().renderScale) return;
    set({ renderScale: scale });
    writeGraphicsSettings({ renderScale: scale });
  },
}));
