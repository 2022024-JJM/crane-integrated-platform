import { describe, expect, it } from 'vitest';
import { authenticate } from '../authenticate';

describe('authenticate', () => {
  it('SC-01 · indoor 계정은 indoor 범위에서 통과', () => {
    expect(authenticate('Indoorshop.OT', '1', 'indoor')).toEqual({
      ok: true,
      user: { id: 'Indoorshop.OT', role: 'indoorshop-ot' },
    });
  });

  it('SC-02 · crane 계정은 indoor 범위에서 scope-denied, 계정 범위를 알려 준다', () => {
    expect(authenticate('crane.goliath', '1', 'indoor')).toEqual({
      ok: false,
      reason: 'scope-denied',
      accountScope: 'crane',
    });
  });

  it('indoor 계정은 crane 범위에서 scope-denied', () => {
    expect(authenticate('Indoorshop.Keyin', '1', 'crane')).toEqual({
      ok: false,
      reason: 'scope-denied',
      accountScope: 'indoor',
    });
  });

  it('범위를 나누지 않으면 모든 계정 통과 (기존 동작)', () => {
    expect(authenticate('Indoorshop.IT', '1', null).ok).toBe(true);
    expect(authenticate('crane.HMI2', '1', null).ok).toBe(true);
  });

  it('비밀번호가 틀리면 범위와 무관하게 invalid (계정 존재를 흘리지 않음)', () => {
    expect(authenticate('crane.goliath', 'x', 'indoor')).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });

  it('아이디는 앞뒤 공백 · 대소문자를 무시한다', () => {
    const r = authenticate('  CRANE.mro ', '1', 'crane');
    expect(r.ok && r.user.id).toBe('crane.MRO');
  });

  it('비밀번호는 정확히 일치해야 한다', () => {
    expect(authenticate('crane.MRO', ' 1', 'crane').ok).toBe(false);
  });

  it('없는 아이디 · 빈 값은 invalid', () => {
    expect(authenticate('nobody', '1', 'crane')).toEqual({ ok: false, reason: 'invalid' });
    expect(authenticate('', '', 'crane')).toEqual({ ok: false, reason: 'invalid' });
  });
});
