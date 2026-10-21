import { describe, expect, it } from 'vitest';
import { collectBays, countOnline, filterCraneIds } from '../crane-filter';

function crane(bay: string | null, online = true) {
  return {
    snapshot: {
      craneId: 'x',
      stationId: null,
      bay,
      snapshotAt: null,
      lastReceivedAt: null,
      online,
      tags: {},
    },
  };
}

const cranes = {
  C_171: crane('F1_3_Bay'),
  C_800: crane('F1_3_Bay', false),
  C_863: crane('F5_1_Bay'),
  C_1806: crane('F5_1_Bay', false),
  C_999: crane(null),
};
const order = ['C_171', 'C_800', 'C_863', 'C_999', 'C_1806'];

describe('collectBays', () => {
  it('bay 별 크레인 수를 사전순으로, bay 없는 크레인은 뺀다', () => {
    expect(collectBays(order, cranes)).toEqual([
      { bay: 'F1_3_Bay', count: 2 },
      { bay: 'F5_1_Bay', count: 2 },
    ]);
  });

  it('order 에 없는 크레인은 세지 않고, 빈 입력은 빈 배열', () => {
    expect(collectBays(['C_171'], cranes)).toEqual([
      { bay: 'F1_3_Bay', count: 1 },
    ]);
    expect(collectBays([], cranes)).toEqual([]);
    expect(collectBays(['missing'], cranes)).toEqual([]);
  });
});

describe('filterCraneIds', () => {
  it('구역 전체 + 빈 검색은 order 그대로(없는 id 는 제외)', () => {
    expect(filterCraneIds([...order, 'ghost'], cranes, 'all', '')).toEqual(
      order,
    );
  });

  it('구역 칩과 ID 부분 일치(대소문자·공백 무시)를 함께 건다', () => {
    expect(filterCraneIds(order, cranes, 'F1_3_Bay', '')).toEqual([
      'C_171',
      'C_800',
    ]);
    expect(filterCraneIds(order, cranes, 'all', ' 8 ')).toEqual([
      'C_800',
      'C_863',
      'C_1806',
    ]);
    expect(filterCraneIds(order, cranes, 'F5_1_Bay', 'c_18')).toEqual([
      'C_1806',
    ]);
    expect(filterCraneIds(order, cranes, 'F9_9_Bay', '')).toEqual([]);
  });
});

describe('countOnline', () => {
  it('서버 online 이 true 인 크레인만 센다', () => {
    expect(countOnline(order, cranes)).toBe(3);
    expect(countOnline([], cranes)).toBe(0);
  });
});
