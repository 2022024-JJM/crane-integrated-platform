import type { SavedModelHook } from '../model/types';
import { normalizeTagCode } from '../model/tag-mapping-types';

/**
 * 모델 훅(`SavedModelInfo.hooks`) 방어 — 로드·저장 경계에서 sanitize-scene-info
 * 가 모델마다 부른다. 깨진 항목은 개별로 버리고 나머지는 살린다(sanitize-
 * model-zones 와 같은 원칙). 전부 무효면 `undefined` 를 돌려 필드가 직렬화에서
 * 빠진다.
 *
 * 훅은 노드 경로 1개 이상과 부착 태그 코드가 있어야 의미가 있다 — 둘 중 하나
 * 라도 없으면 런타임이 붙일 것도 따라갈 것도 없으므로 항목째 버린다.
 */

/** 부착 판정 반경 기본값(XZ, 씬 unit) — 훅 블록 폭의 두어 배. */
export const DEFAULT_HOOK_PICK_RADIUS = 12;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** 노드 경로 목록 — 비어 있지 않은 문자열만, 중복 제거(순서 유지). */
export function sanitizeHookNodes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== 'string' || item.length === 0 || seen.has(item)) {
      continue;
    }
    seen.add(item);
    out.push(item);
  }
  return out;
}

export function sanitizeModelHooks(raw: unknown): SavedModelHook[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: SavedModelHook[] = [];
  const seenIds = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const h = item as Record<string, unknown>;
    if (typeof h.id !== 'string' || h.id.length === 0) continue;
    // 중복 id 는 첫 항목 유지(first-wins) — 런타임 상태 키가 id 다.
    if (seenIds.has(h.id)) continue;
    const nodes = sanitizeHookNodes(h.nodes);
    if (nodes.length === 0) continue;
    const attachCode = normalizeTagCode(h.attachCode);
    if (!attachCode) continue;
    seenIds.add(h.id);
    const hook: SavedModelHook = { id: h.id, nodes, attachCode };
    if (typeof h.label === 'string' && h.label.trim().length > 0) {
      hook.label = h.label.trim();
    }
    // 0 은 기본과 같으므로 생략 — 저장본 diff 를 늘리지 않는다.
    if (isFiniteNumber(h.anchorOffsetY) && h.anchorOffsetY !== 0) {
      hook.anchorOffsetY = h.anchorOffsetY;
    }
    if (isFiniteNumber(h.pickRadius) && h.pickRadius > 0) {
      hook.pickRadius = h.pickRadius;
    }
    out.push(hook);
  }
  return out.length > 0 ? out : undefined;
}
