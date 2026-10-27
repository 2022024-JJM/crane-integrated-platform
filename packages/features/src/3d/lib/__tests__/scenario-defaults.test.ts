import { describe, expect, it } from 'vitest';
import {
  createScenarioTagDefaults,
  SCENARIO_NUMBER_DEFAULT_RANGE,
} from '../scenario-defaults';

const target = {
  kind: 'node',
  node: '',
  channel: 'position',
  axis: 'z',
} as const;

describe('createScenarioTagDefaults', () => {
  it('상태 태그 역할은 불리언 OFF·수동', () => {
    expect(
      createScenarioTagDefaults({
        code: 'crane_system_error',
        source: 'status',
        role: 'fault',
      }),
    ).toEqual({
      code: 'crane_system_error',
      name: '',
      dataType: 'bool',
      min: 0,
      max: 1,
      initial: 0,
      pattern: { kind: 'manual' },
    });
  });

  it('맵핑 코드는 숫자 기본 범위·초기 0·수동이고 단위는 서버 메타에서', () => {
    expect(
      createScenarioTagDefaults({
        code: 'mh1_height',
        source: 'mapping',
        mappingId: 'm',
        target,
      }),
    ).toEqual({
      code: 'mh1_height',
      name: '',
      dataType: 'number',
      unit: 'm',
      min: SCENARIO_NUMBER_DEFAULT_RANGE.min,
      max: SCENARIO_NUMBER_DEFAULT_RANGE.max,
      initial: SCENARIO_NUMBER_DEFAULT_RANGE.min,
      pattern: { kind: 'manual' },
    });
  });

  it('메타에 단위가 없는 코드는 unit 필드를 두지 않는다', () => {
    const out = createScenarioTagDefaults({
      code: 'custom_code',
      source: 'mapping',
      mappingId: 'm',
      target,
    });
    expect(out).not.toHaveProperty('unit');
    expect(out.dataType).toBe('number');
  });
});
