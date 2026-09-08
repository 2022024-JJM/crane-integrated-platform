import { normalizeVirtualTagKey } from '@crane/domain/virtual-tag';

export type TagKeyError = 'invalid-key' | 'duplicate-key';

/**
 * 키 입력 커밋 전 판정 — 스토어(updateTag)가 거부하는 이유를 UI 가 미리 알아
 * 툴팁 문구를 고른다. 규칙은 스토어와 같다: trim 후 빈 값·길이 초과는
 * invalid-key, 다른 태그가 쓰는 키는 duplicate-key. 자기 키 그대로는 통과.
 */
export function getTagKeyError(
  value: string,
  currentKey: string,
  takenKeys: Iterable<string>,
): TagKeyError | null {
  const normalized = normalizeVirtualTagKey(value);
  if (normalized === null) return 'invalid-key';
  if (normalized === currentKey) return null;
  for (const key of takenKeys) {
    if (key === normalized) return 'duplicate-key';
  }
  return null;
}
