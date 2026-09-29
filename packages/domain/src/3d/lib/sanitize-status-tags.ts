import {
  STATUS_TAG_ROLES,
  type ModelStatusTags,
} from '../model/status-tag-types';

/**
 * 상태 태그(`SavedModelInfo.statusTags`) 방어 — 로드·저장 경계에서
 * sanitize-scene-info 가 모델마다 부른다. 깨진 역할은 개별로 버리고 나머지는
 * 살린다(sanitize-model-zones 와 같은 원칙). 남는 역할이 없으면 `undefined` 를
 * 돌려 필드가 직렬화에서 빠진다.
 *
 * 키는 trim 해서 싣는다(태그 맵핑의 tagKey 와 같은 규칙). 출력의 역할 순서는
 * `STATUS_TAG_ROLES` 고정 — 입력 순서가 달라도 저장본 diff 가 생기지 않는다.
 */
export function sanitizeModelStatusTags(
  raw: unknown,
): ModelStatusTags | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const source = raw as Record<string, unknown>;
  const out: ModelStatusTags = {};
  for (const role of STATUS_TAG_ROLES) {
    const key = source[role];
    if (typeof key !== 'string') continue;
    const trimmed = key.trim();
    if (trimmed.length === 0) continue;
    out[role] = trimmed;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
