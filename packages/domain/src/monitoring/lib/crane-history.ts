import { getCraneById } from '../../shared';
import type {
  CraneHistoryFrame,
  CraneHistoryFrames,
  ReplayLiteCraneSnapshot,
  ReplayLiteFrame,
  ReplayLiteResponse,
} from '../model/types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTagValue(value: unknown): value is number | boolean {
  return (
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  );
}

function sanitizeFrame(value: unknown): CraneHistoryFrame | null {
  if (!isRecord(value) || typeof value.time !== 'string') return null;
  if (!isRecord(value.values)) return null;
  const values: Record<string, number | boolean> = {};
  for (const [tag, raw] of Object.entries(value.values)) {
    if (isTagValue(raw)) values[tag] = raw;
  }
  return { time: value.time, values };
}

/**
 * `GET /api/cranes/{id}/history` 응답 방어 — craneId·from·to·frames 가
 * 어긋나면 null. 프레임은 time 이 문자열이 아니거나 values 가 객체가 아니면
 * 버리고, 값은 숫자(유한)·불리언만 남긴다. baseline 은 없거나 깨지면 null.
 */
export function sanitizeCraneHistoryFrames(
  value: unknown,
): CraneHistoryFrames | null {
  if (!isRecord(value)) return null;
  if (typeof value.craneId !== 'string' || value.craneId.length === 0) {
    return null;
  }
  if (typeof value.from !== 'string' || typeof value.to !== 'string') {
    return null;
  }
  if (!Array.isArray(value.frames)) return null;

  const frames: CraneHistoryFrame[] = [];
  for (const item of value.frames) {
    const frame = sanitizeFrame(item);
    if (frame) frames.push(frame);
  }
  const tags = Array.isArray(value.tags)
    ? value.tags.filter((tag): tag is string => typeof tag === 'string')
    : [];
  return {
    craneId: value.craneId,
    from: value.from,
    to: value.to,
    step: typeof value.step === 'string' ? value.step : '',
    tags,
    baseline: value.baseline == null ? null : sanitizeFrame(value.baseline),
    frames,
    truncated: value.truncated === true,
  };
}

function frameTimeMs(time: string): number {
  return Date.parse(time);
}

function compareTimestamps(left: string, right: string) {
  const diff = frameTimeMs(left) - frameTimeMs(right);
  return Number.isNaN(diff) ? left.localeCompare(right) : diff;
}

/**
 * 크레인별 이력을 한 시간 축으로 합친다. 모든 크레인이 같은 from·step 으로
 * 조회됐으므로 프레임 시각은 같은 격자에 놓인다 — 시각 문자열이 같은 프레임을
 * 한 장으로 묶는다. 행 상한에 걸려(truncated) 먼저 끝난 크레인은 그 뒤
 * 프레임에서 빠지고, 값이 하나도 없는 크레인(조회 구간에 데이터 없음)은
 * 어느 프레임에도 들어가지 않는다 — 리플레이 스토어는 프레임에 없는 크레인의
 * 값을 건드리지 않으므로 마지막 자세가 유지된다. baseline 은 서버가 이미 첫
 * 프레임에 반영했으므로 쓰지 않는다. 값은 서버 그대로(숫자·불리언) 싣는다.
 */
export function buildReplayFromCraneHistories(
  histories: CraneHistoryFrames[],
  query: { from: string; to: string },
): ReplayLiteResponse {
  const byTime = new Map<string, ReplayLiteCraneSnapshot[]>();
  for (const history of histories) {
    const craneNo = getCraneById(history.craneId)?.craneNo ?? history.craneId;
    for (const frame of history.frames) {
      if (Object.keys(frame.values).length === 0) continue;
      const cranes = byTime.get(frame.time) ?? [];
      cranes.push({
        craneId: history.craneId,
        craneNo,
        snapshotAt: frame.time,
        values: { ...frame.values },
      });
      byTime.set(frame.time, cranes);
    }
  }

  const frames: ReplayLiteFrame[] = [...byTime.entries()]
    .map(([timestamp, cranes]) => ({ timestamp, cranes }))
    .sort((left, right) => compareTimestamps(left.timestamp, right.timestamp));

  return {
    from: query.from,
    to: query.to,
    craneIds: histories.map((history) => history.craneId),
    frames,
  };
}
