import { numRound, radToDeg } from '@crane/domain/3d';
import type { Vector3Tuple } from '@crane/core/types/math';
import type { SceneTransformField } from '../model/types';
import type { SceneSnapStep } from './snap-storage';

/**
 * 스냅 격자 계산. 격자는 **씬에 저장되고 인스펙터가 보여 주는 값**(부모 프레임
 * 위치 m · 오일러 도 · 배율) 위에 놓인다. three TransformControls 의
 * `translationSnap` 등은 쓰지 않는다 — 그 스냅은 `space='local'` 이면 객체의
 * 회전된 프레임에 격자를 놓아, yaw 로 돌아간 모델의 X·Z 저장값이 정수가 되지
 * 않는다(Y 는 yaw 에 영향받지 않아 멀쩡해 보여 "X 만 안 된다" 로 보고됐다).
 * 회전은 world 공간에서 델타 기준이라 시작 소수점이 끝까지 남는 문제도 있었다.
 *
 * 기즈모(use-scene-transform liveSync)와 인스펙터 스테퍼(InputNumber stepValue)
 * 가 같은 함수를 써서 두 경로의 격자가 일치한다. 직접 타이핑한 값은 스냅하지
 * 않는다(Blender 와 같은 관례).
 */

/**
 * 드래그 시작 대비 "축이 변했다" 판정 오차. 비교 대상은 3자리 반올림값이라
 * 그보다 작은 값이면 충분하고, 회전된 프레임에서 오는 1e-17 급 부동소수
 * 잡음(안 움직인 축)을 변화로 오인하지 않는다.
 */
const CHANGE_EPSILON = 1e-6;

/** 소수 자릿수. 1e-7 같은 지수 표기도 센다. */
function countDecimals(n: number): number {
  const text = String(n);
  const exp = /e-(\d+)$/.exec(text);
  if (exp)
    return Number(exp[1]) + (text.split('.')[1]?.split('e')[0].length ?? 0);
  return text.split('.')[1]?.length ?? 0;
}

function isValidStep(step: number): boolean {
  return Number.isFinite(step) && step > 0;
}

/**
 * value 를 step 의 배수 격자 중 가장 가까운 값으로 옮긴다(절대값 기준,
 * 원점 0). `Math.round(v/step)*step` 의 부동소수 잡음(0.30000000000000004)은
 * step 자릿수+3 으로 반올림해 지운다. 이미 격자 위면 같은 값을 그대로
 * 돌려주고, 비유한 값이나 step ≤ 0 은 원값을 돌려준다.
 */
export function snapToStep(value: number, step: number): number {
  if (!Number.isFinite(value) || !isValidStep(step)) return value;
  const precision = Math.min(10, countDecimals(step) + 3);
  const snapped = Number((Math.round(value / step) * step).toFixed(precision));
  if (Object.is(snapped, -0)) return 0;
  return snapped === value ? value : snapped;
}

/**
 * 스테퍼 한 칸 — 격자 밖이면 방향 쪽 가장 가까운 격자로, 격자 위면 ±step.
 * `-2209.316` 에서 ▲ 는 `-2209`, ▼ 는 `-2210`. InputNumber `stepValue` 로 주입.
 */
export function stepOnGrid(
  value: number,
  step: number,
  direction: 1 | -1,
): number {
  if (!Number.isFinite(value) || !isValidStep(step)) return value;
  const nearest = snapToStep(value, step);
  if (nearest !== value) {
    const towardDirection = direction > 0 ? nearest > value : nearest < value;
    if (towardDirection) return nearest;
    return snapToStep(nearest + direction * step, step);
  }
  return snapToStep(value + direction * step, step);
}

/**
 * 채널별 격자 단위를 인스펙터·저장값 단위로 돌려준다. rotation 은 저장값이
 * 라디안이라 도로 환산한다(15° 옵션이 15.000000000000002 가 되지 않게 3자리).
 */
export function snapStepFor(
  field: SceneTransformField,
  step: SceneSnapStep,
): number {
  if (field === 'position') return step.translation;
  if (field === 'rotation') return numRound(radToDeg(step.rotation), 3);
  return step.scale;
}

/**
 * 드래그 중 스냅 — 시작값 대비 **변한 축만** 격자로 옮긴다. X 드래그 중
 * Y=0.35 같은 안 움직인 축을 격자로 끌어오면 객체가 드래그 축 밖으로
 * 튀므로 그대로 둔다. 어느 축도 바뀌지 않으면 `current` 참조를 그대로
 * 돌려준다(리렌더·되쓰기 없음).
 *
 * rotation 은 [0,360) 정규화 전의 연속 오일러(도)에 적용한다 — 정규화는
 * 커밋 경로(roundCommittedField)가 한다.
 */
export function snapChangedAxes(
  start: Vector3Tuple,
  current: Vector3Tuple,
  step: number,
): Vector3Tuple {
  if (!isValidStep(step)) return current;
  let changed = false;
  const next = current.map((value, i) => {
    if (Math.abs(value - start[i]) <= CHANGE_EPSILON) return value;
    const snapped = snapToStep(value, step);
    if (snapped !== value) changed = true;
    return snapped;
  }) as Vector3Tuple;
  return changed ? next : current;
}
