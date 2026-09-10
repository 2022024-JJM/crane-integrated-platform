import {
  clampToTag,
  stepVirtualTag,
  type VirtualTagDefinition,
} from '@crane/domain/virtual-tag';
import { applyTagBinding } from '../model/rig-value-store';
import type { TagMappingIndex } from './tag-mapping-index';

/**
 * 충돌 예측의 값 계산 — "N초 뒤 태그 값" 과 그것을 값 저장소 주소로 옮기는
 * 순수 함수들.
 *
 * 시뮬레이션에서만 성립한다. 가상 태그의 시간 기반 파형은
 * `stepVirtualTag(def, elapsedMs, state)` 가 `elapsedMs` 만의 순수 함수라
 * 경과 시간을 앞으로 밀어 넣으면 미래 값이 정확히 나온다(tag-pattern 주석).
 * 실시간(WebSocket)은 값의 미래가 없고, `rigValueStore` 의 SmoothDamp 속도는
 * smoothTime(0.35s) 안에 target 으로 수렴해 외삽에 쓸 수 없다.
 *
 * `manual` 패턴은 `stepVirtualTag` 이 상태를 그대로 돌려주므로 미래값 =
 * 현재값이 된다 — 슬라이더로 세워 둔 태그가 저절로 움직이는 것으로 보이지
 * 않는다.
 */

/** 태그 id → 현재값. 러너(virtualTagRuntime)가 들고 있다. */
export type CurrentTagValue = (id: string) => number | undefined;

/**
 * `targetElapsedMs` 시점의 태그 값. 키는 `tagKey`(`${craneId}:${tagCode}`).
 *
 * `enabled: false` 태그는 값을 내보내지 않으므로(러너와 같은 규칙) 제외한다.
 * 같은 키를 가진 정의가 둘이면 뒤에 오는 것이 이긴다 — 스토어가 키 중복을
 * 막으므로 정상 경로에서는 생기지 않는다.
 */
export function sampleFutureTagValues(
  tags: readonly VirtualTagDefinition[],
  targetElapsedMs: number,
  currentValueOf: CurrentTagValue,
  out: Map<string, number> = new Map(),
): Map<string, number> {
  out.clear();
  const elapsed =
    Number.isFinite(targetElapsedMs) && targetElapsedMs > 0
      ? targetElapsedMs
      : 0;
  for (const def of tags) {
    if (!def.enabled) continue;
    const current = currentValueOf(def.id);
    const state = {
      value: clampToTag(def, current ?? def.initial),
    };
    out.set(def.key, stepVirtualTag(def, elapsed, state).value);
  }
  return out;
}

/**
 * 태그 값 맵 → 값 저장소 주소 맵. 맵핑 인덱스(`buildTagMappingIndex`)가
 * 태그 키마다 대상 주소·scale·offset 을 들고 있고, 환산은 라이브 경로와
 * 같은 `applyTagBinding` 을 쓴다.
 *
 * 한 주소를 여러 태그가 가리키면 뒤에 오는 것이 이긴다 — 라이브 경로가
 * 발행 순서대로 덮어쓰는 것과 같은 결과다(sanitize 가 같은 대상의 중복
 * 맵핑을 first-wins 로 걸러 정상 경로에서는 생기지 않는다).
 */
export function buildPredictedAddressValues(
  index: TagMappingIndex,
  tagValues: ReadonlyMap<string, number>,
  out: Map<string, number> = new Map(),
): Map<string, number> {
  out.clear();
  for (const [key, targets] of index) {
    const value = tagValues.get(key);
    if (value === undefined) continue;
    for (const target of targets) {
      out.set(target.address, applyTagBinding(target, value));
    }
  }
  return out;
}
