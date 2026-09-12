import { describe, expect, it } from 'vitest';
import { createLocalAlarm, localAlarmActiveKey } from '../local-alarm';

const base = {
  eventType: 'zone_intrusion' as const,
  subject: 'm1#z1|m2',
  regionId: 'philly-dock-2',
  craneId: 'm1',
  craneName: 'LLC-002',
  severity: 'high' as const,
  alarmName: '영역 침범',
  at: 1_700_000_000_000,
};

describe('createLocalAlarm', () => {
  it('발생 레코드는 id 가 local:<type>:<subject>:<at>, ISO 시각, 설명 기본 null', () => {
    const alarm = createLocalAlarm({ ...base, active: true });
    expect(alarm.id).toBe('local:zone_intrusion:m1#z1|m2:1700000000000');
    expect(alarm.active).toBe(true);
    expect(alarm.timestamp).toBe(new Date(base.at).toISOString());
    expect(alarm.alarmDescription).toBeNull();
    expect(alarm.regionId).toBe('philly-dock-2');
  });

  it('해제 레코드는 openedAt 기준 id 에 :clear 가 붙고 시각은 해제 시각', () => {
    const alarm = createLocalAlarm({
      ...base,
      active: false,
      at: base.at + 5000,
      openedAt: base.at,
    });
    expect(alarm.id).toBe('local:zone_intrusion:m1#z1|m2:1700000000000:clear');
    expect(alarm.timestamp).toBe(new Date(base.at + 5000).toISOString());
  });

  it('openedAt 이 없는 해제는 자기 시각으로 id 를 만든다', () => {
    const alarm = createLocalAlarm({ ...base, active: false, at: 5 });
    expect(alarm.id).toBe('local:zone_intrusion:m1#z1|m2:5:clear');
  });
});

describe('localAlarmActiveKey', () => {
  it('region·crane·type·subject 를 잇는다', () => {
    expect(localAlarmActiveKey(base)).toBe(
      'philly-dock-2:m1:zone_intrusion:m1#z1|m2',
    );
  });
});
