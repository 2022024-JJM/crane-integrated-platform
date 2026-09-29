import type { Vector3Tuple } from '@crane/core/types/math';

/**
 * 거리 눈금 — 에디터에서 바닥에 두 점을 찍어 그리는 씬 객체. 시작점에서
 * 끝점까지 일정 간격마다 점과 거리 숫자를 보여 준다(ACMS 매뉴얼 II-6 의 GC
 * 레일 눈금이 출발점이지만 어느 객체에도 묶이지 않는다).
 *
 * 숫자는 **씬에서 잰 거리**다. 태그(PLC) 값과는 무관하므로 둘을 맞추려면
 * 시작점을 PLC 원점에 두거나 `startValue` 에 그 지점의 PLC 값을 넣는다.
 *
 * 단위가 섞여 있다 — 그린 기하(`length`·보조선 길이)는 position 과 같은 씬
 * unit 이고, 숫자에 해당하는 값(`interval`·`startValue`)은 m 다. 그린 범위는
 * region 축척 표(scene-unit-scale.ts)가 바뀌어도 움직이지 않아야 하고, 눈금은
 * 항상 떨어지는 m 값(100·200…)에 서야 하기 때문이다.
 *
 * 방어는 lib/sanitize-rulers.ts, 눈금 위치·기본 간격 계산은 lib/ruler.ts.
 */

/** 고를 수 있는 눈금 간격(m, 오름차순). */
export const RULER_INTERVALS = [50, 100] as const;

export type SceneRulerInterval = (typeof RULER_INTERVALS)[number];

/** ACMS 눈금의 간격. 간격이 깨진 저장본의 폴백이기도 하다. */
export const RULER_INTERVAL_DEFAULT: SceneRulerInterval = 100;

export function isRulerInterval(value: unknown): value is SceneRulerInterval {
  return (RULER_INTERVALS as readonly unknown[]).includes(value);
}

/** ACMS 그림의 점·글자 색. 색이 깨진 저장본의 폴백이기도 하다. */
export const RULER_DEFAULT_COLOR = '#ffffff';

/** 점·글자의 크기 단계(작은 순). 픽셀 값은 lib/ruler.ts. */
export const RULER_SIZES = ['s', 'm', 'l'] as const;

export type SceneRulerSize = (typeof RULER_SIZES)[number];

/** ACMS 그림의 크기. 기본이라 저장하지 않는다. */
export const RULER_SIZE_DEFAULT: SceneRulerSize = 'm';

export function isRulerSize(value: unknown): value is SceneRulerSize {
  return (RULER_SIZES as readonly unknown[]).includes(value);
}

/** 새 보조선의 길이(m). 켤 때 씬 unit 으로 환산해 저장한다. */
export const RULER_GUIDE_DEFAULT_LENGTH_M = 100;

/** 보조선 불투명도 범위 — 모델 투명도와 같은 하한. 기본(1)은 저장하지 않는다. */
export const RULER_GUIDE_OPACITY_MIN = 0.1;
export const RULER_GUIDE_OPACITY_DEFAULT = 1;

/** 이보다 짧게 그린 눈금은 만들지 않는다(씬 unit) — 같은 자리 두 번 클릭 방어. */
export const RULER_MIN_LENGTH = 0.01;

/** 보조선이 뻗는 쪽 — 진행 방향(시작점 → 끝점)을 바라볼 때의 왼쪽·오른쪽. */
export type SceneRulerGuideSide = 'left' | 'right';

export const RULER_GUIDE_SIDES = [
  'left',
  'right',
] as const satisfies readonly SceneRulerGuideSide[];

export const RULER_GUIDE_SIDE_DEFAULT: SceneRulerGuideSide = 'left';

/**
 * 보조선 — 눈금 점마다 진행 방향의 수직으로 긋는 선. 점에서 시작해 **한쪽
 * 으로만** 뻗는다(점을 가운데 두고 양쪽으로 늘지 않는다).
 */
export interface SavedRulerGuide {
  /** 길이(씬 unit), > 0. */
  length: number;
  /** `#rrggbb` 소문자. */
  color: string;
  /** 뻗는 쪽. `'right'` 만 저장하고 기본(`'left'`)은 생략한다. */
  side?: SceneRulerGuideSide;
  /** 불투명도 [RULER_GUIDE_OPACITY_MIN, 1]. 1 이면 생략. */
  opacity?: number;
}

export interface SavedRulerInfo {
  id: string;
  /** 계층 목록 표시 이름. 빈 문자열 허용 — 목록이 "Ruler" 로 폴백한다. */
  name: string;
  /** 시작점. */
  position: Vector3Tuple;
  /** 오일러 도. 로컬 +X 가 진행 방향이다(두 점에서 Y 회전을 계산). */
  rotation: Vector3Tuple;
  /** 그린 길이(씬 unit), > 0. */
  length: number;
  /** 눈금 간격(m). RULER_INTERVALS 중 하나. */
  interval: SceneRulerInterval;
  /** 거리 숫자의 색. `#rrggbb` 소문자. */
  textColor: string;
  /** 눈금 점의 색. `#rrggbb` 소문자. */
  dotColor: string;
  /** 거리 숫자의 크기. 기본(`'m'`)이면 생략. */
  textSize?: SceneRulerSize;
  /** 눈금 점의 크기. 기본(`'m'`)이면 생략. */
  dotSize?: SceneRulerSize;
  /** 보조선. 없으면 점과 숫자만 그린다. */
  guide?: SavedRulerGuide;
  /** 시작점의 거리 값(m). 0 이면 생략. */
  startValue?: number;
  /** 숫자 뒤의 `m` 을 숨긴다. true 만 저장. */
  unitHidden?: boolean;
  /** 편집 잠금 — 모델·텍스트와 같은 true-only 규칙. */
  locked?: boolean;
}
