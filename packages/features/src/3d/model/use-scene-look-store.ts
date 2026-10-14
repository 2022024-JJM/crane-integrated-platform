import { create } from 'zustand';
import { getStorageItem, setStorageItem } from '@crane/core/lib/safe-storage';
import { isSameIdList } from '../lib/contour-culling';
import {
  EQUIPMENT_MUTE,
  setSceneLookLabelEmphasis,
  setSceneLookLabelMaxDistance,
  setSceneLookLabelMinScale,
  setSceneMute,
} from '@crane/domain/3d';

/**
 * 씬 룩 — 관제 모드(controlRoom) 토글. 리전 무관 전역 설정, localStorage
 * 영속(`crane:<feature>` 관례). 켜면 환경(지도·건물·지형·바다·하늘)이
 * 무채색·저대비로 가라앉고 조명은 기준 주광으로 고정되며, 색은 상태(근접
 * 거리 선·외곽선)에만 남는다. 실제 효과는 각자 구독한다: 머티리얼 유니폼
 * (`setSceneMute`, 여기서), 바다·배경(scene-water·scene-environment), 조명
 * (SceneLighting).
 */
export const SCENE_LOOK_STORAGE_KEY = 'crane:scene-look:control-room';
export const CONTROL_ROOM_DEFAULT = false;

export function readControlRoom(): boolean {
  const raw = getStorageItem(SCENE_LOOK_STORAGE_KEY);
  if (raw === null) return CONTROL_ROOM_DEFAULT;
  return raw === '1';
}

export function writeControlRoom(on: boolean): void {
  setStorageItem(SCENE_LOOK_STORAGE_KEY, on ? '1' : '0');
}

interface SceneLookState {
  controlRoom: boolean;
  setControlRoom: (on: boolean) => void;
  toggleControlRoom: () => void;
  /** 상시 윤곽을 받을 장비 id(카메라 거리 컬링, SceneContourCuller 가 쓴다). */
  contourIds: string[];
  setContourIds: (ids: string[]) => void;
}

export const useSceneLookStore = create<SceneLookState>()((set, get) => ({
  controlRoom: readControlRoom(),
  setControlRoom: (on) => {
    if (get().controlRoom === on) return;
    writeControlRoom(on);
    set({ controlRoom: on });
  },
  toggleControlRoom: () => get().setControlRoom(!get().controlRoom),
  contourIds: [],
  setContourIds: (ids) => {
    if (isSameIdList(get().contourIds, ids)) return;
    set({ contourIds: ids });
  },
}));

// 머티리얼 무채색 유니폼은 스토어가 직접 민다 — 캔버스가 없어도 값은 맞춰
// 둔다(다음 캔버스가 그 값으로 뜬다).
/** 관제 모드의 라벨 거리 축소 하한 — 멀리 있는 라벨도 읽히게. */
const CONTROL_ROOM_LABEL_MIN_SCALE = 0.7;

function pushMute(controlRoom: boolean): void {
  if (controlRoom) {
    setSceneMute(1, EQUIPMENT_MUTE);
    setSceneLookLabelMinScale(CONTROL_ROOM_LABEL_MIN_SCALE);
    setSceneLookLabelEmphasis(true);
    // 거리 숨김은 기본값 그대로 — 먼 장비의 칩이 지평선에 줄지어 시야를 가린다.
    // 탑뷰의 이름은 평면 마커(scene-plan-markers)가 맡는다.
    setSceneLookLabelMaxDistance(null);
  } else {
    setSceneMute(0, 0);
    setSceneLookLabelMinScale(null);
    setSceneLookLabelEmphasis(false);
    setSceneLookLabelMaxDistance(null);
  }
}
pushMute(useSceneLookStore.getState().controlRoom);
useSceneLookStore.subscribe((state) => {
  pushMute(state.controlRoom);
});
