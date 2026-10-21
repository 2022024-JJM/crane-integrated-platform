import { describe, expect, it } from 'vitest';
import { sanitizeModelStatusTags } from '../sanitize-status-tags';

const rt = (key: string) => ({ realtimeTagKey: key });

describe('sanitizeModelStatusTags', () => {
  it('유효한 역할은 두 슬롯 객체 그대로 싣는다', () => {
    expect(
      sanitizeModelStatusTags({
        controlOn: { realtimeTagKey: 'C_171.crane_control_on' },
        fault: {
          realtimeTagKey: 'C_171.crane_system_error',
          virtualTagKey: 'GC_04.fault',
        },
        bypass: { virtualTagKey: 'GC_04.accs_bypass_on' },
        freeSwing: rt('GC_04.free_swing_on'),
        commError: rt('GC_04.plc_comm_error'),
        slowdown: rt('GC_04.accs_slowdown'),
        endstop: rt('GC_04.accs_endstop'),
      }),
    ).toEqual({
      controlOn: { realtimeTagKey: 'C_171.crane_control_on' },
      fault: {
        realtimeTagKey: 'C_171.crane_system_error',
        virtualTagKey: 'GC_04.fault',
      },
      bypass: { virtualTagKey: 'GC_04.accs_bypass_on' },
      freeSwing: rt('GC_04.free_swing_on'),
      commError: rt('GC_04.plc_comm_error'),
      slowdown: rt('GC_04.accs_slowdown'),
      endstop: rt('GC_04.accs_endstop'),
    });
  });

  it('단일 키 시절의 문자열은 실시간 슬롯으로 받는다(trim)', () => {
    expect(
      sanitizeModelStatusTags({ slowdown: ' A.slow ', endstop: 'A.end' }),
    ).toEqual({ slowdown: rt('A.slow'), endstop: rt('A.end') });
  });

  it('외곽선 역할만 있어도 된다 — 라벨 역할과 독립', () => {
    expect(
      sanitizeModelStatusTags({
        slowdown: { virtualTagKey: 'A.slow' },
        endstop: rt('A.end'),
      }),
    ).toEqual({ slowdown: { virtualTagKey: 'A.slow' }, endstop: rt('A.end') });
  });

  it('문자열·객체가 아니거나 두 키 다 비면 그 역할만 버린다', () => {
    expect(
      sanitizeModelStatusTags({
        commError: true,
        slowdown: ['A.slow'],
        endstop: '  ',
        controlOn: { realtimeTagKey: '', virtualTagKey: '   ' },
        bypass: { realtimeTagKey: 1 },
        freeSwing: null,
        fault: 'A.fault',
      }),
    ).toEqual({ fault: rt('A.fault') });
  });

  it('슬롯 값이 문자열이 아니면 그 슬롯만 버린다', () => {
    expect(
      sanitizeModelStatusTags({
        bypass: { realtimeTagKey: 1, virtualTagKey: ' A.b ' },
      }),
    ).toEqual({ bypass: { virtualTagKey: 'A.b' } });
  });

  it('객체가 아니면 undefined — null·배열·문자열·숫자', () => {
    expect(sanitizeModelStatusTags(undefined)).toBeUndefined();
    expect(sanitizeModelStatusTags(null)).toBeUndefined();
    expect(sanitizeModelStatusTags([])).toBeUndefined();
    expect(sanitizeModelStatusTags(['A.b'])).toBeUndefined();
    expect(sanitizeModelStatusTags('A.b')).toBeUndefined();
    expect(sanitizeModelStatusTags(1)).toBeUndefined();
  });

  it('모르는 역할은 싣지 않는다', () => {
    expect(
      sanitizeModelStatusTags({ notOperator: 'A.op', fault: 'A.fault' }),
    ).toEqual({ fault: rt('A.fault') });
  });

  it('남는 역할이 없으면 undefined — 빈 객체·전부 무효', () => {
    expect(sanitizeModelStatusTags({})).toBeUndefined();
    expect(
      sanitizeModelStatusTags({ controlOn: '', unknownRole: 'A.b' }),
    ).toBeUndefined();
    expect(sanitizeModelStatusTags({ controlOn: {} })).toBeUndefined();
  });

  it('출력의 역할 순서는 입력 순서와 무관하게 고정이다', () => {
    const out = sanitizeModelStatusTags({
      endstop: 'A.e',
      slowdown: 'A.sd',
      commError: 'A.ce',
      freeSwing: 'A.s',
      bypass: 'A.b',
      fault: 'A.f',
      controlOn: 'A.c',
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
    const input = { bypass: '  A.b  ', fault: { realtimeTagKey: ' x ' } };
    sanitizeModelStatusTags(input);
    expect(input).toEqual({
      bypass: '  A.b  ',
      fault: { realtimeTagKey: ' x ' },
    });
  });
});
