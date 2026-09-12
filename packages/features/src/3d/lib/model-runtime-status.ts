import type { EquipmentRuntimeStatus } from '@crane/core/types/status';
import type { SavedModelInfo } from '@crane/domain/3d';

/**
 * 장비 운전 상태 판정 — 태그 값 버스의 수신·변화 시각에서 파생한다.
 * 적용은 model/use-model-runtime-statuses.ts(1Hz 폴링 훅), 표시는 라벨
 * 상태 점(domain model-label)·미니맵 마커·관제 HUD 집계.
 *
 * 왜 PLC 상태 태그가 아니라 활동인가: 씬마다 태그 체계가 다르고(옥포는
 * `C_868:...`, 필리는 `GC_04:...`) 운전 상태 태그가 정의된 곳이 없다. 값이
 * 바뀌면 움직이는 것이고, 수신이 끊기면 통신두절이라는 규칙은 생산자
 * (가상 태그·WebSocket·리플레이)와 무관하게 성립한다. 판정 대상 키는 모델의
 * `tagMappings` 가 참조하는 tagKey 들이다 — craneId 가 없는 모델(필리 씬)도
 * 맵핑만 있으면 상태가 나온다.
 *
 * 창 크기: 리플레이 기본 프레임 간격이 5초라 running 창을 그보다 넓게
 * 잡아야 프레임 사이에서 idle 로 깜빡이지 않는다. offline 창은 WebSocket
 * 재연결 초기 백오프(1s→30s)보다 짧아 끊김이 늦지 않게 보이는 선.
 */
export const RUNNING_WINDOW_MS = 8_000;
export const OFFLINE_WINDOW_MS = 20_000;

export interface TagActivity {
  at: number;
  changedAt: number;
}

/** 모델이 참조하는 태그 키 목록(중복 제거, 맵핑 순서 유지). */
export function collectModelTagKeys(
  model: Pick<SavedModelInfo, 'tagMappings'>,
): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const mapping of model.tagMappings ?? []) {
    const key = mapping.tagKey;
    if (typeof key !== 'string' || key.length === 0 || seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
  }
  return keys;
}

/**
 * 키 목록의 활동 → 상태. 키 중 가장 최근 수신·변화 시각을 쓴다(한 축만
 * 움직여도 running). `get` 이 하나도 못 찾으면 unknown. NaN 시각은 없는
 * 것으로 본다.
 */
export function resolveRuntimeStatus(
  keys: readonly string[],
  get: (key: string) => TagActivity | undefined,
  now: number,
): EquipmentRuntimeStatus {
  let latestAt = Number.NEGATIVE_INFINITY;
  let latestChangedAt = Number.NEGATIVE_INFINITY;
  let seen = false;
  for (const key of keys) {
    const activity = get(key);
    if (!activity) continue;
    if (Number.isFinite(activity.at)) {
      seen = true;
      if (activity.at > latestAt) latestAt = activity.at;
    }
    if (
      Number.isFinite(activity.changedAt) &&
      activity.changedAt > latestChangedAt
    ) {
      latestChangedAt = activity.changedAt;
    }
  }
  if (!seen) return 'unknown';
  if (now - latestChangedAt <= RUNNING_WINDOW_MS) return 'running';
  if (now - latestAt <= OFFLINE_WINDOW_MS) return 'idle';
  return 'offline';
}

export type RuntimeStatusRecord = Readonly<
  Record<string, EquipmentRuntimeStatus>
>;

/** 두 상태 기록이 같은 내용인지 — 훅이 참조를 유지할지 판단한다. */
export function isSameRuntimeStatusRecord(
  a: RuntimeStatusRecord,
  b: RuntimeStatusRecord,
): boolean {
  const keysA = Object.keys(a);
  if (keysA.length !== Object.keys(b).length) return false;
  for (const key of keysA) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

export interface RuntimeStatusCounts {
  running: number;
  idle: number;
  offline: number;
  unknown: number;
  /** unknown 을 뺀 "상태를 아는" 장비 수 — HUD 의 분모. */
  known: number;
}

export function countRuntimeStatuses(
  record: RuntimeStatusRecord,
): RuntimeStatusCounts {
  const counts: RuntimeStatusCounts = {
    running: 0,
    idle: 0,
    offline: 0,
    unknown: 0,
    known: 0,
  };
  for (const status of Object.values(record)) {
    counts[status] += 1;
  }
  counts.known = counts.running + counts.idle + counts.offline;
  return counts;
}

/**
 * 미니맵 마커·HUD 점의 상태 색(hex). 라벨(DOM)은 Tailwind 클래스로 같은
 * 팔레트를 쓴다(model-label.tsx) — 바꾸면 함께 바꾼다. unknown 은 null:
 * 상태를 모르는 장비는 기본 색 그대로.
 */
export const RUNTIME_STATUS_COLORS: Record<
  EquipmentRuntimeStatus,
  string | null
> = {
  running: '#34d399',
  idle: '#7dd3fc',
  offline: '#a1a1aa',
  unknown: null,
};
