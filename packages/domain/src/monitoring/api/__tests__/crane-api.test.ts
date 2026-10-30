import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();

vi.mock('@crane/core/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@crane/core/api')>();
  return {
    ...actual,
    restClient: { get: (...args: unknown[]) => get(...args) },
  };
});

const { RestClientError } = await import('@crane/core/api');
const { getCraneSnapshots } = await import('../get-crane-snapshots');
const { getCraneHistory } = await import('../get-crane-history');
const { getMonitoringReplayLite } =
  await import('../get-monitoring-replay-lite');

function history(craneId: string, values: Record<string, unknown>) {
  return {
    craneId,
    from: 'f',
    to: 't',
    step: '1s',
    tags: Object.keys(values),
    baseline: null,
    frames: [{ time: '2026-10-30T00:00:00Z', values }],
    truncated: false,
  };
}

beforeEach(() => {
  get.mockReset();
});

describe('getCraneSnapshots', () => {
  it('범위의 경로(`indoor/cranes`·`outdoor/cranes`)로 받는다', async () => {
    get.mockResolvedValue([]);
    await getCraneSnapshots('indoor');
    await getCraneSnapshots('outdoor');
    expect(get.mock.calls.map((call) => call[0])).toEqual([
      'indoor/cranes',
      'outdoor/cranes',
    ]);
  });

  it('깨진 항목은 버리고 배열이 아니면 던진다', async () => {
    get.mockResolvedValue([
      {
        craneId: 'GC_01',
        scope: 'outdoor',
        stationId: null,
        bay: 'ACS_PLC',
        snapshotAt: null,
        lastReceivedAt: null,
        online: true,
        tags: {},
      },
      { craneId: '' },
    ]);
    await expect(getCraneSnapshots('outdoor')).resolves.toHaveLength(1);
    get.mockResolvedValue({ cranes: [] });
    await expect(getCraneSnapshots('outdoor')).rejects.toThrow();
  });
});

describe('getCraneHistory', () => {
  it('범위 경로 아래 크레인 ID 를 인코딩해 붙인다', async () => {
    get.mockResolvedValue(history('GC_01', { a: 1 }));
    await getCraneHistory({
      scope: 'outdoor',
      craneId: 'GC 01',
      from: 'f',
      to: 't',
      step: '1s',
    });
    expect(get).toHaveBeenCalledWith('outdoor/cranes/GC%2001/history', {
      query: { from: 'f', to: 't', step: '1s' },
    });
  });
});

describe('getMonitoringReplayLite', () => {
  it('region 의 범위로 씬 크레인마다 이력을 받고 값 없음(null)을 남긴다', async () => {
    get.mockImplementation(async (path: string) =>
      history(path.split('/')[2], { x: 1, none: null }),
    );
    const result = await getMonitoringReplayLite({
      regionId: 'dock-1',
      craneIds: ['GC_01', 'TC_104'],
      from: 'f',
      to: 't',
    });
    expect(get.mock.calls.map((call) => call[0])).toEqual([
      'outdoor/cranes/GC_01/history',
      'outdoor/cranes/TC_104/history',
    ]);
    expect(result.craneIds).toEqual(['GC_01', 'TC_104']);
    expect(result.frames[0]?.cranes[0]?.values).toEqual({ x: 1, none: null });
  });

  it('서버가 모르는 크레인(404)은 빼고 나머지로 만든다', async () => {
    get.mockImplementation(async (path: string) => {
      if (path.includes('GC_99')) throw new RestClientError('nf', 404);
      return history(path.split('/')[2], { x: 1 });
    });
    const result = await getMonitoringReplayLite({
      regionId: 'dock-in',
      craneIds: ['GC_99', 'C_171'],
      from: 'f',
      to: 't',
    });
    expect(get.mock.calls[1]?.[0]).toBe('indoor/cranes/C_171/history');
    expect(result.craneIds).toEqual(['C_171']);
  });

  it('404 가 아닌 실패는 그대로 던진다 — 일부만 빠진 리플레이를 만들지 않는다', async () => {
    get.mockRejectedValue(new RestClientError('down', 503));
    await expect(
      getMonitoringReplayLite({
        regionId: 'dock-1',
        craneIds: ['GC_01'],
        from: 'f',
        to: 't',
      }),
    ).rejects.toThrow('down');
  });

  it('미등록 region 이나 크레인이 없는 씬은 조회 없이 빈 리플레이', async () => {
    const unknown = await getMonitoringReplayLite({
      regionId: 'nowhere',
      craneIds: ['GC_01'],
      from: 'f',
      to: 't',
    });
    const empty = await getMonitoringReplayLite({
      regionId: 'dock-1',
      craneIds: [],
      from: 'f',
      to: 't',
    });
    expect(get).not.toHaveBeenCalled();
    expect(unknown.frames).toEqual([]);
    expect(empty.frames).toEqual([]);
  });
});
