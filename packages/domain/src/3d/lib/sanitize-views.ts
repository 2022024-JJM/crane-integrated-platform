import {
  SCENE_SPLIT_SLOT_COUNT,
  SCENE_VIEW_NAME_MAX,
  SCENE_VIEWS_MAX,
  type SavedSceneView,
  type SavedViewSplit,
} from '../model/view-types';
import { createId } from '@crane/core/lib/create-id';
import type { Vector3Tuple } from '@crane/core/types/math';

/**
 * 씬 뷰(`SavedSceneInfo.views`)·분할(`viewSplit`) 방어 — sanitize-scene-info
 * 가 로드·저장 경계에서 부른다.
 *
 * 뷰는 구도(position·target)가 깨졌으면 통째로 버리고, 이름은 살릴 수 있는
 * 만큼 살린다(공백 정리·길이 자르기). 같은 이름·같은 id 는 뒤의 것을 버린다
 * — 에디터가 막는 규칙이라 정상 저장본에는 없고, 오염된 파일에서만 든다.
 * 분할 칸은 존재하는 뷰만 가리키게 하고 같은 뷰가 두 칸에 있으면 뒤 칸을
 * 비운다. 뷰 목록보다 뒤에 정규화해야 이 참조 검사가 성립한다.
 */

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isVector3Tuple(value: unknown): value is Vector3Tuple {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((item) => isFiniteNumber(item))
  );
}

/** 이름 비교 키 — 에디터의 중복 검사와 같은 규칙(앞뒤 공백 무시·대소문자 무시). */
export function sceneViewNameKey(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * 뷰 목록 정규화. 남는 뷰가 없으면 null — 호출자가 필드를 생략해 뷰를 쓰지
 * 않는 씬의 저장본에 diff 가 생기지 않게 한다.
 */
export function sanitizeSceneViews(raw: unknown): SavedSceneView[] | null {
  if (!Array.isArray(raw)) return null;
  const out: SavedSceneView[] = [];
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  for (const item of raw) {
    if (out.length >= SCENE_VIEWS_MAX) break;
    if (!item || typeof item !== 'object') continue;
    const view = item as Record<string, unknown>;
    if (!isVector3Tuple(view.position) || !isVector3Tuple(view.target)) {
      continue;
    }
    if (typeof view.name !== 'string') continue;
    const name = view.name.trim().slice(0, SCENE_VIEW_NAME_MAX);
    if (name.length === 0) continue;
    const nameKey = sceneViewNameKey(name);
    if (seenNames.has(nameKey)) continue;

    const id =
      typeof view.id === 'string' && view.id.length > 0 ? view.id : createId();
    if (seenIds.has(id)) continue;

    seenIds.add(id);
    seenNames.add(nameKey);
    const sanitized: SavedSceneView = {
      id,
      name,
      position: view.position,
      target: view.target,
    };
    if (view.pinned === true) sanitized.pinned = true;
    out.push(sanitized);
  }
  return out.length > 0 ? out : null;
}

/**
 * 분할 정규화. 칸은 항상 SCENE_SPLIT_SLOT_COUNT 길이로 맞추고(모자라면 빈 칸,
 * 넘치면 자름), 존재하지 않거나 이미 앞 칸에 쓰인 뷰는 빈 칸이 된다. 칸이
 * 전부 비었고 고정도 아니면 null — 필드를 생략한다. 고정만 남은 분할은
 * 남긴다(뷰를 끌어다 놓기 전에 고정부터 누른 저장본).
 */
export function sanitizeViewSplit(
  raw: unknown,
  views: readonly SavedSceneView[],
): SavedViewSplit | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const split = raw as Record<string, unknown>;
  const validIds = new Set(views.map((view) => view.id));
  const rawSlots = Array.isArray(split.slots) ? split.slots : [];
  const used = new Set<string>();
  const slots: (string | null)[] = [];
  for (let i = 0; i < SCENE_SPLIT_SLOT_COUNT; i += 1) {
    const value = rawSlots[i];
    if (typeof value === 'string' && validIds.has(value) && !used.has(value)) {
      used.add(value);
      slots.push(value);
    } else {
      slots.push(null);
    }
  }
  const pinned = split.pinned === true;
  if (used.size === 0 && !pinned) return null;
  const sanitized: SavedViewSplit = { slots };
  if (pinned) sanitized.pinned = true;
  return sanitized;
}
