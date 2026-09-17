import { describe, expect, it } from 'vitest';
import { getZoneAlarmMeta } from '../zone-alarm-meta';

describe('getZoneAlarmMeta', () => {
  it('zone_intrusion 이 아니면 null', () => {
    expect(
      getZoneAlarmMeta({
        eventType: 'wind_warning_exceeded',
        eventData: { zoneKey: 'a#z', color: '#112233' },
      }),
    ).toBeNull();
  });

  it('eventData 가 없거나 zoneKey 가 결손·빈 문자열·숫자면 null', () => {
    expect(getZoneAlarmMeta({ eventType: 'zone_intrusion' })).toBeNull();
    expect(
      getZoneAlarmMeta({ eventType: 'zone_intrusion', eventData: {} }),
    ).toBeNull();
    expect(
      getZoneAlarmMeta({
        eventType: 'zone_intrusion',
        eventData: { zoneKey: '' },
      }),
    ).toBeNull();
    expect(
      getZoneAlarmMeta({
        eventType: 'zone_intrusion',
        eventData: { zoneKey: 1 },
      }),
    ).toBeNull();
  });

  it('정상이면 zoneKey 와 소문자 색을 돌려준다', () => {
    expect(
      getZoneAlarmMeta({
        eventType: 'zone_intrusion',
        eventData: { zoneKey: 'crane-1#z1', color: '#38BDF8', intruder: 'b' },
      }),
    ).toEqual({ zoneKey: 'crane-1#z1', color: '#38bdf8' });
  });

  it("색이 없거나 '#rrggbb' 가 아니면(이름·짧은 hex·숫자) color 만 null", () => {
    for (const color of [undefined, 'red', '#fff', '#12345', 0x112233]) {
      expect(
        getZoneAlarmMeta({
          eventType: 'zone_intrusion',
          eventData:
            color === undefined
              ? { zoneKey: 'a#z' }
              : { zoneKey: 'a#z', color },
        }),
      ).toEqual({ zoneKey: 'a#z', color: null });
    }
  });
});
