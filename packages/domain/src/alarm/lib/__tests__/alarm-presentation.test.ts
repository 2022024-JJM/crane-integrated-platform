import { describe, expect, it } from 'vitest';
import {
  getAlarmRiskLevelLabel,
  getAlarmSeverityLabel,
} from '../alarm-presentation';

describe('getAlarmRiskLevelLabel', () => {
  it('심각도를 위험 수준 문구(위험/경고/주의/정보)로 바꾼다', () => {
    expect(getAlarmRiskLevelLabel('critical', 'ko')).toBe('위험');
    expect(getAlarmRiskLevelLabel('high', 'ko')).toBe('경고');
    expect(getAlarmRiskLevelLabel('medium', 'ko')).toBe('주의');
    expect(getAlarmRiskLevelLabel('info', 'ko')).toBe('정보');
  });

  it('언어 접두로 로케일을 고르고 모르는 언어는 영어다', () => {
    expect(getAlarmRiskLevelLabel('high', 'ko-KR')).toBe('경고');
    expect(getAlarmRiskLevelLabel('high', 'la')).toBe('Monitum');
    expect(getAlarmRiskLevelLabel('high', 'en-US')).toBe('Warning');
    expect(getAlarmRiskLevelLabel('high', 'fr')).toBe('Warning');
    expect(getAlarmRiskLevelLabel('high', '')).toBe('Warning');
  });

  it('심각도 분류 라벨과는 별개다(이력·통계 표는 그대로)', () => {
    expect(getAlarmSeverityLabel('high', 'ko')).toBe('높음');
    expect(getAlarmSeverityLabel('medium', 'ko')).toBe('중간');
    expect(getAlarmSeverityLabel('high', 'xx')).toBe('High');
  });
});
