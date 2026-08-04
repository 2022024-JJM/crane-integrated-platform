import { describe, expect, it } from 'vitest';
import { addLabelTo, collectAllLabels, normalizeLabel, removeLabelFrom } from './own-labels';

describe('own-labels 순수 연산', () => {
  it('추가 — 공백 트림, 빈 값 무시, 대소문자 무시 중복 제거', () => {
    let map = addLabelTo({}, 'c1', '  Bay 3  ');
    expect(map).toEqual({ c1: ['Bay 3'] });
    map = addLabelTo(map, 'c1', 'bay 3');
    expect(map.c1).toHaveLength(1);
    expect(addLabelTo(map, 'c1', '   ')).toBe(map);
  });

  it('추가 — 라벨 길이 상한', () => {
    expect(normalizeLabel('x'.repeat(50))).toHaveLength(24);
  });

  it('제거 — 없는 라벨이면 같은 참조 반환', () => {
    const map = addLabelTo({}, 'c1', 'High usage');
    expect(removeLabelFrom(map, 'c1', 'nope')).toBe(map);
    expect(removeLabelFrom(map, 'c1', 'High usage').c1).toEqual([]);
  });

  it('전체 라벨 — 자산 간 중복 합쳐 정렬', () => {
    let map = addLabelTo({}, 'c1', 'B');
    map = addLabelTo(map, 'c2', 'A');
    map = addLabelTo(map, 'c2', 'B');
    expect(collectAllLabels(map)).toEqual(['A', 'B']);
  });
});
