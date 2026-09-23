import type { ZoneJournalEntry } from '@crane/domain/journal';
import type { SavedSceneInfo } from '@crane/domain/3d';
import type { ZoneIntrusion } from '../model/use-scene-zone-store';

/**
 * 영역 침범 스토어(현재 상태) → 저널 항목(진입·이탈 사건). 스토어는 기록을
 * 들지 않으므로(use-scene-zone-store 주석) 두 스냅샷의 차이로 사건을 복원한다.
 * 순수 함수 — 동기화 컴포넌트(ZoneJournalSync)가 subscribe 마다 부른다.
 */

export interface ZonePairRef {
  intrusion: ZoneIntrusion;
  intruderId: string;
  intruderName: string;
}

export function pairKeyOf(zoneKey: string, intruderId: string): string {
  return `${zoneKey}|${intruderId}`;
}

/** 두 스냅샷 사이에 생긴 쌍(진입)과 사라진 쌍(이탈). */
export function diffZoneIntrusions(
  prev: readonly ZoneIntrusion[],
  next: readonly ZoneIntrusion[],
): { entered: ZonePairRef[]; exited: ZonePairRef[] } {
  const prevPairs = new Map<string, ZonePairRef>();
  for (const intrusion of prev) {
    for (const intruder of intrusion.intruders) {
      prevPairs.set(pairKeyOf(intrusion.zoneKey, intruder.id), {
        intrusion,
        intruderId: intruder.id,
        intruderName: intruder.name,
      });
    }
  }
  const nextPairs = new Map<string, ZonePairRef>();
  for (const intrusion of next) {
    for (const intruder of intrusion.intruders) {
      nextPairs.set(pairKeyOf(intrusion.zoneKey, intruder.id), {
        intrusion,
        intruderId: intruder.id,
        intruderName: intruder.name,
      });
    }
  }
  const entered: ZonePairRef[] = [];
  for (const [key, ref] of nextPairs) {
    if (!prevPairs.has(key)) entered.push(ref);
  }
  const exited: ZonePairRef[] = [];
  for (const [key, ref] of prevPairs) {
    if (!nextPairs.has(key)) exited.push(ref);
  }
  return { entered, exited };
}

/**
 * 브릿지(저널·로컬 알람·알림)의 승인 규칙 — 진입은 `acceptEnter`(실시간 화면이
 * 떠 있는가)일 때만, 이탈은 진입을 승인했던 쌍(`isAccepted`)만 받는다.
 * 3D 플레이·에디터의 침범은 진입에서 걸러지고, 그 이탈도 승인이 없어 걸러진다.
 * 실시간 화면을 떠나며 오는 이탈은 진입이 승인돼 있어 화면 상태와 무관하게
 * 통과한다 — 언마운트 cleanup 순서(부모가 먼저라 activeMode 가 먼저 null 이
 * 된다)에 기대지 않는다. 진입을 못 본 이탈(새로고침 뒤)도 버린다.
 */
export function filterAcceptedZoneTransitions(
  entered: readonly ZonePairRef[],
  exited: readonly ZonePairRef[],
  isAccepted: (pairKey: string) => boolean,
  acceptEnter: boolean,
): { entered: ZonePairRef[]; exited: ZonePairRef[] } {
  return {
    entered: acceptEnter ? [...entered] : [],
    exited: exited.filter((ref) =>
      isAccepted(pairKeyOf(ref.intrusion.zoneKey, ref.intruderId)),
    ),
  };
}

/**
 * 모델 id 가 속한 region. 한 씬 파일을 공유하는 region 들은 같은 모델 id 를
 * 가지므로(대시보드가 모든 region 을 채워 둔다) 화면에 떠 있는 region 을
 * 먼저 본다. 없으면 전부 훑는다.
 */
export function findRegionOfModel(
  modelId: string,
  sceneInfoByRegion: Readonly<Record<string, SavedSceneInfo>>,
  preferredRegionId?: string | null,
): string | null {
  if (
    preferredRegionId &&
    sceneInfoByRegion[preferredRegionId]?.models.some((m) => m.id === modelId)
  ) {
    return preferredRegionId;
  }
  for (const [regionId, scene] of Object.entries(sceneInfoByRegion)) {
    if (scene.models.some((m) => m.id === modelId)) return regionId;
  }
  return null;
}

export function toZoneJournalEntry(
  ref: ZonePairRef,
  kind: 'enter' | 'exit',
  at: number,
  regionId: string | null,
  enteredAt: number | null,
): ZoneJournalEntry {
  const { intrusion } = ref;
  return {
    key: `${at}:${kind}:${pairKeyOf(intrusion.zoneKey, ref.intruderId)}`,
    at,
    kind,
    regionId,
    zoneKey: intrusion.zoneKey,
    ownerId: intrusion.ownerId,
    ownerName: intrusion.ownerName,
    zoneName: intrusion.zoneName || intrusion.zoneId,
    level: intrusion.level,
    intruderId: ref.intruderId,
    intruderName: ref.intruderName,
    durationMs:
      kind === 'exit' && enteredAt !== null
        ? Math.max(0, at - enteredAt)
        : null,
  };
}
