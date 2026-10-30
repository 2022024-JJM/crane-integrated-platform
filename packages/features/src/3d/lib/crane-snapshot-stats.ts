import type { CraneSnapshot, CraneSnapshotTag } from '@crane/domain/monitoring';

/**
 * 서버 스냅샷 한 대분에 화면이 덧붙이는 관측치 — 수신 시각, heartbeat 가
 * 마지막으로 뒤집힌 시각, 태그별 변경 통계. 스냅샷 자체는 서버 값 그대로다.
 */
export interface CraneTagStat {
  /** 값이 마지막으로 바뀐 시각(수신 벽시계). 접속 후 한 번도 안 바뀌면 null. */
  changedAt: number | null;
  /** 접속 후 값이 바뀐 횟수. */
  changeCount: number;
  /** 접속 후 관측한 최소·최대(숫자 태그만). */
  min: number | null;
  max: number | null;
}

export interface CraneSnapshotEntry {
  snapshot: CraneSnapshot;
  /** 이 화면이 스냅샷을 받은 벽시계(ms). */
  receivedAt: number;
  /** heartbeat 태그가 마지막으로 뒤집힌 수신 시각. 아직이면 null. */
  heartbeatAt: number | null;
  stats: Record<string, CraneTagStat>;
}

/** PLC 생존 신호 태그. 매초 참·거짓이 뒤집힌다. */
export const HEARTBEAT_TAG = 'heartbeat';

/**
 * heartbeat 가 이 시간 안에 뒤집히지 않으면 "값은 오는데 PLC 쪽이 멈춤".
 * 서버가 1초 주기 토글을 250ms 묶음으로 내보내므로 2배 남짓 여유를 둔다.
 */
export const HEARTBEAT_STALE_MS = 2_500;

export type CraneLiveState = 'live' | 'stale' | 'off';

function initialStat(tag: CraneSnapshotTag): CraneTagStat {
  const numeric = typeof tag.value === 'number' ? tag.value : null;
  return { changedAt: null, changeCount: 0, min: numeric, max: numeric };
}

/**
 * 첫 수신 — 통계는 비어 있고 관측 범위는 현재 값 하나다. heartbeat 는 아직
 * 뒤집힌 적이 없으니 null(바로 stale 로 보이지 않게 호출자가 receivedAt 을
 * 기준으로 삼는다 — `resolveCraneLiveState`).
 */
export function createCraneSnapshotEntry(
  snapshot: CraneSnapshot,
  receivedAt: number,
): CraneSnapshotEntry {
  const stats: Record<string, CraneTagStat> = {};
  for (const [code, tag] of Object.entries(snapshot.tags)) {
    stats[code] = initialStat(tag);
  }
  return { snapshot, receivedAt, heartbeatAt: null, stats };
}

/**
 * 다음 스냅샷을 합친다. 바뀐 태그만 통계를 갱신하고 나머지 stat 객체는
 * 참조를 유지한다. 서버가 안 보낸 태그(이번 스냅샷에 없는 코드)는 통계에서
 * 지운다 — 스냅샷은 항상 전체 태그를 담으므로 정상 경로에선 일어나지 않는다.
 */
export function mergeCraneSnapshot(
  prev: CraneSnapshotEntry,
  snapshot: CraneSnapshot,
  receivedAt: number,
): CraneSnapshotEntry {
  const stats: Record<string, CraneTagStat> = {};
  let heartbeatAt = prev.heartbeatAt;
  for (const [code, tag] of Object.entries(snapshot.tags)) {
    const before = prev.snapshot.tags[code];
    const stat = prev.stats[code];
    if (!before || !stat) {
      stats[code] = initialStat(tag);
      continue;
    }
    if (before.value === tag.value) {
      stats[code] = stat;
      continue;
    }
    if (code === HEARTBEAT_TAG) heartbeatAt = receivedAt;
    const numeric = typeof tag.value === 'number' ? tag.value : null;
    stats[code] = {
      changedAt: receivedAt,
      changeCount: stat.changeCount + 1,
      min:
        numeric === null
          ? stat.min
          : stat.min === null
            ? numeric
            : Math.min(stat.min, numeric),
      max:
        numeric === null
          ? stat.max
          : stat.max === null
            ? numeric
            : Math.max(stat.max, numeric),
    };
  }
  return { snapshot, receivedAt, heartbeatAt, stats };
}

/**
 * 카드·상세의 상태 점 하나로 온라인과 heartbeat 를 함께 나타낸다.
 * - off: 연결이 없거나 서버가 `online=false` 로 내린 크레인
 * - live: heartbeat 가 최근(`staleMs`)에 뒤집힘. 첫 수신 직후엔 아직 뒤집힌
 *   적이 없으니 수신 시각을 기준으로 잠시 live 로 본다.
 * - stale: 값은 오는데 heartbeat 가 그대로 — PLC 나 수집 쪽이 멈췄는데
 *   파이프라인은 마지막 값을 계속 보내는 경우
 *
 * heartbeat 태그가 없는 크레인(외업)은 서버의 `online` 만 본다 — 서버는 값이
 * 바뀐 크레인만 다시 보내므로 수신 시각으로 재면 멈춰 선 크레인이 stale 로
 * 보인다. 서버는 수신이 끊긴 지 stale 기준이 지나면 `online=false` 를 보낸다.
 */
export function resolveCraneLiveState(
  entry: Pick<CraneSnapshotEntry, 'snapshot' | 'receivedAt' | 'heartbeatAt'>,
  now: number,
  connected: boolean,
  staleMs = HEARTBEAT_STALE_MS,
): CraneLiveState {
  if (!connected || !entry.snapshot.online) return 'off';
  if (!(HEARTBEAT_TAG in entry.snapshot.tags)) return 'live';
  const reference = entry.heartbeatAt ?? entry.receivedAt;
  return now - reference < staleMs ? 'live' : 'stale';
}
