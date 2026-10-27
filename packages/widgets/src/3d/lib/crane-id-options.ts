import { normalizeCraneKey } from '@crane/core/lib/crane-tag-key';
import type {
  CraneFeedConnection,
  CraneSnapshotEntry,
} from '@crane/features/3d';
import type { ComboboxOption } from '@crane/ui/molecules/combobox';

/**
 * 인스펙터 크레인 콤보박스의 선택지 — 크레인 스냅샷 스토어가 든 크레인(서버가
 * REST 전체 조회·STOMP 묶음으로 준 것) 전부. 값·라벨은 서버 ID 그대로, 설명은
 * 구역(bay), 서버가 오프라인으로 주는 크레인은 배지를 달되 고를 수는 있다.
 * 순서는 스토어의 `order`(ID 순). 정규화 키(`-`→`_`)가 같은 항목은 첫 것만
 * 남긴다. 서버 밖 ID 는 선택지에 없다 — 자유 입력도 코드 목록도 없다.
 */
export function buildCraneIdOptions(
  order: readonly string[],
  cranes: Readonly<Record<string, Pick<CraneSnapshotEntry, 'snapshot'>>>,
  labels: { offline: string },
): ComboboxOption[] {
  const seen = new Set<string>();
  const out: ComboboxOption[] = [];
  for (const craneId of order) {
    const entry = cranes[craneId];
    if (!craneId || !entry) continue;
    const key = normalizeCraneKey(craneId);
    if (seen.has(key)) continue;
    seen.add(key);
    const bay = entry.snapshot.bay?.trim();
    out.push({
      value: craneId,
      label: craneId,
      ...(bay ? { description: bay } : {}),
      ...(entry.snapshot.online ? {} : { badge: labels.offline }),
    });
  }
  return out;
}

/** 현재값이 선택지에 있는가 — 정규화 키로 비교한다. */
export function isListedCraneId(
  options: readonly ComboboxOption[],
  craneId: string | undefined,
): boolean {
  if (!craneId) return false;
  const key = normalizeCraneKey(craneId);
  return options.some((o) => normalizeCraneKey(o.value) === key);
}

export type CraneListEmptyReason =
  | 'empty'
  | 'loadError'
  | 'connecting'
  | 'disconnected';

/**
 * 선택지가 비었을 때 보일 이유 — 연결 상태가 먼저다. 연결돼 있으면 초기 조회
 * 실패인지 아직 아무것도 안 왔는지를 가른다. i18n 키 `inspector.crane.{reason}`.
 */
export function craneListEmptyReason(
  connection: CraneFeedConnection,
  loadError: boolean,
): CraneListEmptyReason {
  if (connection === 'open') return loadError ? 'loadError' : 'empty';
  if (connection === 'connecting') return 'connecting';
  return 'disconnected';
}
