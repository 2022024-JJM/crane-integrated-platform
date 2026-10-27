import { describe, expect, it } from 'vitest';
import type { CraneAsset } from '@crane/domain/asset';
import { WATCH_LIMIT, buildWatchAssets } from '../fleet-rows';

const NOW = new Date(2026, 6, 10).getTime();
const a = (
  id: string,
  status: CraneAsset['status'] = 'operating',
): CraneAsset => ({ id, name: id, status }) as CraneAsset;

describe('buildWatchAssets', () => {
  it('점검 지연 일수 › 건강도 낮은 순 › 이름, 폐기는 제외, 건강도 없음은 뒤로', () => {
    const rows = buildWatchAssets(
      [a('c'), a('a'), a('b'), a('x', 'decommissioned'), a('d')],
      {
        a: { remainingPct: 20 } as never,
        b: { remainingPct: 80 } as never,
        c: { remainingPct: 50 } as never,
      },
      { b: '2026-06-01', c: '2026-08-01' },
      NOW,
    );
    expect(rows.map((r) => r.id)).toEqual(['b', 'a', 'c', 'd']);
    expect(rows[0]!.overdueDays).toBe(39);
    expect(rows[3]!.healthPct).toBeUndefined();
  });
  it('상한', () => {
    const many = Array.from({ length: WATCH_LIMIT + 3 }, (_, i) => a(`a${i}`));
    expect(buildWatchAssets(many, {}, {}, NOW)).toHaveLength(WATCH_LIMIT);
    expect(buildWatchAssets(many, {}, {}, NOW, 0)).toEqual([]);
  });
});
