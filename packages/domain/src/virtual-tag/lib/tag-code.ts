import { VIRTUAL_TAG_CODE_MAX } from '../model/types';

/**
 * 태그 코드 정규화 — 씬 맵핑의 코드 규칙(domain/3d `normalizeTagCode`: 공백·
 * 콜론 없음, 점은 된다 — 외업 원본 이름)에 길이 상한을 더한 것. 같은 레이어의
 * 다른 슬라이스라 import 하지 않고 규칙을 여기 한 번 더 둔다 — 바꾸면 둘 다
 * 고친다.
 */
const FORBIDDEN = /[\s:]/;

/** trim 후 비었거나 길이 초과·금지 글자가 있으면 null. */
export function normalizeVirtualTagCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim();
  if (code.length === 0 || code.length > VIRTUAL_TAG_CODE_MAX) return null;
  if (FORBIDDEN.test(code)) return null;
  return code;
}
