import { describe, expect, it } from 'vitest';
import { parseReplayTimestamp } from '../parse-replay-timestamp';

describe('parseReplayTimestamp', () => {
  it('Z 가 붙은 값은 UTC 그대로', () => {
    expect(parseReplayTimestamp('2026-09-11T10:20:30Z', 'Asia/Seoul')).toBe(
      Date.UTC(2026, 8, 11, 10, 20, 30),
    );
  });

  it('Z 가 없으면 현장 벽시계로 읽는다 — 서울 +9, 뉴욕 EDT -4', () => {
    expect(parseReplayTimestamp('2026-09-11T10:20:30', 'Asia/Seoul')).toBe(
      Date.UTC(2026, 8, 11, 1, 20, 30),
    );
    expect(
      parseReplayTimestamp('2026-09-11T10:20:30', 'America/New_York'),
    ).toBe(Date.UTC(2026, 8, 11, 14, 20, 30));
  });

  it('초·밀리초 생략과 소수 초를 처리한다', () => {
    expect(parseReplayTimestamp('2026-09-11T10:20Z', 'Asia/Seoul')).toBe(
      Date.UTC(2026, 8, 11, 10, 20, 0),
    );
    expect(parseReplayTimestamp('2026-09-11T10:20:30.250Z', 'Asia/Seoul')).toBe(
      Date.UTC(2026, 8, 11, 10, 20, 30, 250),
    );
  });

  it('형식이 다르거나 비어 있으면 null', () => {
    expect(parseReplayTimestamp('2026/09/11 10:20', 'Asia/Seoul')).toBeNull();
    expect(parseReplayTimestamp('', 'Asia/Seoul')).toBeNull();
    expect(parseReplayTimestamp(null, 'Asia/Seoul')).toBeNull();
    expect(parseReplayTimestamp(undefined, 'Asia/Seoul')).toBeNull();
    expect(parseReplayTimestamp('not a date', 'Asia/Seoul')).toBeNull();
  });
});
