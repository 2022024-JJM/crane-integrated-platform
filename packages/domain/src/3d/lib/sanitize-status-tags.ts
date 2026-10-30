import { STATUS_TAG_ROLES } from '../model/status-tag-types';
import { normalizeTagCode } from '../model/tag-mapping-types';
import {
  parseTagKeyRef,
  resolveTagRef,
  type StatusTagEntries,
  type TagCodeRef,
} from './sanitize-tag-mappings';

/**
 * 문자열 역할 값 — 지금 포맷은 코드이고, 레거시는 `크레인.코드`·`크레인:코드`
 * 키다. 레거시 시절 코드에는 점이 없었으므로 레거시 키의 점은 하나뿐이다. 점이
 * 둘 이상이면 점이 든 코드(외업 원본 이름 `4_Crane.4_CR01.…`)로 읽는다 — 점이
 * 하나인 코드는 레거시 키와 구별되지 않아 레거시로 읽힌다.
 */
function parseStatusTagString(value: string): TagCodeRef | null {
  if (value.split('.').length > 2) {
    const code = normalizeTagCode(value);
    return code ? { code } : null;
  }
  return parseTagKeyRef(value);
}

/**
 * 상태 태그(`SavedModelInfo.statusTags`) 방어 — 로드·저장 경계에서
 * sanitize-scene-info 가 모델마다 부른다. 깨진 역할은 개별로 버리고 나머지는
 * 살린다(sanitize-model-zones 와 같은 원칙). 남는 역할이 없으면 `undefined`.
 *
 * 역할 값은 태그 코드 문자열이다. 레거시는 둘 — 단일 키 시절의 키 문자열
 * (`C_171.crane_control_on`, 점·콜론이 하나 있다 — `parseStatusTagString`)과
 * 두 슬롯 객체(`{ realtimeTagKey, virtualTagKey }`). 둘 다 코드와 크레인 접두어로 나뉘어
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
        ? parseStatusTagString(value)
        : value && typeof value === 'object' && !Array.isArray(value)
          ? resolveTagRef(value as Record<string, unknown>)
          : null;
    if (ref) out[role] = ref;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
