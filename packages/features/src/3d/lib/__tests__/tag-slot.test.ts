import { describe, expect, it } from 'vitest';
import {
  EDITOR_TAG_SLOT,
  resolveActiveTagSlot,
  tagSlotOfPlay3dSource,
} from '../tag-slot';

describe('resolveActiveTagSlot', () => {
  it('실시간 모니터링은 실시간 슬롯', () => {
    expect(resolveActiveTagSlot('realtime', 'replay')).toBe('realtime');
    expect(resolveActiveTagSlot('realtime', 'simulation')).toBe('realtime');
  });

  it('3D 플레이는 소스가 정한다 — 리플레이는 실시간, 시뮬레이션은 가상', () => {
    expect(resolveActiveTagSlot('play3d', 'replay')).toBe('realtime');
    expect(resolveActiveTagSlot('play3d', 'simulation')).toBe('virtual');
  });

  it('모드 없는 화면(에디터)은 실시간', () => {
    expect(resolveActiveTagSlot(null, 'simulation')).toBe('realtime');
    expect(resolveActiveTagSlot(undefined, 'replay')).toBe('realtime');
    expect(EDITOR_TAG_SLOT).toBe('realtime');
  });
});

describe('tagSlotOfPlay3dSource', () => {
  it('3D 플레이 모드의 해석과 같다', () => {
    for (const source of ['replay', 'simulation'] as const) {
      expect(tagSlotOfPlay3dSource(source)).toBe(
        resolveActiveTagSlot('play3d', source),
      );
    }
  });
});
