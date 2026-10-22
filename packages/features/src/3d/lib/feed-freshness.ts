import type { CraneFeedConnection } from '../model/use-crane-snapshot-feed';

/**
 * 관제 HUD 의 수신 줄("n초 전 수신") 판정 — 크레인 스냅샷 피드의 소켓 상태,
 * 화면 반영 보류, 마지막 묶음 수신 시각을 한 상태로 합친다.
 *
 * 보류가 소켓보다 앞선다 — 연결돼 있어도 보류 중이면 그걸 보여야 "값이 안
 * 오는 게 서버 탓인지 정지 탓인지" 를 가른다. 연결은 됐는데 묶음이
 * `staleMs` 넘게 없으면 stale — 서버는 바뀐 크레인만 싣지만 살아 있는
 * 크레인은 heartbeat 로 매초 한 번은 오므로, 묶음이 멎은 것은 전 크레인이
 * 멎은 것이다.
 */
export const FEED_STALE_MS = 5_000;

export type FeedFreshnessState =
  | 'live'
  | 'stale'
  | 'waiting'
  | 'connecting'
  | 'closed'
  | 'held';

export type FeedFreshnessTone = 'good' | 'warn' | 'bad' | 'muted';

export interface FeedFreshness {
  state: FeedFreshnessState;
  tone: FeedFreshnessTone;
  /** 마지막 수신 뒤 경과(ms). 아직 받은 적이 없으면 null. */
  ageMs: number | null;
}

export function resolveFeedFreshness(
  connection: CraneFeedConnection,
  held: boolean,
  lastReceivedAt: number | null,
  now: number,
  staleMs = FEED_STALE_MS,
): FeedFreshness {
  const ageMs =
    lastReceivedAt === null || !Number.isFinite(lastReceivedAt)
      ? null
      : Math.max(0, now - lastReceivedAt);
  if (held) return { state: 'held', tone: 'warn', ageMs };
  if (connection === 'connecting' || connection === 'reconnecting') {
    return { state: 'connecting', tone: 'warn', ageMs };
  }
  if (connection === 'off') return { state: 'closed', tone: 'bad', ageMs };
  if (ageMs === null) return { state: 'waiting', tone: 'muted', ageMs };
  return ageMs <= staleMs
    ? { state: 'live', tone: 'good', ageMs }
    : { state: 'stale', tone: 'warn', ageMs };
}
