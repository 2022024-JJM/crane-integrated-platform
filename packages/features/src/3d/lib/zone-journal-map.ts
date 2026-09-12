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

/** 모델 id 가 속한 region — 여러 씬이 떠 있을 일은 없지만 전부 훑는다. */
export function findRegionOfModel(
  modelId: string,
  sceneInfoByRegion: Readonly<Record<string, SavedSceneInfo>>,
): string | null {
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
