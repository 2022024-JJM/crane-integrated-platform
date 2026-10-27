import { beforeEach, describe, expect, it } from 'vitest';
import {
  claimRender,
  getSnapshot,
  isRenderer,
  publishSnapshot,
  releaseRender,
  resetSnapshotsForTest,
} from '../thumb-snapshot-store';

beforeEach(() => resetSnapshotsForTest());
const A = Symbol('a');
const B = Symbol('b');

describe('thumb snapshot store', () => {
  it('첫 토큰만 맡고, 같은 토큰의 재요청은 그대로 true(StrictMode 이중 실행)', () => {
    expect(claimRender('goliath', A)).toBe(true);
    expect(claimRender('goliath', A)).toBe(true);
    expect(claimRender('goliath', B)).toBe(false);
    expect(isRenderer('goliath', A)).toBe(true);
  });
  it('맡은 토큰이 물러나면 다음 토큰이 맡는다, 남이 맡은 건 못 푼다', () => {
    claimRender('luffing', A);
    releaseRender('luffing', B);
    expect(isRenderer('luffing', A)).toBe(true);
    releaseRender('luffing', A);
    expect(claimRender('luffing', B)).toBe(true);
  });
  it('발행 뒤엔 아무도 맡지 않고 스냅샷을 읽는다, 빈 값은 무시', () => {
    claimRender('goliath', A);
    publishSnapshot('goliath', '');
    expect(getSnapshot('goliath')).toBeUndefined();
    publishSnapshot('goliath', 'data:x');
    expect(getSnapshot('goliath')).toBe('data:x');
    expect(isRenderer('goliath', A)).toBe(false);
    expect(claimRender('goliath', B)).toBe(false);
    expect(getSnapshot('luffing')).toBeUndefined();
  });
});
