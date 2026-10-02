import { describe, expect, it } from 'vitest';
import { getAppEnvBadge } from '../app-env-badge';

describe('getAppEnvBadge', () => {
  it('dev · stage 는 대문자 표시', () => {
    expect(getAppEnvBadge('dev')).toBe('DEV');
    expect(getAppEnvBadge('stage')).toBe('STAGE');
  });

  it('운영 · 빈 값은 표시 안 함', () => {
    for (const v of [undefined, '', '  ', 'prod', 'PROD', 'production']) {
      expect(getAppEnvBadge(v)).toBeNull();
    }
  });

  it('앞뒤 공백 · 대소문자 무시', () => {
    expect(getAppEnvBadge(' Dev ')).toBe('DEV');
  });
});
