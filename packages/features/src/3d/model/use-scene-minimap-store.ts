import { create } from 'zustand';
import {
  getStorageItem,
  removeStorageItem,
  setStorageItem,
} from '@crane/core/lib/safe-storage';
import type { MinimapFrame, PanelPosition } from '../lib/minimap';

/**
 * 모니터링 2D 미니맵 상태.
 *
 * - `snapshot`: Canvas 안 SceneMinimapCapture 가 찍은 탑뷰 이미지(sRGB 로
 *   후처리된 2D 캔버스)와 그 픽셀↔월드 프레임. 씬 로드·지도 변경·수동 새로
 *   고침에만 바뀌므로 React 상태로 둬도 커밋이 잦지 않다(프레임 속도로 바뀌는
 *   카메라·마커는 여기 두지 않고 미니맵이 폴링으로 직접 읽는다 —
 *   rig-live-readouts 와 같은 규칙).
 * - `visible`: 표시 여부. 리전 무관 전역 설정이고 localStorage 에 영속한다
 *   (독 pin 과 같은 계열 `crane:<feature>`). 기본 표시.
 * - `captureRequest`: 수동 새로 고침 카운터 — 캡처 컴포넌트가 값 변화를 보고
 *   다시 찍는다(낮/밤이 바뀐 뒤 등).
 * - `position`: 패널 좌상단의 캔버스 영역 기준 좌표(px). null 이면 기본 자리
 *   (좌하단). 헤더 바를 끌어 옮기면 저장되고, 복원 시 창 크기에 맞춰 클램프
 *   한다(lib/minimap clampPanelPosition).
 */

export interface MinimapSnapshot {
  image: HTMLCanvasElement;
  frame: MinimapFrame;
  /** 찍은 시각(ms). 같은 프레임의 재캡처를 구분하는 용도. */
  capturedAt: number;
}

export const MINIMAP_STORAGE_KEY = 'crane:scene-minimap:visible';
export const MINIMAP_VISIBLE_DEFAULT = true;

export function readMinimapVisible(): boolean {
  const raw = getStorageItem(MINIMAP_STORAGE_KEY);
  if (raw === null) return MINIMAP_VISIBLE_DEFAULT;
  return raw === '1';
}

export function writeMinimapVisible(visible: boolean): void {
  setStorageItem(MINIMAP_STORAGE_KEY, visible ? '1' : '0');
}

export const MINIMAP_POSITION_STORAGE_KEY = 'crane:scene-minimap:position';

/** 저장된 패널 위치. 없거나 손상(JSON 아님·유한수 아님)이면 null(기본 자리). */
export function readMinimapPosition(): PanelPosition | null {
  const raw = getStorageItem(MINIMAP_POSITION_STORAGE_KEY);
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      Number.isFinite((parsed as PanelPosition).x) &&
      Number.isFinite((parsed as PanelPosition).y)
    ) {
      const { x, y } = parsed as PanelPosition;
      return { x, y };
    }
  } catch {
    // 손상된 저장값은 기본 자리로.
  }
  return null;
}

export function writeMinimapPosition(position: PanelPosition | null): void {
  if (position === null) {
    removeStorageItem(MINIMAP_POSITION_STORAGE_KEY);
    return;
  }
  setStorageItem(MINIMAP_POSITION_STORAGE_KEY, JSON.stringify(position));
}

interface SceneMinimapState {
  snapshot: MinimapSnapshot | null;
  visible: boolean;
  captureRequest: number;
  position: PanelPosition | null;
  setSnapshot: (snapshot: MinimapSnapshot | null) => void;
  setVisible: (visible: boolean) => void;
  toggleVisible: () => void;
  requestCapture: () => void;
  /** 같은 좌표 재설정은 no-op(참조 유지). null 은 기본 자리로 복귀. */
  setPosition: (position: PanelPosition | null) => void;
}

export const useSceneMinimapStore = create<SceneMinimapState>()((set, get) => ({
  snapshot: null,
  visible: readMinimapVisible(),
  captureRequest: 0,
  position: readMinimapPosition(),
  setSnapshot: (snapshot) => {
    // 같은 스냅샷 재설정은 no-op(참조 유지) — 캡처 컴포넌트의 effect 가
    // 같은 값을 다시 밀어도 미니맵이 리렌더되지 않게.
    if (get().snapshot === snapshot) return;
    set({ snapshot });
  },
  setVisible: (visible) => {
    if (get().visible === visible) return;
    writeMinimapVisible(visible);
    set({ visible });
  },
  toggleVisible: () => {
    get().setVisible(!get().visible);
  },
  requestCapture: () => {
    set({ captureRequest: get().captureRequest + 1 });
  },
  setPosition: (position) => {
    const current = get().position;
    if (
      current === position ||
      (current !== null &&
        position !== null &&
        current.x === position.x &&
        current.y === position.y)
    ) {
      return;
    }
    writeMinimapPosition(position);
    set({ position });
  },
}));

/**
 * 스냅샷 카메라의 fov·종횡비 — 미니맵의 카메라 발자국(부채꼴) 폭에 쓴다.
 * 캡처 컴포넌트가 useFrame 에서 쓰고 미니맵이 폴링으로 읽는 mutable 값
 * (프레임 속도 setState 금지 규약). 리사이즈로 종횡비가 바뀌어도 다음 폴링에
 * 반영된다.
 */
export const minimapCameraInfo = {
  fovDeg: 75,
  aspect: 1,
};
