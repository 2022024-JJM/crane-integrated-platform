import { describe, expect, it } from 'vitest';
import {
  heartbeatCheckIntervalMs,
  isStalled,
  TagBatchCoalescer,
  parseIngestEnvelope,
  shouldForwardEnvelope,
  enqueueBounded,
  isTagMessageOutsideInterest,
} from '../realtime-ingest-protocol';

function tag(
  craneId: string,
  tagCode: string,
  value: unknown,
  overrides: Record<string, unknown> = {},
) {
  return {
    eventType: 'snapshot.delta',
    craneId,
    tagCode,
    value,
    timestamp: '2026-01-01T00:00:00Z',
    quality: 192,
    changed: true,
    occurredAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function toPairs(batch: {
  ids: Int32Array;
  values: Float64Array;
  count: number;
}) {
  const out: Array<[number, number]> = [];
  for (let i = 0; i < batch.count; i++)
    out.push([batch.ids[i]!, batch.values[i]!]);
  return out;
}

describe('parseIngestEnvelope', () => {
  it('JSON 봉투는 그대로, 봉투 모양이 아니면 unknown 봉투로 감싼다', () => {
    expect(parseIngestEnvelope('{"type":"x","payload":{"a":1}}')).toEqual({
      type: 'x',
      payload: { a: 1 },
    });
    expect(parseIngestEnvelope('{"a":1}')).toEqual({
      type: 'unknown',
      payload: { a: 1 },
    });
    expect(parseIngestEnvelope('not json')).toEqual({
      type: 'unknown',
      payload: 'not json',
    });
    expect(parseIngestEnvelope(null)).toEqual({
      type: 'unknown',
      payload: null,
    });
  });
});

describe('TagBatchCoalescer', () => {
  it('태그 메시지는 먹고 true, 그 밖은 false — 알람은 호출자가 봉투로 넘긴다', () => {
    const c = new TagBatchCoalescer();
    expect(c.ingest(tag('C-1', 'a', 1))).toBe(true);
    expect(c.ingest({ eventType: 'alarm.changed', craneId: 'C-1' })).toBe(
      false,
    );
    expect(c.ingest(null)).toBe(false);
    expect(c.ingest('text')).toBe(false);
  });

  it('첫 flush 에 새 키 사전이 함께 오고, 키는 craneId 의 하이픈을 언더스코어로 바꾼 형식이다', () => {
    const c = new TagBatchCoalescer();
    c.ingest(tag('C-171', 'tl_distance', 12.5));
    c.ingest(tag('C-172', 'tl_distance', 3));
    const b = c.flush()!;
    expect(b.newKeyIds).toEqual([0, 1]);
    expect(b.newKeys).toEqual(['C_171:tl_distance', 'C_172:tl_distance']);
    expect(toPairs(b)).toEqual([
      [0, 12.5],
      [1, 3],
    ]);
    expect(b.received).toBe(2);
    expect(b.dropped).toBe(0);
    // 다음 flush 엔 새 키가 없다.
    c.ingest(tag('C-171', 'tl_distance', 13));
    const b2 = c.flush()!;
    expect(b2.newKeyIds).toBeNull();
    expect(b2.newKeys).toBeNull();
    expect(toPairs(b2)).toEqual([[0, 13]]);
  });

  it('같은 키가 한 주기에 여러 번 오면 마지막 값만 남고 received 는 전부 센다', () => {
    const c = new TagBatchCoalescer();
    c.ingest(tag('C-1', 'a', 1));
    c.ingest(tag('C-1', 'a', 2));
    c.ingest(tag('C-1', 'a', 3));
    const b = c.flush()!;
    expect(toPairs(b)).toEqual([[0, 3]]);
    expect(b.received).toBe(3);
  });

  it('상태 비트(boolean·"true"/"false")는 1/0, 숫자로 못 바꾸는 값은 버린다(사전에도 안 들어감)', () => {
    const c = new TagBatchCoalescer();
    c.ingest(tag('C-1', 'on', true));
    c.ingest(tag('C-1', 'off', 'false'));
    c.ingest(tag('C-1', 'bad', 'ON'));
    c.ingest(tag('C-1', 'nul', null));
    c.ingest(tag('C-1', 'num', '12'));
    const b = c.flush()!;
    expect(b.newKeys).toEqual(['C_1:on', 'C_1:off']);
    expect(toPairs(b)).toEqual([
      [0, 1],
      [1, 0],
    ]);
    expect(b.received).toBe(5);
    expect(c.size).toBe(2);
  });

  it('형식이 깨진 태그 메시지(필드 결손·타입 오염)는 태그로 보지 않는다', () => {
    const c = new TagBatchCoalescer();
    expect(c.ingest(tag('C-1', 'a', 1, { quality: 'good' }))).toBe(false);
    expect(c.ingest(tag('C-1', 'a', 1, { changed: 'yes' }))).toBe(false);
    expect(c.ingest(tag('C-1', 'a', 1, { craneId: undefined }))).toBe(false);
    expect(c.flush()).toBeNull();
  });

  it('비었으면 flush 는 null — 받은 것도 보류 중인 것도 없을 때', () => {
    const c = new TagBatchCoalescer();
    expect(c.flush()).toBeNull();
  });

  it('관심 키를 주면 그 밖은 버리고 dropped 로 세며 사전에 넣지 않는다', () => {
    const c = new TagBatchCoalescer();
    c.setInterest(['C_1:a']);
    c.ingest(tag('C-1', 'a', 1));
    c.ingest(tag('C-1', 'b', 2));
    c.ingest(tag('C-2', 'a', 3));
    const b = c.flush()!;
    expect(b.newKeys).toEqual(['C_1:a']);
    expect(toPairs(b)).toEqual([[0, 1]]);
    expect(b.received).toBe(3);
    expect(b.dropped).toBe(2);
    expect(c.size).toBe(1);
  });

  it('받은 건이 전부 관심 밖이면 count 0 이지만 received·dropped 는 담아 flush 한다', () => {
    const c = new TagBatchCoalescer();
    c.setInterest(['x:y']);
    c.ingest(tag('C-1', 'a', 1));
    const b = c.flush()!;
    expect(b.count).toBe(0);
    expect(b.received).toBe(1);
    expect(b.dropped).toBe(1);
    expect(b.ids.length).toBe(0);
  });

  it('관심 키를 바꾸면 보류 중인 관심 밖 값은 지우고, null 로 돌리면 다시 전부 통과한다', () => {
    const c = new TagBatchCoalescer();
    c.ingest(tag('C-1', 'a', 1));
    c.ingest(tag('C-1', 'b', 2));
    c.setInterest(['C_1:b']);
    const b = c.flush()!;
    expect(toPairs(b)).toEqual([[1, 2]]);
    // 사전엔 둘 다 남아 있다(이미 보낸 id 는 유효해야 한다).
    expect(b.newKeys).toEqual(['C_1:a', 'C_1:b']);
    c.setInterest(null);
    c.ingest(tag('C-1', 'a', 5));
    expect(toPairs(c.flush()!)).toEqual([[0, 5]]);
  });

  it('빈 관심 목록은 전부 버린다(null 과 다르다)', () => {
    const c = new TagBatchCoalescer();
    c.setInterest([]);
    c.ingest(tag('C-1', 'a', 1));
    const b = c.flush()!;
    expect(b.count).toBe(0);
    expect(b.dropped).toBe(1);
  });

  it('키 id 는 등장 순으로 0 부터 붙고 재사용되지 않는다', () => {
    const c = new TagBatchCoalescer();
    c.ingest(tag('C-1', 'a', 1));
    c.flush();
    c.ingest(tag('C-1', 'b', 1));
    c.ingest(tag('C-1', 'a', 1));
    const b = c.flush()!;
    expect(b.newKeyIds).toEqual([1]);
    expect(b.newKeys).toEqual(['C_1:b']);
    expect(
      toPairs(b)
        .map(([id]) => id)
        .sort(),
    ).toEqual([0, 1]);
  });
});

describe('heartbeat', () => {
  it('마지막 수신이 heartbeat 이상 오래되면 stalled; 0·음수 heartbeat 나 수신 기록 없음(−∞)은 아니다', () => {
    expect(isStalled(1000, 1000 + 15_000, 15_000)).toBe(true);
    expect(isStalled(1000, 1000 + 14_999, 15_000)).toBe(false);
    expect(isStalled(1000, 100_000, 0)).toBe(false);
    expect(isStalled(Number.NEGATIVE_INFINITY, 100_000, 15_000)).toBe(false);
  });
  it('감시 주기는 heartbeat 의 1/5, 최소 1초', () => {
    expect(heartbeatCheckIntervalMs(15_000)).toBe(3_000);
    expect(heartbeatCheckIntervalMs(2_000)).toBe(1_000);
  });
});

describe('TagBatchCoalescer — 서버 배치·배열', () => {
  it('snapshot.batch 의 items 를 건마다 먹고 true, 깨진 항목은 건너뛴다', () => {
    const c = new TagBatchCoalescer();
    expect(
      c.ingest({
        eventType: 'snapshot.batch',
        timestamp: 't',
        items: [
          { craneId: 'C-1', tagCode: 'A', value: 1, changed: true },
          { craneId: 'C-1', tagCode: 'B', value: 'true' },
          { craneId: 'C-1', tagCode: 'C' }, // value 없음 → 항목 아님
          { craneId: 'C-1', tagCode: 'D', value: 'nope' }, // 숫자 아님 → 버림
          null,
        ],
      }),
    ).toBe(true);
    const f = c.flush()!;
    expect(f.received).toBe(3);
    expect(toPairs(f)).toEqual([
      [0, 1],
      [1, 1],
    ]);
    expect(f.newKeys).toEqual(['C_1:A', 'C_1:B']);
  });

  it('태그 메시지 배열도 먹고, 태그가 하나도 없는 배열은 false', () => {
    const c = new TagBatchCoalescer();
    expect(c.ingest([tag('C-1', 'A', 2), { x: 1 }])).toBe(true);
    expect(c.ingest([{ x: 1 }, 'junk'])).toBe(false);
    expect(c.ingest([])).toBe(false);
    expect(toPairs(c.flush()!)).toEqual([[0, 2]]);
  });

  it('관심 키는 배치 항목에도 적용된다', () => {
    const c = new TagBatchCoalescer();
    c.setInterest(['C_1:B']);
    c.ingest({
      eventType: 'snapshot.batch',
      items: [
        { craneId: 'C-1', tagCode: 'A', value: 1 },
        { craneId: 'C-1', tagCode: 'B', value: 2 },
      ],
    });
    const f = c.flush()!;
    expect(f.received).toBe(2);
    expect(f.dropped).toBe(1);
    expect(toPairs(f)).toEqual([[0, 2]]);
  });
});

describe('shouldForwardEnvelope', () => {
  it('payload 가 객체(알람 등)일 때만 메인으로 — 문자열·숫자·null 은 버린다', () => {
    expect(
      shouldForwardEnvelope({ type: 'alarm', payload: { eventType: 'x' } }),
    ).toBe(true);
    expect(shouldForwardEnvelope(parseIngestEnvelope('not json'))).toBe(false);
    expect(shouldForwardEnvelope({ type: 'unknown', payload: 42 })).toBe(false);
    expect(shouldForwardEnvelope({ type: 'unknown', payload: null })).toBe(
      false,
    );
  });
});

describe('파싱 전 거르기', () => {
  const raw = (crane: string, code = 'A', type = 'snapshot.delta') =>
    JSON.stringify({
      type: 'tag',
      payload: tag(crane, code, 1, { eventType: type }),
    });

  it('관심 밖 키의 snapshot.delta 만 true — 관심 키·알람·null 관심은 false', () => {
    const keys = new Set(['C_1:A', 'C_2:B']);
    expect(isTagMessageOutsideInterest(raw('C-9'), keys)).toBe(true);
    expect(isTagMessageOutsideInterest(raw('C-1', 'Z'), keys)).toBe(true);
    expect(isTagMessageOutsideInterest(raw('C-1'), keys)).toBe(false);
    expect(isTagMessageOutsideInterest(raw('C-2', 'B'), keys)).toBe(false);
    expect(
      isTagMessageOutsideInterest(raw('C-9', 'A', 'alarm.changed'), keys),
    ).toBe(false);
    expect(isTagMessageOutsideInterest(raw('C-9'), null)).toBe(false);
    expect(isTagMessageOutsideInterest('not json', keys)).toBe(false);
    // 공백이 있는 JSON 도 읽는다.
    expect(
      isTagMessageOutsideInterest(
        '{"payload":{"eventType" : "snapshot.delta", "craneId" : "C-9", "tagCode" : "A"}}',
        keys,
      ),
    ).toBe(true);
    // tagCode 가 안 읽히면 파싱 경로로(false).
    expect(
      isTagMessageOutsideInterest(
        '{"payload":{"eventType":"snapshot.delta","craneId":"C-9"}}',
        keys,
      ),
    ).toBe(false);
    // 빈 관심은 전부 관심 밖.
    expect(isTagMessageOutsideInterest(raw('C-1'), new Set())).toBe(true);
  });

  it('병합기의 원문 거르기는 received·dropped 에 센다', () => {
    const c = new TagBatchCoalescer();
    c.setInterest(['C_1:A']);
    expect(c.dropRawIfOutsideInterest(raw('C-9'))).toBe(true);
    expect(c.dropRawIfOutsideInterest(raw('C-1'))).toBe(false);
    const f = c.flush()!;
    expect(f.received).toBe(1);
    expect(f.dropped).toBe(1);
    expect(f.count).toBe(0);
  });
});

describe('enqueueBounded', () => {
  it('상한 안은 0, 넘치면 오래된 것부터 버리고 버린 수를 돌려준다', () => {
    const q: number[] = [];
    expect(enqueueBounded(q, 1, 2)).toBe(0);
    expect(enqueueBounded(q, 2, 2)).toBe(0);
    expect(enqueueBounded(q, 3, 2)).toBe(1);
    expect(q).toEqual([2, 3]);
  });
});
