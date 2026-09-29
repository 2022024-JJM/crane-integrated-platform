import { describe, expect, it } from 'vitest';
import { sanitizeModelStatusTags } from '../sanitize-status-tags';

describe('sanitizeModelStatusTags', () => {
  it('유효한 역할은 그대로 싣는다', () => {
    expect(
      sanitizeModelStatusTags({
        controlOn: 'GC_04:crane_control_on',
        fault: 'GC_04:crane_system_error',
        bypass: 'GC_04:accs_bypass_on',
        freeSwing: 'GC_04:free_swing_on',
        commError: 'GC_04:plc_comm_error',
        slowdown: 'GC_04:accs_slowdown',
        endstop: 'GC_04:accs_endstop',
      }),
    ).toEqual({
      controlOn: 'GC_04:crane_control_on',
      fault: 'GC_04:crane_system_error',
      bypass: 'GC_04:accs_bypass_on',
      freeSwing: 'GC_04:free_swing_on',
      commError: 'GC_04:plc_comm_error',
      slowdown: 'GC_04:accs_slowdown',
      endstop: 'GC_04:accs_endstop',
    });
  });

  it('외곽선 역할만 있어도 된다 — 라벨 역할과 독립', () => {
    expect(
      sanitizeModelStatusTags({ slowdown: ' A:slow ', endstop: 'A:end' }),
    ).toEqual({ slowdown: 'A:slow', endstop: 'A:end' });
  });

  it('외곽선 역할도 문자열이 아니거나 비면 그 역할만 버린다', () => {
    expect(
      sanitizeModelStatusTags({
        commError: true,
        slowdown: ['A:slow'],
        endstop: '  ',
        fault: 'A:fault',
      }),
    ).toEqual({ fault: 'A:fault' });
  });

  it('일부 역할만 있어도 된다', () => {
    expect(sanitizeModelStatusTags({ bypass: 'A:b' })).toEqual({
      bypass: 'A:b',
    });
  });

  it('객체가 아니면 undefined — null·배열·문자열·숫자', () => {
    expect(sanitizeModelStatusTags(undefined)).toBeUndefined();
    expect(sanitizeModelStatusTags(null)).toBeUndefined();
    expect(sanitizeModelStatusTags([])).toBeUndefined();
    expect(sanitizeModelStatusTags(['A:b'])).toBeUndefined();
    expect(sanitizeModelStatusTags('A:b')).toBeUndefined();
    expect(sanitizeModelStatusTags(1)).toBeUndefined();
  });

  it('문자열이 아닌 키는 그 역할만 버리고 나머지는 살린다', () => {
    expect(
      sanitizeModelStatusTags({
        controlOn: 1,
        fault: null,
        bypass: { key: 'A:b' },
        freeSwing: 'A:swing',
      }),
    ).toEqual({ freeSwing: 'A:swing' });
  });

  it('빈 문자열·공백만 있는 키는 버리고, 앞뒤 공백은 잘라 싣는다', () => {
    expect(
      sanitizeModelStatusTags({
        controlOn: '',
        fault: '   ',
        bypass: '  A:b  ',
      }),
    ).toEqual({ bypass: 'A:b' });
  });

  it('모르는 역할은 싣지 않는다', () => {
    expect(
      sanitizeModelStatusTags({ notOperator: 'A:op', fault: 'A:fault' }),
    ).toEqual({ fault: 'A:fault' });
  });

  it('남는 역할이 없으면 undefined — 빈 객체·전부 무효', () => {
    expect(sanitizeModelStatusTags({})).toBeUndefined();
    expect(
      sanitizeModelStatusTags({ controlOn: '', unknownRole: 'A:b' }),
    ).toBeUndefined();
  });

  it('출력의 역할 순서는 입력 순서와 무관하게 고정이다', () => {
    const out = sanitizeModelStatusTags({
      endstop: 'A:e',
      slowdown: 'A:sd',
      commError: 'A:ce',
      freeSwing: 'A:s',
      bypass: 'A:b',
      fault: 'A:f',
      controlOn: 'A:c',
    });
    expect(Object.keys(out ?? {})).toEqual([
      'controlOn',
      'fault',
      'bypass',
      'freeSwing',
      'commError',
      'slowdown',
      'endstop',
    ]);
  });

  it('입력 객체를 바꾸지 않는다', () => {
    const input = { bypass: '  A:b  ', junk: 1 };
    sanitizeModelStatusTags(input);
    expect(input).toEqual({ bypass: '  A:b  ', junk: 1 });
  });
});
