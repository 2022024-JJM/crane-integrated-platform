import { describe, expect, it } from 'vitest';
import type {
  AlarmJournalEntry,
  CollisionJournalEntry,
} from '../../model/types';
import {
  sanitizeAlarmJournalEntry,
  sanitizeCollisionJournalEntry,
} from '../sanitize-journal';

const validCollision: CollisionJournalEntry = {
  key: '1757400000000:a|b',
  at: 1757400000000,
  pairKey: 'a|b',
  regionId: 'philly-dock-2',
  a: { modelId: 'a', equipName: 'Goliath Crane' },
  b: { modelId: 'b', equipName: 'LLC-002' },
  contactPoint: [-640.1, 12.5, 100.2],
};

const validAlarm: AlarmJournalEntry = {
  id: 'alarm-1',
  regionId: 'philly-dock-2',
  craneId: 'GC_04',
  severity: 'critical',
  timestamp: '2026-09-10T10:00:00.000Z',
  alarmCode: 'A-01',
  alarmName: 'Wind warning',
  active: true,
};

describe('sanitizeCollisionJournalEntry', () => {
  it('유효한 항목은 같은 참조를 돌려준다', () => {
    expect(sanitizeCollisionJournalEntry(validCollision)).toBe(validCollision);
  });

  it('regionId null 은 유효하다', () => {
    const entry = { ...validCollision, regionId: null };
    expect(sanitizeCollisionJournalEntry(entry)).toBe(entry);
  });

  it('객체가 아니면 null', () => {
    expect(sanitizeCollisionJournalEntry(null)).toBeNull();
    expect(sanitizeCollisionJournalEntry('text')).toBeNull();
    expect(sanitizeCollisionJournalEntry(42)).toBeNull();
    expect(sanitizeCollisionJournalEntry(undefined)).toBeNull();
  });

  it('결손 필드는 null', () => {
    const missingAt: Record<string, unknown> = { ...validCollision };
    delete missingAt.at;
    expect(sanitizeCollisionJournalEntry(missingAt)).toBeNull();
    const missingParty: Record<string, unknown> = { ...validCollision };
    delete missingParty.a;
    expect(sanitizeCollisionJournalEntry(missingParty)).toBeNull();
  });

  it('타입 오염은 null — 문자열 at, NaN, 규격 밖 contactPoint', () => {
    expect(
      sanitizeCollisionJournalEntry({ ...validCollision, at: '123' }),
    ).toBeNull();
    expect(
      sanitizeCollisionJournalEntry({ ...validCollision, at: Number.NaN }),
    ).toBeNull();
    expect(
      sanitizeCollisionJournalEntry({
        ...validCollision,
        contactPoint: [1, 2],
      }),
    ).toBeNull();
    expect(
      sanitizeCollisionJournalEntry({
        ...validCollision,
        contactPoint: [1, Number.POSITIVE_INFINITY, 3],
      }),
    ).toBeNull();
    expect(
      sanitizeCollisionJournalEntry({
        ...validCollision,
        a: { modelId: 1, equipName: 'x' },
      }),
    ).toBeNull();
  });

  it('빈 key·pairKey 는 null', () => {
    expect(
      sanitizeCollisionJournalEntry({ ...validCollision, key: '' }),
    ).toBeNull();
    expect(
      sanitizeCollisionJournalEntry({ ...validCollision, pairKey: '' }),
    ).toBeNull();
  });
});

describe('sanitizeAlarmJournalEntry', () => {
  it('유효한 항목은 같은 참조를 돌려준다', () => {
    expect(sanitizeAlarmJournalEntry(validAlarm)).toBe(validAlarm);
  });

  it('alarmCode/alarmName null 은 유효하다', () => {
    const entry = { ...validAlarm, alarmCode: null, alarmName: null };
    expect(sanitizeAlarmJournalEntry(entry)).toBe(entry);
  });

  it('미지의 severity 는 null', () => {
    expect(
      sanitizeAlarmJournalEntry({ ...validAlarm, severity: 'fatal' }),
    ).toBeNull();
  });

  it('결손·타입 오염은 null', () => {
    expect(sanitizeAlarmJournalEntry(null)).toBeNull();
    expect(sanitizeAlarmJournalEntry({ ...validAlarm, id: '' })).toBeNull();
    expect(
      sanitizeAlarmJournalEntry({ ...validAlarm, active: 'yes' }),
    ).toBeNull();
    expect(
      sanitizeAlarmJournalEntry({ ...validAlarm, timestamp: 0 }),
    ).toBeNull();
  });
});
