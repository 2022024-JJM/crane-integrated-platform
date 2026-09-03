import { getStorageItem, setStorageItem } from '@crane/core/lib/safe-storage';

/**
 * 씬 독의 고정(pin) 영속화. 키는 최근 3D/알람 코드의 관례
 * `crane:<feature>:<scope>` 를 따른다 (use-scene-views-store,
 * use-fullscreen-alarm-overlay 와 같은 계열). 리전과 무관한 전역 설정이다.
 */

export const DOCK_STORAGE_PREFIX = 'crane:monitoring-dock';

export type DockStorageField = 'pinned';

export function dockStorageKey(dockId: string, field: DockStorageField) {
  return `${DOCK_STORAGE_PREFIX}:${dockId}:${field}`;
}

/** 저장값이 없을 때의 고정 기본값 — 처음 들어온 사용자는 도킹된 상태로 본다. */
export const DOCK_PINNED_DEFAULT = true;

export function readDockPinned(dockId: string): boolean {
  const raw = getStorageItem(dockStorageKey(dockId, 'pinned'));
  if (raw === null) {
    return DOCK_PINNED_DEFAULT;
  }
  return raw === '1';
}

export function writeDockPinned(dockId: string, pinned: boolean): void {
  setStorageItem(dockStorageKey(dockId, 'pinned'), pinned ? '1' : '0');
}
