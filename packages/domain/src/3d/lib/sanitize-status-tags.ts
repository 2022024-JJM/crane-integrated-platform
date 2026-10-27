import { STATUS_TAG_ROLES } from '../model/status-tag-types';
import {
  parseTagKeyRef,
  resolveTagRef,
  type StatusTagEntries,
} from './sanitize-tag-mappings';

/**
 * 상태 태그(`SavedModelInfo.statusTags`) 방어 — 로드·저장 경계에서
 * sanitize-scene-info 가 모델마다 부른다. 깨진 역할은 개별로 버리고 나머지는
 * 살린다(sanitize-model-zones 와 같은 원칙). 남는 역할이 없으면 `undefined`.
 *
 * 역할 값은 태그 코드 문자열이다. 레거시는 둘 — 단일 키 시절의 키 문자열
 * (`C_171.crane_control_on`, 점·콜론이 있다)과 두 슬롯 객체
 * (`{ realtimeTagKey, virtualTagKey }`). 둘 다 코드와 크레인 접두어로 나뉘어
 * 중간형(`StatusTagEntries`)으로 나가고, 모델 craneId 와 맞추는 것은
 * `finalizeModelTagKeys` 다. 출력의 역할 순서는 `STATUS_TAG_ROLES` 고정.
 */
export function sanitizeStatusTagEntries(
  raw: unknown,
): StatusTagEntries | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const source = raw as Record<string, unknown>;
  const out: StatusTagEntries = {};
  for (const role of STATUS_TAG_ROLES) {
    const value = source[role];
    const ref =
      typeof value === 'string'
        ? parseTagKeyRef(value)
        : value && typeof value === 'object' && !Array.isArray(value)
          ? resolveTagRef(value as Record<string, unknown>)
          : null;
    if (ref) out[role] = ref;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
