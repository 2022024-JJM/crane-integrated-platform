import { describe, expect, it } from 'vitest';
import type { CraneSnapshotEntry, CraneTagStat } from '../crane-snapshot-stats';
import {
  buildTagRows,
  countTagRowsByCategory,
  filterTagRows,
  resolveBoolDisplay,
} from '../tag-rows';

const STAT: CraneTagStat = { changedAt: 5, changeCount: 2, min: 1, max: 9 };

function entry(
  tags: Record<string, number | boolean>,
  stats: Record<string, CraneTagStat> = {},
): Pick<CraneSnapshotEntry, 'snapshot' | 'stats'> {
  const snapshot: CraneSnapshotEntry['snapshot'] = {
    craneId: 'C_867',
    stationId: null,
    bay: null,
    snapshotAt: null,
    lastReceivedAt: null,
    online: true,
    tags: {},
  };
  for (const [code, value] of Object.entries(tags)) {
    snapshot.tags[code] = { value, quality: 0, timestamp: 't' };
  }
  return { snapshot, stats };
}

describe('buildTagRows', () => {
  it('묶음 순(시각 → 계측값 → 상태), 시각은 큰 단위부터, 나머지는 숫자 인식 사전순', () => {
    const rows = buildTagRows(
      entry({
        ts10_distance: 1,
        second: 1,
        heartbeat: true,
        ts2_distance: 1,
        year: 2026,
        mh1_weight: 1,
        e_stop_on: false,
        accs_off: false,
      }),
    );
    expect(rows.map((r) => r.code)).toEqual([
      'year',
      'second',
      'mh1_weight',
      'ts2_distance',
      'ts10_distance',
      'accs_off',
      'e_stop_on',
      'heartbeat',
    ]);
  });

  it('이름·단위·알람 여부는 태그 카탈로그에서 온다', () => {
    const rows = buildTagRows(
      entry({ mh1_weight: 1743, e_stop_on: true, foo_bar: 1 }),
    );
    const byCode = Object.fromEntries(rows.map((r) => [r.code, r]));
    expect(byCode.mh1_weight).toMatchObject({
      name: 'MH#1 Weight',
      unit: 'ton',
      category: 'measurement',
      alarm: false,
    });
    expect(byCode.e_stop_on).toMatchObject({
      name: 'E Stop On',
      category: 'status',
      alarm: true,
    });
    expect(byCode.foo_bar).toMatchObject({
      name: 'Foo Bar',
      category: 'status',
    });
  });

  it('통계가 없는 태그는 빈 통계를 받는다', () => {
    const rows = buildTagRows(entry({ a: 1, b: 2 }, { a: STAT }));
    expect(rows.find((r) => r.code === 'a')?.stat).toBe(STAT);
    expect(rows.find((r) => r.code === 'b')?.stat).toEqual({
      changedAt: null,
      changeCount: 0,
      min: null,
      max: null,
    });
  });

  it('빈 스냅샷은 빈 배열', () => {
    expect(buildTagRows(entry({}))).toEqual([]);
  });
});

describe('filterTagRows', () => {
  const rows = buildTagRows(
    entry({ mh1_weight: 1, year: 1, heartbeat: true, ts1_status: true }),
  );

  it('묶음 선택과 코드·이름 부분 일치(대소문자·공백 무시)를 함께 건다', () => {
    expect(filterTagRows(rows, 'all', '').length).toBe(4);
    expect(filterTagRows(rows, 'status', '').map((r) => r.code)).toEqual([
      'heartbeat',
      'ts1_status',
    ]);
    expect(filterTagRows(rows, 'all', '  WEIGHT ').map((r) => r.code)).toEqual([
      'mh1_weight',
    ]);
    expect(filterTagRows(rows, 'all', 'ts#1').map((r) => r.code)).toEqual([
      'ts1_status',
    ]);
    expect(filterTagRows(rows, 'datetime', 'weight')).toEqual([]);
  });

  it('countTagRowsByCategory 는 세 묶음을 항상 돌려준다', () => {
    expect(countTagRowsByCategory(rows)).toEqual({
      datetime: 1,
      measurement: 1,
      status: 2,
    });
    expect(countTagRowsByCategory([])).toEqual({
      datetime: 0,
      measurement: 0,
      status: 0,
    });
  });
});

describe('resolveBoolDisplay', () => {
  it('*_status 는 true=OK(초록) / false=NG(빨강)', () => {
    expect(
      resolveBoolDisplay({ code: 'ts1_status', alarm: false }, true),
    ).toEqual({ key: 'ok', tone: 'good' });
    expect(
      resolveBoolDisplay({ code: 'ts1_status', alarm: false }, false),
    ).toEqual({ key: 'ng', tone: 'bad' });
  });

  it('heartbeat 는 1/0 이고 색이 없다', () => {
    expect(
      resolveBoolDisplay({ code: 'heartbeat', alarm: false }, true),
    ).toEqual({ key: 'one', tone: 'neutral' });
    expect(
      resolveBoolDisplay({ code: 'heartbeat', alarm: false }, false),
    ).toEqual({ key: 'zero', tone: 'none' });
  });

  it('알람 비트는 켜지면 빨강 ON, 그 밖의 비트는 중립 ON, 꺼지면 모두 흐린 OFF', () => {
    expect(
      resolveBoolDisplay({ code: 'e_stop_on', alarm: true }, true),
    ).toEqual({ key: 'on', tone: 'bad' });
    expect(
      resolveBoolDisplay({ code: 'crane_control_on', alarm: false }, true),
    ).toEqual({ key: 'on', tone: 'neutral' });
    expect(
      resolveBoolDisplay({ code: 'e_stop_on', alarm: true }, false),
    ).toEqual({ key: 'off', tone: 'none' });
  });
});
