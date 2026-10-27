/**
 * 가상 태그 — 서버(PLC) 없이 태그 값을 흘려보내는 시뮬레이션 정의.
 *
 * 실시간 태그와 같은 모양으로 **장비 › 태그** 계층이다. 장비는 실시간 크레인에
 * 대응하는 묶음이고, 태그는 그 장비가 내보내는 값 하나다.
 *
 * 값 버스 키는 저장하지 않고 `장비키:코드` 로 조립한다(lib/virtual-tag-key.ts).
 * 구분자가 콜론이라 실시간 키(`크레인.코드`)와 절대 겹치지 않는다 — 두 소스가
 * 한 버스를 쓰므로 표기가 같아지면 마지막 publish 가 이긴다. 씬의 맵핑은 이
 * 키 문자열만 참조한다.
 *
 * 값 변화는 `pattern` 이 정한다. manual 만 사용자가 슬라이더(불리언은 토글)로
 * 밀고, 나머지는 시간의 함수(파형)라 결정론적으로 재현된다. 시간 단위는 저장본
 * 전체가 **초**다(`tickSec`·`periodSec`). 러너 내부 시계는 ms 이고 경계에서
 * 변환한다.
 */
export type VirtualTagPattern =
  | { kind: 'manual' }
  /** min↔max 왕복. 예전 시뮬 생성기의 파형. */
  | { kind: 'triangle'; periodSec: number }
  | { kind: 'sine'; periodSec: number }
  /** min→max 톱니. */
  | { kind: 'sawtooth'; periodSec: number }
  /** dutyPct(0~100, 기본 50) 동안 max, 나머지 min. */
  | { kind: 'square'; periodSec: number; dutyPct?: number };

export type VirtualTagPatternKind = VirtualTagPattern['kind'];

export const VIRTUAL_TAG_PATTERN_KINDS = [
  'manual',
  'triangle',
  'sine',
  'sawtooth',
  'square',
] as const satisfies readonly VirtualTagPatternKind[];

/** 불리언 태그가 가질 수 있는 패턴 — 0/1 사이를 뛰는 것만 의미가 있다. */
export const VIRTUAL_TAG_BOOL_PATTERN_KINDS = [
  'manual',
  'square',
] as const satisfies readonly VirtualTagPatternKind[];

/**
 * 값 형식. `bool` 은 범위 0~1 고정이고 패턴은 manual·square 만, 단위가 없다.
 * 버스는 숫자 전용이라 값은 0/1 숫자로 나가고, 표시만 ON/OFF 배지다.
 */
export type VirtualTagDataType = 'number' | 'bool';
export const VIRTUAL_TAG_DATA_TYPES = [
  'number',
  'bool',
] as const satisfies readonly VirtualTagDataType[];

export interface VirtualTagDefinition {
  /** 장비 안에서 고유한 행 식별자. 외부(씬)에서 참조하지 않는다. */
  id: string;
  /** 태그 코드 — 장비 안에서 유일, 공백·콜론 없음. 키의 뒷부분이다. */
  code: string;
  /** 표시명. 비면 code 를 보여 준다. */
  name: string;
  dataType: VirtualTagDataType;
  /** 표시 전용(mm, deg …). 단위 환산은 맵핑의 scale/offset 이 한다. */
  unit?: string;
  min: number;
  /** min < max 보장(sanitize). */
  max: number;
  /** 시작값이자 manual 패턴의 현재값. [min, max] 클램프. */
  initial: number;
  pattern: VirtualTagPattern;
}

export interface VirtualEquipment {
  /** 내부 식별자(행·라우트). */
  id: string;
  /**
   * 장비 ID — 실시간 크레인 ID 와 같은 자리(`GC-04`, `C_171`). 표시용 그대로
   * 저장하고 키 조립 때만 하이픈을 밑줄로 정규화한다. 정규화 결과가 장비마다
   * 유일해야 한다(sanitize). 공백·콜론 없음.
   */
  craneId: string;
  /** 구역 — 실시간 목록의 구역 칩과 같은 필터. */
  bay?: string;
  /** false 면 이 장비의 태그 전부를 내보내지 않는다. */
  enabled: boolean;
  /** 배열 순서가 표시 순서. */
  tags: VirtualTagDefinition[];
}

export interface VirtualTagSet {
  version: 3;
  /** 값 갱신 주기(초). [VIRTUAL_TAG_TICK_MIN, VIRTUAL_TAG_TICK_MAX]. */
  tickSec: number;
  equipments: VirtualEquipment[];
}

/** 재생 배속 선택지. 시뮬레이션 시계에만 적용되고 저장하지 않는다(세션). */
export const SIMULATION_SPEED_OPTIONS = [0.5, 1, 2, 4, 8] as const;

export const VIRTUAL_EQUIPMENTS_MAX = 100;
export const VIRTUAL_EQUIPMENT_TAGS_MAX = 100;
export const VIRTUAL_EQUIPMENT_ID_MAX = 32;
export const VIRTUAL_EQUIPMENT_BAY_MAX = 20;
export const VIRTUAL_TAG_CODE_MAX = 48;
export const VIRTUAL_TAG_NAME_MAX = 40;
export const VIRTUAL_TAG_UNIT_MAX = 12;
/** 갱신 주기(초). 하한은 한 프레임(16ms). */
export const VIRTUAL_TAG_TICK_MIN = 0.016;
export const VIRTUAL_TAG_TICK_MAX = 5;
export const VIRTUAL_TAG_TICK_DEFAULT = 0.1;
/** 파형 주기(초). */
export const VIRTUAL_TAG_PERIOD_MIN = 0.1;
export const VIRTUAL_TAG_PERIOD_MAX = 600;
export const VIRTUAL_TAG_PERIOD_DEFAULT = 8;
/** 초 단위 시간의 저장 해상도(소수 자리) — ms 까지. 그 아래는 부동소수 잡음이다. */
export const VIRTUAL_TAG_SECONDS_DECIMALS = 3;
