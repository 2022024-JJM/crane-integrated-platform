import { describe, expect, it } from 'vitest';
import type { InventoryItem } from '@crane/domain/inventory';
import {
  EMPTY_FILTER,
  badgeEmphasis,
  countBy,
  filterInventory,
  matchCrane,
  sortByRisk,
  stockPct,
} from '../inventory-rows';

const it_ = (o: Partial<InventoryItem>): InventoryItem =>
  ({
    partName: 'P',
    partNumber: 'N',
    manufacturer: 'M',
    status: 'normal',
    criticality: 'standard',
    craneIds: ['crane-660t'],
    availableQty: 5,
    minStockQty: 2,
    reorderPoint: 1,
    ...o,
  }) as InventoryItem;

describe('inventory rows', () => {
  it('matchCrane — common 은 둘 이상 적용', () => {
    expect(matchCrane(it_({ craneIds: ['a', 'b'] }), 'common')).toBe(true);
    expect(matchCrane(it_({ craneIds: ['crane-50t'] }), 'common')).toBe(false);
    expect(matchCrane(it_({ craneIds: ['crane-50t'] }), 'crane-50t')).toBe(
      true,
    );
    expect(matchCrane(it_({}), 'all')).toBe(true);
  });
  it('filterInventory — 각 축 AND, 검색은 이름/번호/제조사, reorderOnly', () => {
    const items = [
      it_({ partName: 'FUSE', status: 'low', availableQty: 0 }),
      it_({
        partName: 'MOTOR',
        manufacturer: 'SIEMENS',
        criticality: 'critical',
      }),
    ];
    expect(
      filterInventory(items, { ...EMPTY_FILTER, query: 'siem' }).map(
        (i) => i.partName,
      ),
    ).toEqual(['MOTOR']);
    expect(
      filterInventory(items, { ...EMPTY_FILTER, status: new Set(['low']) }),
    ).toHaveLength(1);
    expect(
      filterInventory(items, {
        ...EMPTY_FILTER,
        criticality: new Set(['critical']),
        status: new Set(['low']),
      }),
    ).toHaveLength(0);
    expect(
      filterInventory(items, { ...EMPTY_FILTER, reorderOnly: true }).map(
        (i) => i.partName,
      ),
    ).toEqual(['FUSE']);
    expect(filterInventory([], EMPTY_FILTER)).toEqual([]);
  });
  it('sortByRisk — 상태 › 중요도 › 이름, 입력 불변', () => {
    const items = [
      it_({ partName: 'b' }),
      it_({ partName: 'a', status: 'low' }),
      it_({ partName: 'c', status: 'low', criticality: 'critical' }),
    ];
    expect(sortByRisk(items).map((i) => i.partName)).toEqual(['c', 'a', 'b']);
    expect(items[0]!.partName).toBe('b');
  });
  it('stockPct — 클램프, 최소 0 처리', () => {
    expect(stockPct(it_({ availableQty: 1, minStockQty: 4 }))).toBe(25);
    expect(stockPct(it_({ availableQty: 9, minStockQty: 4 }))).toBe(100);
    expect(stockPct(it_({ availableQty: 0, minStockQty: 0 }))).toBe(0);
    expect(stockPct(it_({ availableQty: 3, minStockQty: 0 }))).toBe(100);
  });
  it('badgeEmphasis — 품절+위험만 filled, countBy', () => {
    expect(
      badgeEmphasis(it_({ status: 'out_of_stock', criticality: 'critical' })),
    ).toBe('filled');
    expect(
      badgeEmphasis(it_({ status: 'out_of_stock', criticality: 'essential' })),
    ).toBe('outline');
    expect(badgeEmphasis(it_({ status: 'low', criticality: 'critical' }))).toBe(
      'outline',
    );
    expect(
      countBy(
        [it_({ status: 'low' }), it_({ status: 'low' }), it_({})],
        (i) => i.status,
      ),
    ).toEqual({ low: 2, normal: 1 });
  });
});
