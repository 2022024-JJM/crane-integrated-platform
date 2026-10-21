import { describe, expect, it } from 'vitest';
import {
  getPrimaryTagKey,
  getSlotTagKey,
  hasAnyTagKey,
  isTagKeySlotsEqual,
  setSlotTagKey,
  type TagKeySlots,
} from '../tag-mapping-types';
import { resolveStatusTagKeys } from '../status-tag-types';

const both: TagKeySlots = { realtimeTagKey: 'C_1:z', virtualTagKey: 'V:z' };

describe('getSlotTagKey / hasAnyTagKey / getPrimaryTagKey', () => {
  it('슬롯의 키를 돌려주고 빈 슬롯·없는 객체는 undefined', () => {
    expect(getSlotTagKey(both, 'realtime')).toBe('C_1:z');
    expect(getSlotTagKey(both, 'virtual')).toBe('V:z');
    expect(getSlotTagKey({ realtimeTagKey: '' }, 'realtime')).toBeUndefined();
    expect(getSlotTagKey(undefined, 'virtual')).toBeUndefined();
  });

  it('하나라도 키가 있으면 hasAnyTagKey, 대표 키는 실시간 우선', () => {
    expect(hasAnyTagKey(both)).toBe(true);
    expect(hasAnyTagKey({ virtualTagKey: 'V:z' })).toBe(true);
    expect(hasAnyTagKey({ realtimeTagKey: '', virtualTagKey: '' })).toBe(false);
    expect(hasAnyTagKey(undefined)).toBe(false);
    expect(getPrimaryTagKey(both)).toBe('C_1:z');
    expect(getPrimaryTagKey({ virtualTagKey: 'V:z' })).toBe('V:z');
    expect(getPrimaryTagKey({})).toBeUndefined();
  });
});

describe('setSlotTagKey', () => {
  it('슬롯 키를 잇고 다른 슬롯은 그대로, 앞뒤 공백은 자른다', () => {
    expect(setSlotTagKey({ realtimeTagKey: 'C_1:z' }, 'virtual', ' V:z ')).toEqual(
      both,
    );
    expect(setSlotTagKey(both, 'realtime', 'C_2:z')).toEqual({
      realtimeTagKey: 'C_2:z',
      virtualTagKey: 'V:z',
    });
  });

  it('빈 키·공백뿐인 키는 그 슬롯 필드를 뗀다 — 마지막 슬롯을 떼면 빈 객체', () => {
    expect(setSlotTagKey(both, 'virtual', '')).toEqual({
      realtimeTagKey: 'C_1:z',
    });
    expect(setSlotTagKey(both, 'virtual', '   ')).not.toHaveProperty(
      'virtualTagKey',
    );
    expect(setSlotTagKey({ virtualTagKey: 'V:z' }, 'virtual', '')).toEqual({});
  });

  it('바뀌는 것이 없으면 같은 참조를 돌려준다', () => {
    expect(setSlotTagKey(both, 'realtime', 'C_1:z')).toBe(both);
    expect(setSlotTagKey(both, 'realtime', ' C_1:z ')).toBe(both);
    const realtimeOnly: TagKeySlots = { realtimeTagKey: 'C_1:z' };
    expect(setSlotTagKey(realtimeOnly, 'virtual', '')).toBe(realtimeOnly);
    const empty: TagKeySlots = {};
    expect(setSlotTagKey(empty, 'virtual', '  ')).toBe(empty);
  });

  it('입력 객체를 바꾸지 않는다', () => {
    const before: TagKeySlots = { realtimeTagKey: 'C_1:z' };
    setSlotTagKey(before, 'realtime', 'other');
    setSlotTagKey(before, 'realtime', '');
    expect(before).toEqual({ realtimeTagKey: 'C_1:z' });
  });
});

describe('isTagKeySlotsEqual', () => {
  it('없음·빈 객체·빈 문자열은 같다', () => {
    expect(isTagKeySlotsEqual(undefined, {})).toBe(true);
    expect(isTagKeySlotsEqual({ realtimeTagKey: '' }, undefined)).toBe(true);
    expect(
      isTagKeySlotsEqual({ realtimeTagKey: 'a', virtualTagKey: '' }, {
        realtimeTagKey: 'a',
      }),
    ).toBe(true);
  });

  it('한쪽 슬롯만 달라도 다르다', () => {
    expect(isTagKeySlotsEqual(both, { realtimeTagKey: 'C_1:z' })).toBe(false);
    expect(
      isTagKeySlotsEqual(both, { realtimeTagKey: 'C_1:z', virtualTagKey: 'x' }),
    ).toBe(false);
  });
});

describe('resolveStatusTagKeys', () => {
  it('역할마다 그 슬롯의 키만 남긴다 — 없는 역할·빈 슬롯은 빠진다', () => {
    const tags = {
      controlOn: both,
      fault: { realtimeTagKey: 'C_1:fault' },
      bypass: { virtualTagKey: 'V:bypass' },
    };
    expect(resolveStatusTagKeys(tags, 'realtime')).toEqual({
      controlOn: 'C_1:z',
      fault: 'C_1:fault',
    });
    expect(resolveStatusTagKeys(tags, 'virtual')).toEqual({
      controlOn: 'V:z',
      bypass: 'V:bypass',
    });
    expect(resolveStatusTagKeys(undefined, 'realtime')).toEqual({});
  });
});
