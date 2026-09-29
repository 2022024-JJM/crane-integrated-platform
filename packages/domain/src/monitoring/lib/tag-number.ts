/**
 * 서버 값 → 태그 값 버스의 숫자. 버스는 숫자 전용이라(features/3d
 * tag-value-bus) 상태 비트는 0/1 로 싣는다 — 가상 태그·리플레이·실시간이 같은
 * 키 공간·같은 타입으로 흐르고, 상태 태그(`SavedModelInfo.statusTags`)도 축
 * 태그와 같은 경로로 읽힌다.
 *
 * - number: 유한수만.
 * - boolean: true = 1, false = 0.
 * - string: `'true'`/`'false'` 만(대소문자·앞뒤 공백 무시). 플레이백 어댑터
 *   (playback-adapter `normalizeReplayValue`)가 boolean 을 이 문자열로 싣는다.
 *   숫자 문자열(`'12'`)은 받지 않는다 — 문자열로 오는 태그가 축에 꽂혀
 *   움직이는 것은 서버 형식을 확인한 뒤에 정한다.
 * - 그 외(null·빈 문자열·객체): null. 호출자가 버린다.
 */
export function toTagNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  if (typeof value === 'string') {
    const token = value.trim().toLowerCase();
    if (token === 'true') return 1;
    if (token === 'false') return 0;
  }
  return null;
}
