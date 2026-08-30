import { create } from 'zustand';
import { createId } from '@crane/core/lib/create-id';
import { getStorageJson, setStorageJson } from '@crane/core/lib/safe-storage';
import type { Vector3Tuple } from '@crane/core/types/math';

/**
 * 씬 뷰 북마크 — 사용자가 이름 붙여 저장한 카메라 포즈(위치+타깃).
 * 줌은 camera↔target 거리에서 파생되므로 별도 값이 필요 없다.
 *
 * 영속화는 기존 씬 저장 경로(SavedSceneInfo)와 분리된 localStorage
 * 네임스페이스를 쓴다 — 씬 JSON/sanitize를 건드리지 않고, 추후 백엔드
 * API가 생기면 이 스토어의 read/write만 교체하면 된다.
 */

export const SCENE_VIEWS_MAX = 12;
export const SCENE_VIEW_NAME_MAX = 24;

export interface SceneViewBookmark {
  id: string;
  name: string;
  position: Vector3Tuple;
  target: Vector3Tuple;
  createdAt: number;
}

interface SceneViewPose {
  position: Vector3Tuple;
  target: Vector3Tuple;
}

interface SceneViewsState {
  viewsByRegion: Record<string, SceneViewBookmark[]>;
  hydratedRegions: Record<string, true>;
  hydrate: (regionId: string) => void;
  addView: (regionId: string, name: string, pose: SceneViewPose) => boolean;
  removeView: (regionId: string, viewId: string) => void;
}

const storageKey = (regionId: string) => `crane:scene-views:${regionId}`;

function isVector3Tuple(value: unknown): value is Vector3Tuple {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((n) => typeof n === 'number' && Number.isFinite(n))
  );
}

/** 저장소에서 읽은 값 방어적 검증 — 손상/구버전 항목은 조용히 버린다. */
function sanitizeStoredViews(raw: unknown): SceneViewBookmark[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .filter((entry): entry is SceneViewBookmark => {
      if (typeof entry !== 'object' || entry === null) return false;
      const view = entry as Partial<SceneViewBookmark>;
      return (
        typeof view.id === 'string' &&
        typeof view.name === 'string' &&
        view.name.length > 0 &&
        typeof view.createdAt === 'number' &&
        isVector3Tuple(view.position) &&
        isVector3Tuple(view.target)
      );
    })
    .slice(0, SCENE_VIEWS_MAX);
}

export const useSceneViewsStore = create<SceneViewsState>()((set, get) => ({
  viewsByRegion: {},
  hydratedRegions: {},

  hydrate: (regionId) => {
    if (get().hydratedRegions[regionId]) {
      return;
    }

    const views = sanitizeStoredViews(
      getStorageJson<unknown>(storageKey(regionId)),
    );

    set((state) => ({
      viewsByRegion: { ...state.viewsByRegion, [regionId]: views },
      hydratedRegions: { ...state.hydratedRegions, [regionId]: true },
    }));
  },

  addView: (regionId, name, pose) => {
    const trimmed = name.trim();
    const views = get().viewsByRegion[regionId] ?? [];
    const isDuplicate = views.some(
      (view) => view.name.toLowerCase() === trimmed.toLowerCase(),
    );

    if (
      trimmed.length === 0 ||
      trimmed.length > SCENE_VIEW_NAME_MAX ||
      isDuplicate ||
      views.length >= SCENE_VIEWS_MAX
    ) {
      return false;
    }

    const nextViews = [
      ...views,
      {
        // crypto.randomUUID는 비보안 오리진(http://<ip> 접속)에 없다 —
        // createId가 폴백을 내장하므로 어느 배포 환경에서든 안전하다.
        id: createId(),
        name: trimmed,
        position: pose.position,
        target: pose.target,
        createdAt: Date.now(),
      },
    ];

    set((state) => ({
      viewsByRegion: { ...state.viewsByRegion, [regionId]: nextViews },
    }));
    // 쓰기 실패(쿼터 등)는 safe-storage가 경고를 남긴다 — 메모리 상태는 유지.
    setStorageJson(storageKey(regionId), nextViews);
    return true;
  },

  removeView: (regionId, viewId) => {
    const views = get().viewsByRegion[regionId] ?? [];
    const nextViews = views.filter((view) => view.id !== viewId);

    if (nextViews.length === views.length) {
      return;
    }

    set((state) => ({
      viewsByRegion: { ...state.viewsByRegion, [regionId]: nextViews },
    }));
    setStorageJson(storageKey(regionId), nextViews);
  },
}));
