import { create } from 'zustand';
import { getStorageItem, setStorageItem } from '@crane/core/lib/safe-storage';

/**
 * 위험 비네트(ui/scene-danger-vignette.tsx) 표시 여부 — 관제 HUD 펼침 목록의
 * 토글이 바꾼다. 리전 무관 전역 설정이고 localStorage 에 영속한다(미니맵
 * 표시 여부와 같은 계열 `crane:<feature>`). 기본 켜짐. 충돌·영역 침범
 * 비네트는 이 설정과 무관하다.
 */
export const DANGER_VIGNETTE_STORAGE_KEY =
  'crane:scene-danger-vignette:enabled';
export const DANGER_VIGNETTE_DEFAULT = true;

export function readDangerVignetteEnabled(): boolean {
  const raw = getStorageItem(DANGER_VIGNETTE_STORAGE_KEY);
  if (raw === null) return DANGER_VIGNETTE_DEFAULT;
  return raw === '1';
}

export function writeDangerVignetteEnabled(enabled: boolean): void {
  setStorageItem(DANGER_VIGNETTE_STORAGE_KEY, enabled ? '1' : '0');
}

interface DangerVignetteState {
  enabled: boolean;
  /** 같은 값이면 no-op(참조 유지). */
  setEnabled: (enabled: boolean) => void;
  toggle: () => void;
}

export const useDangerVignetteStore = create<DangerVignetteState>()(
  (set, get) => ({
    enabled: readDangerVignetteEnabled(),
    setEnabled: (enabled) => {
      if (get().enabled === enabled) return;
      writeDangerVignetteEnabled(enabled);
      set({ enabled });
    },
    toggle: () => get().setEnabled(!get().enabled),
  }),
);
