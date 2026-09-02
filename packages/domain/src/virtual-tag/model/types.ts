/**
 * 가상 태그 — 서버(PLC) 없이 태그 값을 흘려보내는 시뮬레이션 정의.
 *
 * 실제 서버 태그와 **같은 키 공간**(`${craneId}:${tagCode}` 권장, 형식 강제
 * 없음)을 쓴다. 맵핑은 태그를 `key` 로만 참조하므로 나중에 실서버가 붙으면
 * 값 소스만 바꾸면 되고, 씬 JSON 은 그대로다. `id` 는 편집 UI 의 행 식별자일
 * 뿐 외부(씬)에서 참조하지 않는다.
 *
 * 값 변화는 `pattern` 이 정한다. manual 만 사용자가 슬라이더로 밀고, 나머지는
 * 시간의 함수(파형)라 결정론적으로 재현된다.
 */
export type VirtualTagPattern =
  | { kind: 'manual' }
  /** min↔max 왕복. 예전 시뮬 생성기의 파형. */
  | { kind: 'triangle'; periodMs: number }
  | { kind: 'sine'; periodMs: number }
  /** min→max 톱니. */
  | { kind: 'sawtooth'; periodMs: number }
  /** dutyPct(0~100, 기본 50) 동안 max, 나머지 min. */
  | { kind: 'square'; periodMs: number; dutyPct?: number };

export type VirtualTagPatternKind = VirtualTagPattern['kind'];

export const VIRTUAL_TAG_PATTERN_KINDS = [
  'manual',
  'triangle',
  'sine',
  'sawtooth',
  'square',
] as const satisfies readonly VirtualTagPatternKind[];

export interface VirtualTagDefinition {
  id: string;
  /** 값 버스 키. 유일·trim·최대 VIRTUAL_TAG_KEY_MAX 자. */
  key: string;
  /** 표시명. 비면 key 를 보여 준다. */
  name: string;
  /** 표시 전용(mm, deg …). 단위 환산은 맵핑의 scale/offset 이 한다. */
  unit?: string;
  min: number;
  /** min < max 보장(sanitize). */
  max: number;
  /** 시작값이자 manual 패턴의 현재값. [min, max] 클램프. */
  initial: number;
  pattern: VirtualTagPattern;
  /** false 면 값을 내보내지 않는다. */
  enabled: boolean;
}

export interface VirtualTagSet {
  version: 1;
  /** 값 갱신 주기(ms). [VIRTUAL_TAG_TICK_MIN, VIRTUAL_TAG_TICK_MAX]. */
  tickMs: number;
  tags: VirtualTagDefinition[];
}

export const VIRTUAL_TAG_KEY_MAX = 64;
export const VIRTUAL_TAG_NAME_MAX = 40;
export const VIRTUAL_TAG_UNIT_MAX = 12;
export const VIRTUAL_TAGS_MAX = 200;
export const VIRTUAL_TAG_TICK_MIN = 16;
export const VIRTUAL_TAG_TICK_MAX = 5000;
export const VIRTUAL_TAG_TICK_DEFAULT = 100;
export const VIRTUAL_TAG_PERIOD_MIN = 100;
export const VIRTUAL_TAG_PERIOD_MAX = 600_000;
export const VIRTUAL_TAG_PERIOD_DEFAULT = 8_000;
