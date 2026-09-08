import { describe, expect, it } from 'vitest';
import type { RigDefinition, TagMapping } from '@crane/domain/3d';
import {
  computeAppliedValue,
  createTagMapping,
  findTagMappingConflicts,
  formatMappingValue,
  switchTargetKind,
} from '../tag-mapping-editor';

const rig: RigDefinition = {
  id: 'rig',
  name: 'R',
  modelPath: '/models/a.glb',
  joints: [
    { id: 'luff', node: '[0]Arm', type: 'hinge', axis: 'x' },
    { id: 'trolley', node: '[0]Arm/[0]Hand', type: 'slide', axis: 'z' },
  ],
  constraints: [],
};

const node = (
  id: string,
  node: string,
  channel: 'position' | 'rotation' | 'scale',
  axis: 'x' | 'y' | 'z',
): TagMapping => ({ id, target: { kind: 'node', node, channel, axis }, tagKey: 'k' });

describe('findTagMappingConflicts', () => {
  it('같은 대상은 두 번째부터 duplicate', () => {
    const out = findTagMappingConflicts(
      [node('a', '', 'position', 'z'), node('b', '', 'position', 'z'), node('c', '', 'position', 'x')],
      undefined,
    );
    expect([...out.entries()]).toEqual([['b', 'duplicate']]);
  });

  it('리그 관절이 점유한 노드·채널·축은 rig (hinge=rotation, slide=position)', () => {
    const out = findTagMappingConflicts(
      [
        node('a', '[0]Arm', 'rotation', 'x'),
        node('b', '[0]Arm', 'rotation', 'y'),
        node('c', '[0]Arm/[0]Hand', 'position', 'z'),
        node('d', '[0]Arm', 'position', 'x'),
      ],
      rig,
    );
    expect(out.get('a')).toBe('rig');
    expect(out.has('b')).toBe(false);
    expect(out.get('c')).toBe('rig');
    expect(out.has('d')).toBe(false);
  });

  it('joint 대상 중복도 duplicate, 리그 없으면 rig 충돌 없음', () => {
    const j = (id: string): TagMapping => ({ id, target: { kind: 'joint', jointId: 'luff' }, tagKey: 'k' });
    const out = findTagMappingConflicts([j('a'), j('b')], rig);
    expect(out.get('b')).toBe('duplicate');
    expect(findTagMappingConflicts([node('x', '[0]Arm', 'rotation', 'x')], undefined).size).toBe(0);
  });

  it('빈 목록은 빈 맵', () => {
    expect(findTagMappingConflicts([], rig).size).toBe(0);
  });
});

describe('createTagMapping / switchTargetKind', () => {
  it('기본값은 루트·위치·x·태그 없음이고 id 는 map- 접두', () => {
    const m = createTagMapping();
    expect(m.id.startsWith('map-')).toBe(true);
    expect(m.target).toEqual({ kind: 'node', node: '', channel: 'position', axis: 'x' });
    expect(m.tagKey).toBe('');
    expect(createTagMapping().id).not.toBe(m.id);
  });

  it('kind 가 같으면 같은 참조, 바뀌면 기본값으로 채운다', () => {
    const t = { kind: 'node', node: '[0]A', channel: 'scale', axis: 'y' } as const;
    expect(switchTargetKind(t, 'node', rig)).toBe(t);
    expect(switchTargetKind(t, 'joint', rig)).toEqual({ kind: 'joint', jointId: 'luff' });
    expect(switchTargetKind(t, 'joint', undefined)).toEqual({ kind: 'joint', jointId: '' });
    expect(switchTargetKind({ kind: 'joint', jointId: 'luff' }, 'node', rig)).toEqual({
      kind: 'node',
      node: '',
      channel: 'position',
      axis: 'x',
    });
  });
});

describe('computeAppliedValue / formatMappingValue', () => {
  it('offset + value × scale, 기본 1/0, 값 없음·NaN 은 undefined', () => {
    expect(computeAppliedValue({}, 10)).toBe(10);
    expect(computeAppliedValue({ scale: 0.1, offset: 66 }, 118.3)).toBeCloseTo(77.83, 9);
    expect(computeAppliedValue({ scale: 2 }, undefined)).toBeUndefined();
    expect(computeAppliedValue({ scale: 2 }, NaN)).toBeUndefined();
  });

  it('formatMappingValue 는 소수 3자리·대시', () => {
    expect(formatMappingValue(1.23456)).toBe('1.235');
    expect(formatMappingValue(2)).toBe('2');
    expect(formatMappingValue(undefined)).toBe('—');
    expect(formatMappingValue(Infinity)).toBe('—');
  });
});
