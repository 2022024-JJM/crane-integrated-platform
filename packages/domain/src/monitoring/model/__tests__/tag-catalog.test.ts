import { describe, expect, it } from 'vitest';
import { getMonitoringTagMetadata } from '../tag-catalog';

describe('getMonitoringTagMetadata — 서버 태그 코드의 영문 표시명', () => {
  it('거리 태그는 접두어 뒤 공백 하나로 "TL Distance" · "TS#1 Distance" 가 된다', () => {
    expect(getMonitoringTagMetadata('tl_distance').displayName).toBe(
      'TL Distance',
    );
    expect(getMonitoringTagMetadata('ts1_distance').displayName).toBe(
      'TS#1 Distance',
    );
    expect(
      getMonitoringTagMetadata('ts_1st_gear_distance_value').displayName,
    ).toBe('TS 1st Gear Distance');
    expect(
      getMonitoringTagMetadata('tl_stop_gear_distance_value').displayName,
    ).toBe('TL Stop Gear Distance');
  });

  it('무게·높이·상태 비트는 인덱스를 #으로 붙인다', () => {
    expect(getMonitoringTagMetadata('mh1_weight')).toMatchObject({
      displayName: 'MH#1 Weight',
      category: 'measurement',
      unit: 'ton',
    });
    expect(getMonitoringTagMetadata('ah2_height')).toMatchObject({
      displayName: 'AH#2 Height',
      unit: 'm',
    });
    expect(getMonitoringTagMetadata('ts3_status')).toMatchObject({
      displayName: 'TS#3 Status',
      category: 'status',
      alarm: false,
    });
  });

  it('시각 태그는 datetime, 알람 비트는 alarm=true, 모르는 코드는 단어 단위 대문자화', () => {
    expect(getMonitoringTagMetadata('year')).toMatchObject({
      displayName: 'Year',
      category: 'datetime',
    });
    expect(getMonitoringTagMetadata('e_stop_on')).toMatchObject({
      displayName: 'E Stop On',
      alarm: true,
    });
    expect(getMonitoringTagMetadata('crane_control_on').alarm).toBe(false);
    expect(getMonitoringTagMetadata('some_new_bit').displayName).toBe(
      'Some New Bit',
    );
  });

  it('서버 스키마 항목이 있으면 그 값을 우선하고 빈 표시명만 코드에서 만든다', () => {
    expect(
      getMonitoringTagMetadata('mh1_weight', {
        displayName: '',
        category: '',
        dataType: 'REAL',
        unit: 'kg',
        alarm: false,
        slot: 3,
      }),
    ).toMatchObject({
      displayName: 'Mh1 Weight',
      category: 'status',
      unit: 'kg',
    });
  });
});
