import { describe, expect, it } from 'vitest';
import type { ModelStatusTags } from '@crane/domain/3d';
import {
  PREVIEW_CHOICES,
  describeLabelState,
  fromPreviewChoice,
  setStatusTag,
  toPreviewChoice,
} from '../status-tag-editor';

describe('setStatusTag', () => {
  it('역할에 키를 연결한다 — 다른 역할은 그대로', () => {
    const before: ModelStatusTags = { controlOn: 'A:on' };
    expect(setStatusTag(before, 'bypass', 'A:bypass')).toEqual({
      controlOn: 'A:on',
      bypass: 'A:bypass',
    });
  });

  it('이미 연결된 역할의 키를 바꾼다', () => {
    expect(setStatusTag({ fault: 'A:old' }, 'fault', 'A:new')).toEqual({
      fault: 'A:new',
    });
  });

  it('빈 키·공백뿐인 키는 그 역할을 뗀다', () => {
    const before: ModelStatusTags = { controlOn: 'A:on', fault: 'A:fault' };
    expect(setStatusTag(before, 'fault', '')).toEqual({ controlOn: 'A:on' });
    expect(setStatusTag(before, 'fault', '   ')).toEqual({ controlOn: 'A:on' });
  });

  it('마지막 역할을 떼면 빈 객체가 된다', () => {
    expect(setStatusTag({ bypass: 'A:b' }, 'bypass', '')).toEqual({});
  });

  it('앞뒤 공백은 잘라 싣는다', () => {
    expect(setStatusTag({}, 'freeSwing', '  A:swing ')).toEqual({
      freeSwing: 'A:swing',
    });
  });

  it('바뀌는 것이 없으면 같은 참조를 돌려준다', () => {
    const before: ModelStatusTags = { controlOn: 'A:on' };
    // 같은 키 재설정.
    expect(setStatusTag(before, 'controlOn', 'A:on')).toBe(before);
    // 공백만 다른 같은 키.
    expect(setStatusTag(before, 'controlOn', ' A:on ')).toBe(before);
    // 연결한 적 없는 역할을 뗀다.
    expect(setStatusTag(before, 'fault', '')).toBe(before);
    const empty: ModelStatusTags = {};
    expect(setStatusTag(empty, 'bypass', '  ')).toBe(empty);
  });

  it('입력 객체를 바꾸지 않는다', () => {
    const before: ModelStatusTags = { controlOn: 'A:on' };
    setStatusTag(before, 'controlOn', 'A:other');
    setStatusTag(before, 'controlOn', '');
    expect(before).toEqual({ controlOn: 'A:on' });
  });

  it('외곽선 역할도 같은 규칙으로 잇고 뗀다 — 역할마다 따로', () => {
    const linked = setStatusTag(
      setStatusTag({ controlOn: 'A:on' }, 'slowdown', 'A:slow'),
      'endstop',
      'A:end',
    );
    expect(linked).toEqual({
      controlOn: 'A:on',
      slowdown: 'A:slow',
      endstop: 'A:end',
    });
    expect(setStatusTag(linked, 'slowdown', '')).toEqual({
      controlOn: 'A:on',
      endstop: 'A:end',
    });
    expect(setStatusTag(linked, 'commError', '  ')).toBe(linked);
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
