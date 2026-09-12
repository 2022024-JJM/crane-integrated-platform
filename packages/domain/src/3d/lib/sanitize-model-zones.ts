import type { SavedModelZone } from '../model/types';

/**
 * 모델 영역(`SavedModelInfo.zones`) 방어 — 로드·저장 경계에서 sanitize-scene-info
 * 가 모델마다 부른다. 깨진 항목은 개별로 버리고 나머지는 살린다(sanitize-rig
 * 와 같은 원칙). 전부 무효면 `undefined` 를 돌려 필드가 직렬화에서 빠진다.
 *
 * 색 정규화는 저장소에서 이 파일이 처음이다 — `SavedTextInfo.color` 는 문자열
 * 여부만 봤다. 여기서는 `#rrggbb` 만 받아 소문자로 고정하고(`<input type=
 * "color">` 가 내는 형식이자 three `Color` 가 그대로 읽는 형식), 그 밖의 값은
 * 기본색으로 되돌린다 — 색이 깨졌다고 영역(반경·이름)까지 버릴 이유는 없다.
 */

/** `#rrggbb` (대소문자 무관). `#fff`·`rgb()`·이름은 받지 않는다. */
const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;

/** 색이 깨진 영역의 폴백 — sky-400. 팔레트 프리셋(widgets zone-editor)의 첫 색과 같다. */
export const DEFAULT_ZONE_COLOR = '#38bdf8';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** 유효한 `#rrggbb` 면 소문자로, 아니면 null. */
export function normalizeZoneColor(raw: unknown): string | null {
  if (typeof raw !== 'string' || !HEX_COLOR_RE.test(raw)) return null;
  return raw.toLowerCase();
}

/**
 * 오프셋 [dx, dz] — 둘 다 유한수일 때만 받고, 둘 다 0 이면 생략(undefined).
 * 길이가 다르거나 NaN 이 섞이면 버린다(부분 적용 없음).
 */
export function sanitizeZoneOffset(raw: unknown): [number, number] | undefined {
  if (!Array.isArray(raw) || raw.length !== 2) return undefined;
  const [dx, dz] = raw as unknown[];
  if (!isFiniteNumber(dx) || !isFiniteNumber(dz)) return undefined;
  if (dx === 0 && dz === 0) return undefined;
  return [dx, dz];
}

export function sanitizeModelZones(raw: unknown): SavedModelZone[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: SavedModelZone[] = [];
  const seenIds = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const z = item as Record<string, unknown>;
    if (typeof z.id !== 'string' || z.id.length === 0) continue;
    // 중복 id 는 첫 항목 유지(first-wins) — 렌더 key·런타임 키가 id 다.
    if (seenIds.has(z.id)) continue;
    // 반경 0·음수·NaN 은 그릴 것도 판정할 것도 없다 — 항목째 버린다.
    if (!isFiniteNumber(z.radius) || z.radius <= 0) continue;
    seenIds.add(z.id);
    const zone: SavedModelZone = {
      id: z.id,
      name: typeof z.name === 'string' ? z.name : '',
      color: normalizeZoneColor(z.color) ?? DEFAULT_ZONE_COLOR,
      radius: z.radius,
    };
    const offset = sanitizeZoneOffset(z.offset);
    if (offset) zone.offset = offset;
    // 등급은 'stop' 만 기록한다 — 그 외(누락·'warn'·오타)는 기본(경보만).
    if (z.level === 'stop') zone.level = 'stop';
    out.push(zone);
  }
  return out.length > 0 ? out : undefined;
}
