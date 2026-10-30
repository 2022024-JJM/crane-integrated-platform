import { describe, expect, it } from 'vitest';
import { sanitizeStatusTagEntries } from '../sanitize-status-tags';

describe('sanitizeStatusTagEntries', () => {
  it('코드 문자열은 그대로(trim), 레거시 키는 코드와 크레인 접두어로 나눈다', () => {
    expect(
      sanitizeStatusTagEntries({
        controlOn: ' crane_control_on ',
        fault: 'C_171.crane_system_error',
        bypass: 'GC_04:accs_bypass_on',
      }),
    ).toEqual({
      controlOn: { code: 'crane_control_on' },
      fault: { code: 'crane_system_error', craneKey: 'C_171' },
      bypass: { code: 'accs_bypass_on', craneKey: 'GC_04' },
    });
  });

  it('점이 둘 이상인 문자열은 점이 든 코드(외업 원본 이름)로 읽는다 — 크레인 접두어가 없다', () => {
    expect(
      sanitizeStatusTagEntries({
        controlOn: ' 4_Crane.4_CR01.0_state.01_Control_on_1 ',
        fault: '4_Crane.4_CR01.0_state.05_Local_PLC_comm_fault_1',
      }),
    ).toEqual({
      controlOn: { code: '4_Crane.4_CR01.0_state.01_Control_on_1' },
      fault: { code: '4_Crane.4_CR01.0_state.05_Local_PLC_comm_fault_1' },
    });
  });

  it('점이 하나면 레거시 키로 읽는다(경계) — 점 둘이 든 코드도 공백·콜론이 있으면 버린다', () => {
    expect(sanitizeStatusTagEntries({ fault: 'a.b' })).toEqual({
      fault: { code: 'b', craneKey: 'a' },
    });
    expect(sanitizeStatusTagEntries({ fault: 'a.b.c' })).toEqual({
      fault: { code: 'a.b.c' },
    });
    expect(sanitizeStatusTagEntries({ fault: 'a.b c.d' })).toBeUndefined();
    expect(sanitizeStatusTagEntries({ fault: 'a:b.c.d' })).toBeUndefined();
  });

  it('두 슬롯 객체(레거시)는 실시간 › 가상 › 단일 tagKey 순으로 첫 키를 쓴다', () => {
    expect(
      sanitizeStatusTagEntries({
        controlOn: { realtimeTagKey: 'C_171.crane_control_on' },
        fault: {
          realtimeTagKey: 'C_171.crane_system_error',
          virtualTagKey: 'GC_04:fault',
        },
        bypass: { virtualTagKey: 'GC_04:accs_bypass_on' },
        freeSwing: { tagKey: 'A:free_swing_on' },
      }),
    ).toEqual({
      controlOn: { code: 'crane_control_on', craneKey: 'C_171' },
      fault: { code: 'crane_system_error', craneKey: 'C_171' },
      bypass: { code: 'accs_bypass_on', craneKey: 'GC_04' },
      freeSwing: { code: 'free_swing_on', craneKey: 'A' },
    });
  });

  it('외곽선 역할만 있어도 된다 — 라벨 역할과 독립', () => {
    expect(
      sanitizeStatusTagEntries({ slowdown: 'accs_slowdown', endstop: 'A.end' }),
    ).toEqual({
      slowdown: { code: 'accs_slowdown' },
      endstop: { code: 'end', craneKey: 'A' },
    });
  });

  it('문자열·객체가 아니거나 코드가 비거나 금지 글자가 있으면 그 역할만 버린다', () => {
    expect(
      sanitizeStatusTagEntries({
        commError: true,
        slowdown: ['A.slow'],
        endstop: '  ',
        controlOn: { realtimeTagKey: '', virtualTagKey: '   ' },
        bypass: { realtimeTagKey: 1 },
        freeSwing: null,
        fault: 'A fault',
      }),
    ).toBeUndefined();
    expect(
      sanitizeStatusTagEntries({ bypass: { code: 'ok' }, fault: 'bad code' }),
    ).toEqual({ bypass: { code: 'ok' } });
  });

  it('객체가 아니면 undefined — null·배열·문자열·숫자', () => {
    expect(sanitizeStatusTagEntries(undefined)).toBeUndefined();
    expect(sanitizeStatusTagEntries(null)).toBeUndefined();
    expect(sanitizeStatusTagEntries([])).toBeUndefined();
    expect(sanitizeStatusTagEntries(['A.b'])).toBeUndefined();
    expect(sanitizeStatusTagEntries('A.b')).toBeUndefined();
    expect(sanitizeStatusTagEntries(1)).toBeUndefined();
  });

  it('모르는 역할은 싣지 않고, 남는 역할이 없으면 undefined', () => {
    expect(
      sanitizeStatusTagEntries({ notOperator: 'op', fault: 'fault' }),
    ).toEqual({ fault: { code: 'fault' } });
    expect(sanitizeStatusTagEntries({})).toBeUndefined();
    expect(
      sanitizeStatusTagEntries({ controlOn: '', unknownRole: 'b' }),
    ).toBeUndefined();
    expect(sanitizeStatusTagEntries({ controlOn: {} })).toBeUndefined();
  });

  it('출력의 역할 순서는 입력 순서와 무관하게 고정이다', () => {
    const out = sanitizeStatusTagEntries({
      endstop: 'e',
      slowdown: 'sd',
      commError: 'ce',
      freeSwing: 's',
      bypass: 'b',
      fault: 'f',
      controlOn: 'c',
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
    sanitizeStatusTagEntries(input);
    expect(input).toEqual({
      bypass: '  A.b  ',
      fault: { realtimeTagKey: ' x ' },
    });
  });
});
