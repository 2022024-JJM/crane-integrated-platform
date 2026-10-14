import { create } from 'zustand';
import {
  getStorageItem,
  removeStorageItem,
  setStorageItem,
} from '@crane/core/lib/safe-storage';
import type { MinimapFrame, PanelRatio } from '../lib/minimap';

/**
 * 모니터링 2D 미니맵 상태.
 *
 * - `snapshot`: Canvas 안 SceneMinimapCapture 가 찍은 탑뷰 이미지(sRGB 로
 *   후처리된 2D 캔버스)와 그 픽셀↔월드 프레임. 씬 로드·지도 변경·하늘
 *   국면 변경에만 바뀌므로 React 상태로 둬도 커밋이 잦지 않다(프레임 속도로 바뀌는
 *   카메라·마커는 여기 두지 않고 미니맵이 폴링으로 직접 읽는다 —
 *   rig-live-readouts 와 같은 규칙).
 * - `visible`: 표시 여부. 리전 무관 전역 설정이고 localStorage 에 영속한다
 *   (독 pin 과 같은 계열 `crane:<feature>`). 기본 표시.
 * - `position`: 패널 좌상단의 **비율 위치**(캔버스 영역 여유 공간 대비 0~1,
 *   lib/minimap PanelRatio). null 이면 기본 자리(좌하단). 헤더 바를 끌어
 *   옮기면 놓는 순간의 컨테이너 크기로 비율을 만들어 저장하고, 복원·리사이즈
 *   때 그 비율로 px 를 다시 계산한다(panelRatioToPosition) — 전체화면으로
 *   컨테이너가 커져도 우하단에 둔 패널이 우하단에 머문다. px 로 저장했던
 *   예전 모양(`{x, y}`)은 비율로 바꿀 수 없어 null 로 읽는다.
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

function clampUnit(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

/**
 * 저장된 패널 비율 위치. 없거나 손상(JSON 아님·유한수 아님·예전 px 모양)이면
 * null(기본 자리). 범위 밖 값은 [0,1] 로 클램프한다.
 */
export function readMinimapPosition(): PanelRatio | null {
  const raw = getStorageItem(MINIMAP_POSITION_STORAGE_KEY);
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      Number.isFinite((parsed as PanelRatio).fx) &&
      Number.isFinite((parsed as PanelRatio).fy)
    ) {
      const { fx, fy } = parsed as PanelRatio;
      return { fx: clampUnit(fx), fy: clampUnit(fy) };
    }
  } catch {
    // 손상된 저장값은 기본 자리로.
  }
  return null;
}

export function writeMinimapPosition(position: PanelRatio | null): void {
  if (position === null) {
    removeStorageItem(MINIMAP_POSITION_STORAGE_KEY);
    return;
  }
  setStorageItem(MINIMAP_POSITION_STORAGE_KEY, JSON.stringify(position));
}

interface SceneMinimapState {
  snapshot: MinimapSnapshot | null;
  visible: boolean;
  position: PanelRatio | null;
  setSnapshot: (snapshot: MinimapSnapshot | null) => void;
  setVisible: (visible: boolean) => void;
  toggleVisible: () => void;
  /** 같은 비율 재설정은 no-op(참조 유지). null 은 기본 자리로 복귀. */
  setPosition: (position: PanelRatio | null) => void;
}

export const useSceneMinimapStore = create<SceneMinimapState>()((set, get) => ({
  snapshot: null,
  visible: readMinimapVisible(),
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
  setPosition: (position) => {
    const current = get().position;
    if (
      current === position ||
      (current !== null &&
        position !== null &&
        current.fx === position.fx &&
        current.fy === position.fy)
    ) {
      return;
    }
    writeMinimapPosition(position);
    set({ position });
  },
}));
