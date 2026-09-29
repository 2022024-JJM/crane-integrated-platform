import type { EquipmentRuntimeStatus } from '@crane/core/types/status';
import type { SavedModelInfo } from '@crane/domain/3d';

/**
 * 태그 활동 판정 — 태그 값 버스의 수신·변화 시각에서 "움직이는가, 오고 있는가"
 * 를 가른다. 이것은 장비의 운전 상태가 아니라 그 재료다: 운전 상태(여섯 가지)는
 * 이 결과에 모델의 상태 태그를 더해 lib/model-label-state.ts 가 낸다.
 *
 * 값이 바뀌면 움직이는 것이고, 수신이 끊기면 통신두절이라는 규칙은 생산자
 * (가상 태그·WebSocket·리플레이)와 무관하게 성립한다. 움직임 판정 키는 모델의
 * `tagMappings` 가 참조하는 tagKey 들이다 — craneId 가 없는 모델(필리 씬)도
 * 맵핑만 있으면 판정이 나온다.
 *
 * 창 크기: 리플레이 기본 프레임 간격이 5초라 moving 창을 그보다 넓게 잡아야
 * 프레임 사이에서 멈춘 것으로 깜빡이지 않는다. offline 창은 WebSocket 재연결
 * 초기 백오프(1s→30s)보다 짧아 끊김이 늦지 않게 보이는 선.
 *
 * 이 파일은 운전 상태 기록(모델 id → 상태)의 비교·집계·색도 가진다.
 */
export const RUNNING_WINDOW_MS = 8_000;
export const OFFLINE_WINDOW_MS = 20_000;

export interface TagActivity {
  at: number;
  changedAt: number;
}

export interface RuntimeStatusWindows {
  runningMs: number;
  offlineMs: number;
}

export const DEFAULT_STATUS_WINDOWS: RuntimeStatusWindows = {
  runningMs: RUNNING_WINDOW_MS,
  offlineMs: OFFLINE_WINDOW_MS,
};

/**
 * 배속에 맞춘 판정 창 — 창은 벽시계 기준이라 리플레이 0.5배속(프레임 간격
 * 10초)에선 moving 창 8초를 넘어 프레임 사이에서 멈춘 것으로 깜빡이고,
 * 8배속에선 너무 느슨하다. 3D 플레이는 창을 1/배속 으로 늘이거나 줄인다. 0·NaN 은 1.
 */
export function scaleStatusWindows(timeScale: number): RuntimeStatusWindows {
  const scale = Number.isFinite(timeScale) && timeScale > 0 ? 1 / timeScale : 1;
  return {
    runningMs: Math.max(
      STATUS_WINDOW_FLOOR_MS.running,
      RUNNING_WINDOW_MS * scale,
    ),
    offlineMs: Math.max(
      STATUS_WINDOW_FLOOR_MS.offline,
      OFFLINE_WINDOW_MS * scale,
    ),
  };
}

/**
 * 배속 축소의 하한 — 1Hz 폴링 격자보다 좁아지면 파형 정점에 멈춘 태그가 폴링마다
 * 움직임↔멈춤으로 뒤집혀 라벨 색이 깜빡인다(×8 에서 1s 창, 2026-09-16).
 */
export const STATUS_WINDOW_FLOOR_MS = {
  running: 2_000,
  offline: 4_000,
} as const;

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
 * 태그 활동의 네 갈래.
 * - moving: 최근 창 안에 값이 바뀜
 * - still: 수신은 되지만 값이 안 바뀜
 * - offline: 한 번은 받았지만 수신이 끊김
 * - unknown: 아직 한 번도 받지 못함(키가 없는 경우 포함)
 */
export type TagActivityState = 'moving' | 'still' | 'offline' | 'unknown';

/**
 * 키 목록의 활동 판정. 키 중 가장 최근 수신·변화 시각을 쓴다(한 축만 움직여도
 * moving). `get` 이 하나도 못 찾으면 unknown. NaN 시각은 없는 것으로 본다.
 *
 * `livenessKeys` 는 수신(offline·unknown) 판정에만 쓰는 키다. 생략하면 `keys`
 * 와 같다. 상태 태그처럼 "오고 있다는 증거는 되지만 움직임은 아닌" 키를 여기에
 * 더 넣는다 — Bypass 스위치를 눌렀다고 움직임으로 잡히면 안 된다
 * (lib/model-label-state.ts).
 */
export function resolveTagActivity(
  keys: readonly string[],
  get: (key: string) => TagActivity | undefined,
  now: number,
  windows: RuntimeStatusWindows = DEFAULT_STATUS_WINDOWS,
  livenessKeys: readonly string[] = keys,
): TagActivityState {
  let latestAt = Number.NEGATIVE_INFINITY;
  let latestChangedAt = Number.NEGATIVE_INFINITY;
  let seen = false;
  for (const key of livenessKeys) {
    const activity = get(key);
    if (!activity || !Number.isFinite(activity.at)) continue;
    seen = true;
    if (activity.at > latestAt) latestAt = activity.at;
  }
  for (const key of keys) {
    const activity = get(key);
    if (!activity) continue;
    if (
      Number.isFinite(activity.changedAt) &&
      activity.changedAt > latestChangedAt
    ) {
      latestChangedAt = activity.changedAt;
    }
  }
  if (!seen) return 'unknown';
  if (now - latestChangedAt <= windows.runningMs) return 'moving';
  if (now - latestAt <= windows.offlineMs) return 'still';
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

/** 운전 상태 여섯 가지 — 집계·누적이 도는 순서(표시 순서이기도 하다). */
export const RUNTIME_STATUS_KEYS = [
  'running',
  'standby',
  'off',
  'fault',
  'offline',
  'unknown',
] as const satisfies readonly EquipmentRuntimeStatus[];

export interface RuntimeStatusCounts extends Record<
  EquipmentRuntimeStatus,
  number
> {
  /** unknown 을 뺀 "상태를 아는" 장비 수 — HUD 의 분모. */
  known: number;
}

export function countRuntimeStatuses(
  record: RuntimeStatusRecord,
): RuntimeStatusCounts {
  const counts: RuntimeStatusCounts = {
    running: 0,
    standby: 0,
    off: 0,
    fault: 0,
    offline: 0,
    unknown: 0,
    known: 0,
  };
  for (const status of Object.values(record)) {
    counts[status] += 1;
  }
  counts.known = Object.values(record).length - counts.unknown;
  return counts;
}

/**
 * 운전 상태 색(hex) — 라벨(DOM, model-label.tsx)의 Tailwind 클래스와 같은 색
 * 이다. 바꾸면 함께 바꾼다. 고장·가동·운전 전원 On·Off 는 ACMS 매뉴얼의
 * Crane ID Box 색. hex 를 직접 읽는 곳은 실행 리포트의 가동 색
 * (PLAY3D_STATUS_FILL.running)뿐이다 — 3D 플레이에서 라벨과 리포트가 한
 * 화면에 있어 같은 색이어야 한다. unknown 은 null: 상태를 모르는 장비는
 * 기본 색 그대로.
 */
export const RUNTIME_STATUS_COLORS: Record<
  EquipmentRuntimeStatus,
  string | null
> = {
  fault: '#ff0000',
  running: '#3ab426',
  standby: '#ffff00',
  off: '#a6a6a6',
  offline: '#a1a1aa',
  unknown: null,
};
