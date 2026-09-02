import { getStorageItem, setStorageItem } from '@crane/core/lib/safe-storage';

/**
 * 씬 독의 고정(pin)·크기 영속화. 키는 최근 3D/알람 코드의 관례
 * `crane:<feature>:<scope>` 를 따른다 (use-scene-views-store,
 * use-fullscreen-alarm-overlay 와 같은 계열). 리전과 무관한 전역 설정이다.
 *
 * 손상값(빈 문자열, NaN, Infinity, 범위 밖)은 기본값으로 떨어뜨리되 범위 밖
 * 숫자는 클램프한다 — 사용자가 끌어 놓은 크기가 min/max 조정 후에도 최대한
 * 살아남게 하려는 것.
 */

export const DOCK_STORAGE_PREFIX = 'crane:monitoring-dock';

/** 하단 도킹 패널 높이(뷰어 높이 대비 %) 범위. */
export const DOCK_SIZE_MIN = 20;
export const DOCK_SIZE_MAX = 70;
export const DOCK_SIZE_DEFAULT = 40;

export type DockStorageField = 'pinned' | 'size';

export function dockStorageKey(dockId: string, field: DockStorageField) {
  return `${DOCK_STORAGE_PREFIX}:${dockId}:${field}`;
}

export function clampDockSize(size: number): number {
  if (!Number.isFinite(size)) {
    return DOCK_SIZE_DEFAULT;
  }
  return Math.min(DOCK_SIZE_MAX, Math.max(DOCK_SIZE_MIN, size));
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

export function readDockSize(dockId: string): number {
  const raw = getStorageItem(dockStorageKey(dockId, 'size'));
  if (raw === null || raw.trim() === '') {
    return DOCK_SIZE_DEFAULT;
  }
  return clampDockSize(Number(raw));
}

export function writeDockSize(dockId: string, size: number): number {
  const clamped = clampDockSize(size);
  setStorageItem(dockStorageKey(dockId, 'size'), String(clamped));
  return clamped;
}
