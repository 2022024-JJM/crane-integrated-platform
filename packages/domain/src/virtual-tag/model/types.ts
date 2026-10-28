/**
 * 시뮬레이션 시나리오 — 서버(PLC) 없이 태그 값을 흘려보내는 정의.
 *
 * 시나리오는 **씬에 이미 맵핑된 모델·태그 중 고른 것**에 값·동작을 붙인
 * 것이다. 태그는 `modelId + code` 로 저장하고 값 버스 키 `크레인ID.코드` 는
 * 재생 때 그 씬의 모델 `craneId` 로 조립한다(features scenario-entries) —
 * 에디터에서 모델의 크레인을 바꾸면 시나리오가 따라온다. 시나리오에 없는
 * 태그는 값이 나가지 않는다(노드는 rest).
 *
 * 값 변화는 `pattern` 이 정한다. manual 만 사용자가 슬라이더(불리언은 토글)로
 * 밀고, 나머지는 시간의 함수(파형)라 결정론적으로 재현된다. 시간 단위는 저장본
 * 전체가 **초**다(`tickSec`·`periodSec`). 러너 내부 시계는 ms 이고 경계에서
 * 변환한다.
 */
export type VirtualTagPattern =
  | { kind: 'manual' }
  /** min↔max 부드러운 왕복. 옛 삼각파(`triangle`)는 sanitize 가 이것으로 읽는다. */
  | { kind: 'sine'; periodSec: number }
  /** min→max 톱니. */
  | { kind: 'sawtooth'; periodSec: number }
  /** dutyPct(0~100, 기본 50) 동안 max, 나머지 min. */
  | { kind: 'square'; periodSec: number; dutyPct?: number }
  /**
   * 시각별 키프레임 — 작업 순서(접근→하강→부착→권상→이동→하강→분리)처럼
   * 파형으로 못 적는 흐름. 점 사이는 숫자면 선형 보간, 불리언이면 앞 점의 값을
   * 유지(계단). 첫 점 앞은 첫 값, 마지막 점 뒤는 마지막 값이고, `loop` 면
   * 마지막 점의 시각을 주기로 되감는다. 점은 `atSec` 오름차순(sanitize).
   */
  | {
      kind: 'keyframes';
      points: VirtualTagKeyframe[];
      loop?: boolean;
      /**
       * 점 사이 보간. 생략 = 선형(등속). `smooth` 는 각 구간을 smoothstep 으로
       * 이어 점마다 속도 0 에서 출발·정지한다 — 크레인 주행·권상의 가감속.
       * 불리언(계단)에는 영향이 없다.
       */
      ease?: 'smooth';
    };

export interface VirtualTagKeyframe {
  /** 재생 시작 기준 초(≥ 0). */
  atSec: number;
  value: number;
}

export type VirtualTagPatternKind = VirtualTagPattern['kind'];

export const VIRTUAL_TAG_PATTERN_KINDS = [
  'manual',
  'sine',
  'sawtooth',
  'square',
  'keyframes',
] as const satisfies readonly VirtualTagPatternKind[];

/** 불리언 태그가 가질 수 있는 패턴 — 0/1 사이를 뛰는 것만 의미가 있다. */
export const VIRTUAL_TAG_BOOL_PATTERN_KINDS = [
  'manual',
  'square',
  'keyframes',
] as const satisfies readonly VirtualTagPatternKind[];

/** 키프레임 점 개수 상한 — 한 작업 순서가 수십 점이면 충분하다. */
export const VIRTUAL_TAG_KEYFRAMES_MAX = 200;

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
  /** 시나리오 안에서 고유한 행 식별자. 외부(씬)에서 참조하지 않는다. */
  id: string;
  /** 태그 코드 — 모델 맵핑·상태 태그의 코드와 같다. 공백·점·콜론 없음. */
  code: string;
  /** 표시명. 비면 맵핑 대상(노드·역할)을 보인다. */
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

/** 시나리오의 태그 하나 — 씬 모델 하나의 맵핑 코드에 붙인 값 정의. */
export interface ScenarioTag extends VirtualTagDefinition {
  /** 씬 모델 id(`SavedModelInfo.id`). 그 모델의 craneId 가 키의 앞부분이다. */
  modelId: string;
}

export interface SimulationScenario {
  /** 내부 식별자(활성 선택·라우트). */
  id: string;
  /** 표시 이름. SCENARIO_NAME_MAX. */
  name: string;
  /** 씬 파일 이름(`okpo.json`) — 이 씬의 모델만 가리킨다. region 과 무관. */
  sceneFile: string;
  /** 배열 순서가 표시 순서. `(modelId, code)` 가 시나리오 안에서 유일하다. */
  tags: ScenarioTag[];
}

export interface ScenarioSet {
  version: 1;
  /** 값 갱신 주기(초). [VIRTUAL_TAG_TICK_MIN, VIRTUAL_TAG_TICK_MAX]. 전역. */
  tickSec: number;
  scenarios: SimulationScenario[];
}

/** 재생 배속 선택지. 시뮬레이션 시계에만 적용되고 저장하지 않는다(세션). */
export const SIMULATION_SPEED_OPTIONS = [0.5, 1, 2, 4, 8] as const;

export const SCENARIOS_MAX = 50;
export const SCENARIO_NAME_MAX = 40;
export const SCENARIO_TAGS_MAX = 500;
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
