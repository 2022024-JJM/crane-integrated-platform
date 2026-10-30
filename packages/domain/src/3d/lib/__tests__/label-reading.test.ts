import { describe, expect, it } from 'vitest';
import {
  buildLabelReadings,
  formatLabelReading,
  LABEL_READING_EMPTY,
  LABEL_READING_NULL,
} from '../label-reading';
import type { TagMapping } from '../../model/tag-mapping-types';

function mapping(overrides: Partial<TagMapping> = {}): TagMapping {
  return {
    id: 'm1',
    target: { kind: 'node', node: '', channel: 'position', axis: 'z' },
    code: 'tl_distance',
    ...overrides,
  };
}

/** craneId: null 이면 크레인 없는 모델. */
function model(tagMappings: TagMapping[], craneId: string | null = 'C_171') {
  return craneId === null ? { tagMappings } : { craneId, tagMappings };
}

describe('buildLabelReadings', () => {
  it('라벨에 보이기로 한 맵핑만, 맵핑 순서대로, 모델 craneId 로 조립한 키를 담는다', () => {
    const mappings = [
      mapping({ id: 'a', showOnLabel: true, caption: '주행' }),
      mapping({ id: 'b', code: 'trolley_position' }),
      mapping({ id: 'c', code: 'ts1_distance', showOnLabel: true }),
    ];
    expect(buildLabelReadings(model(mappings))).toEqual([
      { id: 'a', caption: '주행', tagKey: 'C_171.tl_distance' },
      { id: 'c', caption: '', tagKey: 'C_171.ts1_distance' },
    ]);
  });

  it('맵핑의 craneId 덮어쓰기는 그 맵핑의 키에만 쓰인다', () => {
    expect(
      buildLabelReadings(
        model([
          mapping({ id: 'a', showOnLabel: true, craneId: 'C_172' }),
          mapping({ id: 'b', code: 'ts1_distance', showOnLabel: true }),
        ]),
      ),
    ).toEqual([
      { id: 'a', caption: '', tagKey: 'C_172.tl_distance' },
      { id: 'b', caption: '', tagKey: 'C_171.ts1_distance' },
    ]);
  });

  it('모델에 craneId 가 없으면 줄도 없다 — 맵핑 craneId 가 있는 것만 남는다', () => {
    const none = buildLabelReadings(
      model([mapping({ showOnLabel: true })], null),
    );
    expect(none).toHaveLength(0);
    expect(
      buildLabelReadings(
        model([mapping({ showOnLabel: true, craneId: 'GC-04' })], null),
      ),
    ).toEqual([{ id: 'm1', caption: '', tagKey: 'GC_04.tl_distance' }]);
  });

  it('관절 대상 맵핑도 값을 보일 수 있다', () => {
    expect(
      buildLabelReadings(
        model([
          mapping({
            id: 'j',
            target: { kind: 'joint', jointId: 'joint-1' },
            code: 'luff_angle',
            showOnLabel: true,
          }),
        ]),
      ),
    ).toHaveLength(1);
  });

  it('표시를 끈 맵핑은 이름이 있어도 담지 않는다', () => {
    expect(
      buildLabelReadings(model([mapping({ caption: '주행' })])),
    ).toHaveLength(0);
  });

  it('showOnLabel 이 true 가 아닌 오염값은 표시하지 않는다', () => {
    const polluted = [
      mapping({ showOnLabel: 'yes' as unknown as boolean }),
      mapping({ id: 'm2', showOnLabel: 1 as unknown as boolean }),
      mapping({ id: 'm3', showOnLabel: false }),
    ];
    expect(buildLabelReadings(model(polluted))).toHaveLength(0);
  });

  it('코드가 빈 맵핑은 건너뛴다', () => {
    expect(
      buildLabelReadings(model([mapping({ code: '', showOnLabel: true })])),
    ).toHaveLength(0);
  });

  it('보일 것이 없으면 늘 같은 빈 배열 참조를 돌려준다', () => {
    const none = buildLabelReadings({ craneId: 'C_171' });
    expect(none).toEqual([]);
    expect(buildLabelReadings(model([]))).toBe(none);
    expect(buildLabelReadings(model([mapping()]))).toBe(none);
    expect(
      buildLabelReadings(model([mapping({ showOnLabel: true })], null)),
    ).toBe(none);
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

  it('서버가 값 없음(null)을 보냈으면 마지막 숫자 대신 NULL', () => {
    expect(LABEL_READING_NULL).toBe('NULL');
    expect(formatLabelReading(null)).toBe(LABEL_READING_NULL);
    // 값이 아직 없는 것(undefined)과는 다른 표기다.
    expect(formatLabelReading(null)).not.toBe(formatLabelReading(undefined));
  });
});
