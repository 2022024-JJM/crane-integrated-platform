import type { ModelTagCode } from '@crane/domain/3d';
import { getMonitoringTagMetadata } from '@crane/domain/monitoring';
import type { ScenarioTag } from '@crane/domain/virtual-tag';

/** 새 시나리오 태그의 정의 부분 — id·modelId 는 호출자가 붙인다. */
export type ScenarioTagDefaults = Omit<ScenarioTag, 'id' | 'modelId'>;

/** 숫자 태그의 기본 범위 — 사용자가 패널에서 바로 고칠 출발값이지 측정값이 아니다. */
export const SCENARIO_NUMBER_DEFAULT_RANGE = { min: 0, max: 100 } as const;

/**
 * 모델 맵핑 코드 하나로 시나리오 태그의 기본값을 만든다. 상태 태그 역할은
 * 불리언(OFF·수동), 트랜스폼 맵핑 코드는 숫자(0~100·초기 0·수동). 단위는
 * 서버 태그 카탈로그의 메타(없으면 생략). 이름은 비워 두고 표시는 맵핑 대상
 * (노드·채널·축 / 역할)을 쓴다.
 */
export function createScenarioTagDefaults(
  code: ModelTagCode,
): ScenarioTagDefaults {
  if (code.source === 'status') {
    return {
      code: code.code,
      name: '',
      dataType: 'bool',
      min: 0,
      max: 1,
      initial: 0,
      pattern: { kind: 'manual' },
    };
  }
  const unit = getMonitoringTagMetadata(code.code).unit;
  return {
    code: code.code,
    name: '',
    dataType: 'number',
    ...(unit ? { unit } : {}),
    min: SCENARIO_NUMBER_DEFAULT_RANGE.min,
    max: SCENARIO_NUMBER_DEFAULT_RANGE.max,
    initial: SCENARIO_NUMBER_DEFAULT_RANGE.min,
    pattern: { kind: 'manual' },
  };
}
