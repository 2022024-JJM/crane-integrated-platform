import { describe, expect, it } from 'vitest';
import type { Box3, Vector3 } from 'three';
import type { CraneZone } from '@crane/domain/3d';
import { classifyPointToZone } from './zone-hit';

// classifyPointToZone은 min/max/x/y/z만 읽으므로 plain object로 충분하다
const vec = (x: number, y: number, z: number) => ({ x, y, z }) as Vector3;
const box = (min: Vector3, max: Vector3) => ({ min, max }) as Box3;

const unitBox = box(vec(0, 0, 0), vec(10, 10, 10));

const zones = [
  {
    key: 'upper',
    regions: [{ min: [0, 0.5, 0], max: [1, 1, 1] }],
  },
  {
    key: 'lower',
    regions: [{ min: [0, 0, 0], max: [1, 0.5, 1] }],
  },
] as unknown as CraneZone[];

describe('classifyPointToZone', () => {
  it('정규화 좌표로 존을 분류한다', () => {
    expect(classifyPointToZone(vec(5, 8, 5), unitBox, zones)?.key).toBe('upper');
    expect(classifyPointToZone(vec(5, 2, 5), unitBox, zones)?.key).toBe('lower');
  });

  it('경계값(0.5)은 배열 순서 우선 — 먼저 매칭되는 존', () => {
    expect(classifyPointToZone(vec(5, 5, 5), unitBox, zones)?.key).toBe('upper');
  });

  it('어느 존에도 속하지 않으면 null', () => {
    const narrow = [
      { key: 'a', regions: [{ min: [0, 0, 0], max: [0.1, 0.1, 0.1] }] },
    ] as unknown as CraneZone[];
    expect(classifyPointToZone(vec(9, 9, 9), unitBox, narrow)).toBeNull();
  });

  it('바운딩박스가 퇴화(크기 0)하면 null', () => {
    const flat = box(vec(0, 0, 0), vec(10, 0, 10));
    expect(classifyPointToZone(vec(5, 0, 5), flat, zones)).toBeNull();
  });

  it('regions가 없는 존은 건너뛴다', () => {
    const mixed = [
      { key: 'empty' },
      { key: 'all', regions: [{ min: [0, 0, 0], max: [1, 1, 1] }] },
    ] as unknown as CraneZone[];
    expect(classifyPointToZone(vec(5, 5, 5), unitBox, mixed)?.key).toBe('all');
  });

  it('오프셋 바운딩박스도 정규화가 정확하다', () => {
    const offset = box(vec(100, 50, -20), vec(120, 70, 0));
    // (110, 66, -10) → 정규화 (0.5, 0.8, 0.5) → upper
    expect(classifyPointToZone(vec(110, 66, -10), offset, zones)?.key).toBe('upper');
  });
});
