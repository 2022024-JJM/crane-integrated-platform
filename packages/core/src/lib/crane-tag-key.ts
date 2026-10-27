/**
 * 태그 값 버스 키 `${craneId}.${tagCode}` — 크레인 하나의 태그 하나.
 *
 * 구분자는 점 — ISL 의 TagKey(`{구역}.{크레인}.{필드}`)와 같은 표기다. craneId
 * 의 하이픈은 밑줄로 바꾼다(`GC-04` → `GC_04`). 실시간 브리지·리플레이 스토어·
 * 시나리오 러너·씬의 맵핑(모델 craneId + 코드)·태그 연결 다이얼로그가 전부 이
 * 함수로 키를 만들어 표기가 한 곳에서만 정해진다. core 에 두는 이유: domain 의
 * monitoring·3d·virtual-tag 세 슬라이스가 같은 규칙을 쓰는데 같은 레이어
 * 슬라이스끼리는 import 하지 않는다. 단일 키 시절의 `크레인:코드` 표기는 로드
 * 경계(sanitize)가 점으로 옮긴다(`normalizeLegacyCraneTagKey`).
 */
export const CRANE_TAG_KEY_SEPARATOR = '.';

export function buildCraneTagKey(craneId: string, tagCode: string): string {
  return `${normalizeCraneKey(craneId)}${CRANE_TAG_KEY_SEPARATOR}${tagCode}`;
}

/** 키 앞부분의 크레인 표기. */
export function normalizeCraneKey(craneId: string): string {
  return craneId.replace(/-/g, '_');
}

export interface CraneTagKeyParts {
  craneKey: string;
  tagCode: string;
}

/**
 * 키를 크레인·태그 코드로 나눈다. 첫 점 기준이며 어느 쪽이든 비면 null —
 * 가상 태그 키처럼 다른 표기일 수 있어 호출자가 null 을 처리한다.
 */
export function parseCraneTagKey(key: string): CraneTagKeyParts | null {
  const sep = key.indexOf(CRANE_TAG_KEY_SEPARATOR);
  if (sep <= 0 || sep >= key.length - 1) return null;
  return { craneKey: key.slice(0, sep), tagCode: key.slice(sep + 1) };
}

/**
 * 단일 키 시절의 `크레인:코드` 를 점 표기로. 이미 점이 있거나 콜론이 없으면
 * 그대로다. 씬 sanitize 가 레거시 키를 읽을 때 쓴다.
 */
export function normalizeLegacyCraneTagKey(key: string): string {
  if (key.includes(CRANE_TAG_KEY_SEPARATOR)) return key;
  const colon = key.indexOf(':');
  if (colon <= 0 || colon >= key.length - 1) return key;
  return `${key.slice(0, colon)}${CRANE_TAG_KEY_SEPARATOR}${key.slice(colon + 1)}`;
}
