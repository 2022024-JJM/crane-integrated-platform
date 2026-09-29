import { describe, expect, it } from 'vitest';
import {
  buildLabelReadings,
  formatLabelReading,
  LABEL_READING_EMPTY,
} from '../label-reading';
import type { TagMapping } from '../../model/tag-mapping-types';

function mapping(overrides: Partial<TagMapping> = {}): TagMapping {
  return {
    id: 'm1',
    target: { kind: 'node', node: '', channel: 'position', axis: 'z' },
    tagKey: 'GC_04:gantry_position',
    ...overrides,
  };
}

describe('buildLabelReadings', () => {
  it('라벨에 보이기로 한 맵핑만, 맵핑 순서대로 담는다', () => {
    expect(
      buildLabelReadings([
        mapping({ id: 'a', showOnLabel: true, caption: '주행' }),
        mapping({ id: 'b', tagKey: 'GC_04:trolley_position' }),
        mapping({
          id: 'c',
          tagKey: 'GC_04:trolley_position_2',
          showOnLabel: true,
        }),
      ]),
    ).toEqual([
      { id: 'a', caption: '주행', tagKey: 'GC_04:gantry_position' },
      { id: 'c', caption: '', tagKey: 'GC_04:trolley_position_2' },
    ]);
  });

  it('관절 대상 맵핑도 값을 보일 수 있다', () => {
    expect(
      buildLabelReadings([
        mapping({
          id: 'j',
          target: { kind: 'joint', jointId: 'joint-1' },
          tagKey: 'LLC_002:luff_angle',
          showOnLabel: true,
        }),
      ]),
    ).toHaveLength(1);
  });

  it('표시를 끈 맵핑은 이름이 있어도 담지 않는다', () => {
    expect(buildLabelReadings([mapping({ caption: '주행' })])).toHaveLength(0);
  });

  it('showOnLabel 이 true 가 아닌 오염값은 표시하지 않는다', () => {
    const polluted = [
      mapping({ showOnLabel: 'yes' as unknown as boolean }),
      mapping({ id: 'm2', showOnLabel: 1 as unknown as boolean }),
      mapping({ id: 'm3', showOnLabel: false }),
    ];
    expect(buildLabelReadings(polluted)).toHaveLength(0);
  });

  it('태그가 빈 맵핑은 건너뛴다', () => {
    expect(
      buildLabelReadings([mapping({ tagKey: '', showOnLabel: true })]),
    ).toHaveLength(0);
  });

  it('보일 것이 없으면 늘 같은 빈 배열 참조를 돌려준다', () => {
    const none = buildLabelReadings(undefined);
    expect(none).toEqual([]);
    expect(buildLabelReadings([])).toBe(none);
    expect(buildLabelReadings([mapping()])).toBe(none);
  });
});

describe('formatLabelReading', () => {
  it('소수 1자리로 보인다', () => {
    expect(formatLabelReading(777.2)).toBe('777.2');
    expect(formatLabelReading(777)).toBe('777.0');
    expect(formatLabelReading(12.345)).toBe('12.3');
    expect(formatLabelReading(12.35)).toBe((12.35).toFixed(1));
    expect(formatLabelReading(-32.04)).toBe('-32.0');
  });

  it('0 과 0 으로 반올림되는 음수는 부호 없이 보인다', () => {
    expect(formatLabelReading(0)).toBe('0.0');
    expect(formatLabelReading(-0)).toBe('0.0');
    expect(formatLabelReading(-0.04)).toBe('0.0');
    // 반올림해도 0 이 아니면 부호를 유지한다.
    expect(formatLabelReading(-0.05)).toBe((-0.05).toFixed(1));
  });

  it('값이 없거나 비유한이면 빈 표기', () => {
    expect(formatLabelReading(undefined)).toBe(LABEL_READING_EMPTY);
    expect(formatLabelReading(Number.NaN)).toBe(LABEL_READING_EMPTY);
    expect(formatLabelReading(Number.POSITIVE_INFINITY)).toBe(
      LABEL_READING_EMPTY,
    );
  });
});
