import { describe, expect, it } from 'vitest';
import type { ModelStatusTags } from '@crane/domain/3d';
import {
  PREVIEW_CHOICES,
  describeLabelState,
  fromPreviewChoice,
  setStatusTagCode,
  toPreviewChoice,
} from '../status-tag-editor';

describe('setStatusTagCode', () => {
  it('역할에 코드를 잇는다 — 다른 역할은 그대로, 앞뒤 공백은 자른다', () => {
    const before: ModelStatusTags = { controlOn: 'crane_control_on' };
    expect(setStatusTagCode(before, 'fault', ' crane_system_error ')).toEqual({
      controlOn: 'crane_control_on',
      fault: 'crane_system_error',
    });
    expect(before).toEqual({ controlOn: 'crane_control_on' });
  });

  it('이미 연결된 역할의 코드를 바꾼다', () => {
    expect(setStatusTagCode({ controlOn: 'a' }, 'controlOn', 'b')).toEqual({
      controlOn: 'b',
    });
  });

  it('빈 코드·공백·금지 글자(공백·콜론)는 그 역할을 뗀다 — 마지막 역할을 떼면 빈 객체', () => {
    const linked: ModelStatusTags = { controlOn: 'on', fault: 'f' };
    expect(setStatusTagCode(linked, 'fault', '')).toEqual({ controlOn: 'on' });
    expect(setStatusTagCode(linked, 'fault', '   ')).toEqual({
      controlOn: 'on',
    });
    expect(setStatusTagCode(linked, 'fault', 'a b')).toEqual({
      controlOn: 'on',
    });
    expect(setStatusTagCode({ fault: 'f' }, 'fault', 'a:b')).toEqual({});
  });

  it('점이 든 외업 원본 이름은 코드로 잇는다', () => {
    const code = '4_Crane.4_CR01.0_state.05_Local_PLC_comm_fault_1';
    expect(setStatusTagCode({}, 'commError', code)).toEqual({
      commError: code,
    });
  });

  it('바뀌는 것이 없으면 같은 참조를 돌려준다', () => {
    const linked: ModelStatusTags = { controlOn: 'on' };
    expect(setStatusTagCode(linked, 'controlOn', 'on')).toBe(linked);
    expect(setStatusTagCode(linked, 'controlOn', ' on ')).toBe(linked);
    expect(setStatusTagCode(linked, 'fault', '')).toBe(linked);
    expect(setStatusTagCode(linked, 'fault', '  ')).toBe(linked);
  });

  it('외곽선 역할도 같은 규칙으로 잇고 뗀다 — 역할마다 따로', () => {
    const linked = setStatusTagCode(
      setStatusTagCode({}, 'slowdown', 'accs_slowdown'),
      'endstop',
      'accs_endstop',
    );
    expect(linked).toEqual({
      slowdown: 'accs_slowdown',
      endstop: 'accs_endstop',
    });
    expect(setStatusTagCode(linked, 'slowdown', '')).toEqual({
      endstop: 'accs_endstop',
    });
    expect(setStatusTagCode(linked, 'commError', '  ')).toBe(linked);
  });
});

describe('toPreviewChoice / fromPreviewChoice', () => {
  it('값 ↔ 선택지', () => {
    expect(toPreviewChoice(undefined)).toBe('none');
    expect(toPreviewChoice(false)).toBe('off');
    expect(toPreviewChoice(true)).toBe('on');
    expect(fromPreviewChoice('none')).toBeNull();
    expect(fromPreviewChoice('off')).toBe(false);
    expect(fromPreviewChoice('on')).toBe(true);
  });

  it('모든 선택지가 왕복한다', () => {
    for (const choice of PREVIEW_CHOICES) {
      expect(toPreviewChoice(fromPreviewChoice(choice) ?? undefined)).toBe(
        choice,
      );
    }
  });
});

describe('describeLabelState', () => {
  const names = {
    tone: {
      fault: '고장',
      running: '가동',
      standby: '대기',
      off: '꺼짐',
      offline: '통신두절',
      unknown: '미확인',
    },
    bypass: 'Bypass On',
    freeSwing: 'Free Swing On',
    outline: {
      commError: '외곽선 회색',
      slowdown: '외곽선 황색',
      endstop: '외곽선 적색',
    },
  };

  it('아이콘이 없으면 색 이름만', () => {
    expect(
      describeLabelState(
        { tone: 'standby', bypass: false, freeSwing: false },
        names,
      ),
    ).toBe('대기');
  });

  it('켜진 아이콘을 순서대로 잇는다', () => {
    expect(
      describeLabelState(
        { tone: 'fault', bypass: true, freeSwing: false },
        names,
      ),
    ).toBe('고장 · Bypass On');
    expect(
      describeLabelState(
        { tone: 'running', bypass: true, freeSwing: true },
        names,
      ),
    ).toBe('가동 · Bypass On · Free Swing On');
    expect(
      describeLabelState(
        { tone: 'off', bypass: false, freeSwing: true },
        names,
      ),
    ).toBe('꺼짐 · Free Swing On');
  });

  it('외곽선이 없으면 적지 않는다 — 생략과 none 이 같다', () => {
    const state = { tone: 'running', bypass: true, freeSwing: false } as const;
    expect(describeLabelState(state, names)).toBe('가동 · Bypass On');
    expect(describeLabelState(state, names, 'none')).toBe('가동 · Bypass On');
  });

  it('외곽선은 아이콘 뒤, 맨 끝에 잇는다', () => {
    expect(
      describeLabelState(
        { tone: 'running', bypass: true, freeSwing: true },
        names,
        'endstop',
      ),
    ).toBe('가동 · Bypass On · Free Swing On · 외곽선 적색');
    expect(
      describeLabelState(
        { tone: 'standby', bypass: false, freeSwing: false },
        names,
        'slowdown',
      ),
    ).toBe('대기 · 외곽선 황색');
  });

  it('라벨 색이 없어도(미확인) 외곽선은 적는다', () => {
    expect(
      describeLabelState(
        { tone: 'unknown', bypass: false, freeSwing: false },
        names,
        'commError',
      ),
    ).toBe('미확인 · 외곽선 회색');
  });
});
