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

/**
 * 속도·가속 한계(태그 단위/초, 단위/초²). 있으면 러너가 파형·시나리오 목표값을
 * 향해 램프한다(lib/rate-limit.ts) — 사인파 주기를 줄이거나 배속을 올려도
 * 장비가 순간이동하지 않는다. manual 슬라이더는 즉시 반영이라 적용되지 않는다.
 * 둘 다 선택이고 0 이하·비유한수는 생략된다.
 */
export interface VirtualTagLimits {
  maxSpeed?: number;
  maxAccel?: number;
}

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
  /** 속도·가속 한계. 없으면 목표값으로 바로 간다. */
  limits?: VirtualTagLimits;
}

export interface VirtualTagSet {
  version: 1;
  /** 값 갱신 주기(ms). [VIRTUAL_TAG_TICK_MIN, VIRTUAL_TAG_TICK_MAX]. */
  tickMs: number;
  tags: VirtualTagDefinition[];
  /** 시나리오 목록. 비면 생략(직렬화에서 빠진다). */
  scenarios?: VirtualScenario[];
}

/**
 * 시나리오 — 태그 키별 키프레임 타임라인. 파형(pattern)이 "계속 흔드는"
 * 데모라면 시나리오는 "0초 주행 0m → 20초 주행 80m → 5초 정지 → …" 처럼
 * 작업 순서를 기술한다. 재생 중 시나리오가 활성이면 트랙이 있는 태그는
 * 키프레임 보간값이 파형을 대신하고, 트랙이 없는 태그는 파형 그대로다(배경
 * 움직임 유지). 값은 태그 범위로 클램프된다.
 *
 * 키프레임의 `ease` 는 **직전 키프레임에서 이 키프레임으로 오는 구간**의
 * 보간 방식이다(첫 키프레임의 ease 는 무의미). 트랙은 `atMs` 오름차순으로
 * 저장된다(sanitize 가 정렬). 시나리오 길이 = 모든 트랙의 마지막 atMs.
 */
export type ScenarioEase = 'linear' | 'hold' | 'smooth';

export interface ScenarioKeyframe {
  /** 시나리오 시작 기준 시각(ms), ≥ 0. */
  atMs: number;
  value: number;
  /** 생략 = linear. hold 는 이 키프레임 시각까지 이전 값을 유지(계단). */
  ease?: ScenarioEase;
}

export interface ScenarioTrack {
  /** 가상 태그 key(값 버스 키). 태그가 없어도 저장은 되고 러너가 무시한다. */
  key: string;
  /** ≥ 1개, atMs 오름차순·중복 없음. */
  keyframes: ScenarioKeyframe[];
}

export interface VirtualScenario {
  id: string;
  name: string;
  /** 끝에 도달하면 처음부터 반복. false 면 끝에서 러너가 일시정지한다. */
  loop: boolean;
  tracks: ScenarioTrack[];
}

export const SCENARIO_EASES = [
  'linear',
  'hold',
  'smooth',
] as const satisfies readonly ScenarioEase[];
export const SCENARIOS_MAX = 50;
export const SCENARIO_NAME_MAX = 40;
export const SCENARIO_TRACKS_MAX = 100;
export const SCENARIO_KEYFRAMES_MAX = 200;
/** 키프레임 시각 상한(6시간) — 오타(ms/s 혼동)로 하루짜리 시나리오가 되는 것 방지. */
export const SCENARIO_TIME_MAX_MS = 6 * 60 * 60 * 1000;
/** 재생 배속 선택지. 시뮬레이션 시계에만 적용되고 저장하지 않는다(세션). */
export const SIMULATION_SPEED_OPTIONS = [0.5, 1, 2, 4, 8] as const;

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
