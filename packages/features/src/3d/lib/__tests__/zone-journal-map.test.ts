import { describe, expect, it } from 'vitest';
import type { SavedSceneInfo } from '@crane/domain/3d';
import type { ZoneIntrusion } from '../../model/use-scene-zone-store';
import {
  diffZoneIntrusions,
  filterAcceptedZoneTransitions,
  findRegionOfModel,
  pairKeyOf,
  toZoneJournalEntry,
} from '../zone-journal-map';

function intrusion(
  zoneKey: string,
  intruders: string[],
  level: 'warn' | 'stop' = 'warn',
): ZoneIntrusion {
  const [ownerId, zoneId] = zoneKey.split('#');
  return {
    zoneKey,
    ownerId,
    ownerName: ownerId.toUpperCase(),
    zoneId,
    zoneName: '',
    color: '#38bdf8',
    level,
    at: 10,
    intruders: intruders.map((id) => ({ kind: 'model', id, name: id })),
  };
}

describe('diffZoneIntrusions', () => {
  it('새 쌍은 entered, 사라진 쌍은 exited, 유지는 무시', () => {
    const prev = [intrusion('a#z', ['b'])];
    const next = [intrusion('a#z', ['b', 'c']), intrusion('d#z', ['e'])];
    const { entered, exited } = diffZoneIntrusions(prev, next);
    expect(
      entered.map((r) => pairKeyOf(r.intrusion.zoneKey, r.intruderId)),
    ).toEqual(['a#z|c', 'd#z|e']);
    expect(exited).toEqual([]);
    const back = diffZoneIntrusions(next, prev);
    expect(back.entered).toEqual([]);
    expect(back.exited.map((r) => r.intruderId)).toEqual(['c', 'e']);
  });

  it('빈 스냅샷끼리는 아무것도 없다', () => {
    expect(diffZoneIntrusions([], [])).toEqual({ entered: [], exited: [] });
  });
});

describe('toZoneJournalEntry', () => {
  const ref = {
    intrusion: intrusion('a#z', ['b'], 'stop'),
    intruderId: 'b',
    intruderName: 'B',
  };

  it('진입은 durationMs null, 이탈은 진입 시각과의 차(음수 방지)', () => {
    const enter = toZoneJournalEntry(ref, 'enter', 100, 'dock-1', null);
    expect(enter).toMatchObject({
      key: '100:enter:a#z|b',
      kind: 'enter',
      level: 'stop',
      zoneName: 'z',
      durationMs: null,
      regionId: 'dock-1',
    });
    expect(toZoneJournalEntry(ref, 'exit', 400, null, 100).durationMs).toBe(
      300,
    );
    expect(
      toZoneJournalEntry(ref, 'exit', 400, null, null).durationMs,
    ).toBeNull();
    expect(toZoneJournalEntry(ref, 'exit', 50, null, 100).durationMs).toBe(0);
  });
});

describe('findRegionOfModel', () => {
  it('모델이 든 region 을 찾고 없으면 null', () => {
    const scenes = {
      'dock-1': { maps: [], models: [{ id: 'm1' }] },
      'dock-2': { maps: [], models: [{ id: 'm2' }] },
    } as unknown as Record<string, SavedSceneInfo>;
    expect(findRegionOfModel('m2', scenes)).toBe('dock-2');
    expect(findRegionOfModel('m9', scenes)).toBeNull();
    expect(findRegionOfModel('m1', {})).toBeNull();
  });
});

describe('filterAcceptedZoneTransitions', () => {
  const entered = diffZoneIntrusions([], [intrusion('a#z', ['b'])]).entered;
  const exited = diffZoneIntrusions([intrusion('a#z', ['b'])], []).exited;

  it('실시간이 아니면 진입을 버리고, 승인 없는 이탈도 버린다(3D 플레이·에디터)', () => {
    const out = filterAcceptedZoneTransitions(
      entered,
      exited,
      () => false,
      false,
    );
    expect(out.entered).toEqual([]);
    expect(out.exited).toEqual([]);
  });

  it('실시간이면 진입을 받고, 승인된 쌍의 이탈은 화면 상태와 무관하게 받는다', () => {
    const accepted = new Set<string>();
    const first = filterAcceptedZoneTransitions(
      entered,
      [],
      (key) => accepted.has(key),
      true,
    );
    expect(first.entered).toHaveLength(1);
    for (const ref of first.entered) {
      accepted.add(pairKeyOf(ref.intrusion.zoneKey, ref.intruderId));
    }
    // 화면을 떠나 activeMode 가 null 이 된 뒤 오는 이탈.
    const leave = filterAcceptedZoneTransitions(
      [],
      exited,
      (key) => accepted.has(key),
      false,
    );
    expect(leave.exited).toHaveLength(1);
  });

  it('진입을 못 본 이탈(새로고침 뒤)은 실시간이어도 버린다', () => {
    const out = filterAcceptedZoneTransitions([], exited, () => false, true);
    expect(out.exited).toEqual([]);
  });

  it('입력 배열을 바꾸지 않고 새 배열을 돌려준다', () => {
    const out = filterAcceptedZoneTransitions(
      entered,
      exited,
      () => true,
      true,
    );
    expect(out.entered).not.toBe(entered);
    expect(out.entered).toEqual(entered);
    expect(out.exited).toEqual(exited);
  });
});
