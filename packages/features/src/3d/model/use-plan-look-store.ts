import { create } from 'zustand';
import { getStorageItem, setStorageItem } from '@crane/core/lib/safe-storage';

/**
 * 탑뷰의 "평면도 룩" 스위치 — 직교 탑뷰에 관제 평면도 처리(그림자 끄기·바닥
 * 톤·투광등 웅덩이 끄기·가는 윤곽·축 고정 라벨·Δh 칩·숨은선)를 얹을지.
 *
 * - 2D 탑뷰: 켬 — 직교 + 평면도 룩.
 * - 3D 탑뷰: 끔 — 직교 카메라만 바뀌고 모델·조명은 원근과 같다(예전 탑뷰).
 *
 * 판정은 모두 `isPlanLookCamera(camera, enabled)`(lib/plan-look.ts) 하나다.
 * 리전 무관 전역이고 localStorage 에 영속한다(미니맵 표시와 같은 계열).
 * 기본은 켬.
 */
export const PLAN_LOOK_STORAGE_KEY = 'crane:plan-look';
export const PLAN_LOOK_DEFAULT = true;

export function readPlanLook(): boolean {
  const raw = getStorageItem(PLAN_LOOK_STORAGE_KEY);
  if (raw === null) return PLAN_LOOK_DEFAULT;
  return raw === '1';
}

export function writePlanLook(enabled: boolean): void {
  setStorageItem(PLAN_LOOK_STORAGE_KEY, enabled ? '1' : '0');
}

interface PlanLookState {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
}

export const usePlanLookStore = create<PlanLookState>((set, get) => ({
  enabled: readPlanLook(),
  setEnabled: (enabled) => {
    if (get().enabled === enabled) return;
    writePlanLook(enabled);
    set({ enabled });
  },
}));
