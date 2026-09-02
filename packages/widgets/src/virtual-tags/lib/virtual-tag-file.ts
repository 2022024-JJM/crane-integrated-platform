import {
  sanitizeVirtualTagSet,
  type VirtualTagSet,
} from '@crane/domain/virtual-tag';

/**
 * 가상 태그 JSON 내보내기/가져오기 — 순수 함수. 파일 I/O 는 페이지가 한다.
 * 팀 공유가 목적이라 사람이 읽을 수 있게 2-space 들여쓰기로 쓴다.
 */
export const VIRTUAL_TAG_FILE_NAME = 'virtual-tags.json';

export function serializeVirtualTagSet(set: VirtualTagSet): string {
  return `${JSON.stringify(set, null, 2)}\n`;
}

/** 손상 JSON 이면 null. 봉투가 아니라도(배열만) sanitize 가 받아 준다. */
export function parseVirtualTagSetJson(text: string): VirtualTagSet | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== 'object') return null;
  return sanitizeVirtualTagSet(parsed);
}
