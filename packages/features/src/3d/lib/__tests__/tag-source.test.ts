import { describe, expect, it } from 'vitest';
import { EDITOR_TAG_SOURCE, resolveActiveTagSource } from '../tag-source';

describe('resolveActiveTagSource', () => {
  it('실시간 모니터링은 실시간 러너', () => {
    expect(resolveActiveTagSource('realtime', 'replay')).toBe('realtime');
    expect(resolveActiveTagSource('realtime', 'simulation')).toBe('realtime');
  });

  it('3D 플레이는 소스가 정한다 — 리플레이 | 시뮬레이션', () => {
    expect(resolveActiveTagSource('play3d', 'replay')).toBe('replay');
    expect(resolveActiveTagSource('play3d', 'simulation')).toBe('simulation');
  });

  it('모드 없는 화면(에디터)은 실시간', () => {
    expect(resolveActiveTagSource(null, 'simulation')).toBe('realtime');
    expect(resolveActiveTagSource(undefined, 'replay')).toBe('realtime');
    expect(EDITOR_TAG_SOURCE).toBe('realtime');
  });
});
