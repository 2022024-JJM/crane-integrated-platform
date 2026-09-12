import { beforeEach, describe, expect, it } from 'vitest';
import type { SavedModelInfo, SavedModelZone } from '@crane/domain/3d';
import type { ZoneTransition } from '../scene-zone-runtime';
import { useRealtimeStore } from '../use-realtime-store';
import { useSceneZoneStore } from '../use-scene-zone-store';
import { useVirtualTagStore } from '../use-virtual-tag-store';

function model(id: string, equipName = id.toUpperCase()): SavedModelInfo {
  return {
    id,
    equipName,
    path: '/m.glb',
    opacity: 1,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  };
}

const A = model('a');
const B = model('b');
const C = model('c');
const ZA: SavedModelZone = {
  id: 'za',
  name: '작업',
  color: '#38bdf8',
  radius: 5,
};
const ZC: SavedModelZone = { id: 'zc', name: '', color: '#fbbf24', radius: 3 };

function enter(intruder: SavedModelInfo, zone = ZA, owner = A): ZoneTransition {
  return {
    kind: 'enter',
    zoneKey: `${owner.id}#${zone.id}`,
    owner,
    zone,
    intruderKind: 'model',
    intruderId: intruder.id,
    intruder,
  };
}

function exit(intruder: SavedModelInfo, zone = ZA, owner = A): ZoneTransition {
  return { ...enter(intruder, zone, owner), kind: 'exit' };
}

function zoneEnter(kind: 'enter' | 'exit' = 'enter'): ZoneTransition {
  return {
    kind,
    zoneKey: 'a#za',
    owner: A,
    zone: ZA,
    intruderKind: 'zone',
    intruderId: 'c#zc',
    intruder: C,
    intruderZone: ZC,
  };
}

beforeEach(() => {
  useSceneZoneStore.setState({
    enabled: true,
    labelsVisible: true,
    intrusions: [],
    stopOnIntrusion: true,
    held: null,
    acknowledged: [],
  });
  // 정지 경로(holdRunners)가 만지는 러너 스토어 — 재생 중·보류 없음에서 시작.
  useVirtualTagStore.getState().start();
  useRealtimeStore.getState().start();
});

describe('useSceneZoneStore — 기본값·토글', () => {
  it('기본 ON, 목록 비어 있음', () => {
    const s = useSceneZoneStore.getState();
    expect(s.enabled).toBe(true);
    expect(s.intrusions).toEqual([]);
  });

  it('setEnabled(false) 는 현재 침범을 비운다', () => {
    const s = useSceneZoneStore.getState();
    s.applyTransitions([enter(B)]);
    expect(useSceneZoneStore.getState().intrusions).toHaveLength(1);
    s.setEnabled(false);
    expect(useSceneZoneStore.getState().intrusions).toEqual([]);
    expect(useSceneZoneStore.getState().enabled).toBe(false);
  });

  it('같은 값으로 setEnabled 하면 상태 참조가 유지된다', () => {
    const before = useSceneZoneStore.getState();
    before.setEnabled(true);
    expect(useSceneZoneStore.getState()).toBe(before);
  });

  it('labelsVisible 기본 ON, 토글해도 감지·침범 목록은 건드리지 않는다', () => {
    const s = useSceneZoneStore.getState();
    expect(s.labelsVisible).toBe(true);
    s.applyTransitions([enter(B)]);
    s.setLabelsVisible(false);
    const after = useSceneZoneStore.getState();
    expect(after.labelsVisible).toBe(false);
    expect(after.enabled).toBe(true);
    expect(after.intrusions).toHaveLength(1);
  });

  it('같은 값으로 setLabelsVisible 하면 상태 참조가 유지된다', () => {
    const before = useSceneZoneStore.getState();
    before.setLabelsVisible(true);
    expect(useSceneZoneStore.getState()).toBe(before);
  });

  it('감지를 꺼도 labelsVisible 은 그대로다(독립 설정)', () => {
    const s = useSceneZoneStore.getState();
    s.setLabelsVisible(false);
    s.setEnabled(false);
    expect(useSceneZoneStore.getState().labelsVisible).toBe(false);
  });

  it('toggle 은 enabled 를 뒤집는다', () => {
    useSceneZoneStore.getState().toggle();
    expect(useSceneZoneStore.getState().enabled).toBe(false);
    useSceneZoneStore.getState().toggle();
    expect(useSceneZoneStore.getState().enabled).toBe(true);
  });
});

describe('useSceneZoneStore — applyTransitions', () => {
  it('빈 배열은 set 하지 않는다(참조 유지)', () => {
    const before = useSceneZoneStore.getState();
    before.applyTransitions([]);
    expect(useSceneZoneStore.getState()).toBe(before);
  });

  it('enter 는 영역 항목을 만들고 둘째 침범자는 덧붙인다', () => {
    const s = useSceneZoneStore.getState();
    s.applyTransitions([enter(B)]);
    s.applyTransitions([enter(C)]);
    const [intrusion] = useSceneZoneStore.getState().intrusions;
    expect(intrusion).toMatchObject({
      zoneKey: 'a#za',
      ownerId: 'a',
      ownerName: 'A',
      zoneId: 'za',
      zoneName: '작업',
      color: '#38bdf8',
    });
    expect(intrusion.intruders.map((i) => i.id)).toEqual(['b', 'c']);
    expect(intrusion.intruders[0]).toEqual({
      kind: 'model',
      id: 'b',
      name: 'B',
    });
  });

  it('같은 침범자의 enter 가 거듭 와도 중복되지 않는다(참조 유지)', () => {
    useSceneZoneStore.getState().applyTransitions([enter(B)]);
    const before = useSceneZoneStore.getState();
    before.applyTransitions([enter(B)]);
    expect(useSceneZoneStore.getState()).toBe(before);
  });

  it('exit 는 침범자를 빼고 마지막 이탈이면 영역 항목을 없앤다', () => {
    const s = useSceneZoneStore.getState();
    s.applyTransitions([enter(B), enter(C)]);
    s.applyTransitions([exit(B)]);
    expect(
      useSceneZoneStore.getState().intrusions[0].intruders.map((i) => i.id),
    ).toEqual(['c']);
    s.applyTransitions([exit(C)]);
    expect(useSceneZoneStore.getState().intrusions).toEqual([]);
  });

  it('없는 침범자의 exit 는 no-op(참조 유지)', () => {
    useSceneZoneStore.getState().applyTransitions([enter(B)]);
    const before = useSceneZoneStore.getState();
    before.applyTransitions([exit(C)]);
    expect(useSceneZoneStore.getState()).toBe(before);
  });

  it('영역↔영역 enter 는 양쪽 항목에 거울상으로 들어간다', () => {
    useSceneZoneStore.getState().applyTransitions([zoneEnter()]);
    const { intrusions } = useSceneZoneStore.getState();
    expect(intrusions.map((i) => i.zoneKey)).toEqual(['a#za', 'c#zc']);
    expect(intrusions[0].intruders[0]).toEqual({
      kind: 'zone',
      id: 'c#zc',
      name: 'C · zc',
    });
    expect(intrusions[1].intruders[0]).toEqual({
      kind: 'zone',
      id: 'a#za',
      name: 'A · 작업',
    });
    expect(intrusions[1].zoneName).toBe('');

    useSceneZoneStore.getState().applyTransitions([zoneEnter('exit')]);
    expect(useSceneZoneStore.getState().intrusions).toEqual([]);
  });

  it('항목은 zoneKey 순으로 정렬돼 안정적이다', () => {
    useSceneZoneStore.getState().applyTransitions([enter(B, ZC, C), enter(B)]);
    expect(
      useSceneZoneStore.getState().intrusions.map((i) => i.zoneKey),
    ).toEqual(['a#za', 'c#zc']);
  });
});

describe('useSceneZoneStore — clear', () => {
  it('clear(검출기 언마운트)는 목록을 비우고, 비어 있으면 no-op(참조 유지)', () => {
    const s = useSceneZoneStore.getState();
    s.applyTransitions([enter(B)]);
    s.clear();
    expect(useSceneZoneStore.getState().intrusions).toEqual([]);
    const before = useSceneZoneStore.getState();
    before.clear();
    expect(useSceneZoneStore.getState()).toBe(before);
  });
});

describe('정지 등급(level)·hold', () => {
  const ZS: SavedModelZone = {
    id: 'zs',
    name: '정지',
    color: '#ef4444',
    radius: 4,
    level: 'stop',
  };
  const stopEnter = (intruder = B): ZoneTransition => enter(intruder, ZS, A);
  const stopExit = (intruder = B): ZoneTransition => exit(intruder, ZS, A);

  it("'warn' 영역 진입은 정지하지 않는다", () => {
    useSceneZoneStore.getState().applyTransitions([enter(B)]);
    expect(useSceneZoneStore.getState().held).toBeNull();
    expect(useSceneZoneStore.getState().intrusions[0].level).toBe('warn');
    expect(useVirtualTagStore.getState().isRunning).toBe(true);
  });

  it("'stop' 영역 진입은 러너를 멈추고 held 를 기록한다", () => {
    useSceneZoneStore.getState().applyTransitions([stopEnter()]);
    const state = useSceneZoneStore.getState();
    expect(state.held).toMatchObject({ zoneKey: 'a#zs', intruderId: 'b' });
    expect(state.intrusions[0].level).toBe('stop');
    expect(useVirtualTagStore.getState().isRunning).toBe(false);
    expect(useRealtimeStore.getState().held).toBe(true);
  });

  it('stopOnIntrusion 이 꺼져 있으면 멈추지 않는다', () => {
    useSceneZoneStore.getState().setStopOnIntrusion(false);
    useSceneZoneStore.getState().applyTransitions([stopEnter()]);
    expect(useSceneZoneStore.getState().held).toBeNull();
    expect(useVirtualTagStore.getState().isRunning).toBe(true);
  });

  it('resume 은 보류를 풀고 그 쌍을 승인 — 이탈 전 재진입은 다시 멈추지 않고, 이탈 뒤엔 다시 멈춘다', () => {
    const store = useSceneZoneStore;
    store.getState().applyTransitions([stopEnter()]);
    store.getState().resume();
    expect(store.getState().held).toBeNull();
    expect(useRealtimeStore.getState().held).toBe(false);
    expect(store.getState().acknowledged).toEqual(['a#zs|b']);
    // 침범 상태 자체는 그대로.
    expect(store.getState().intrusions).toHaveLength(1);
    // 다른 침범자(C)는 새 쌍이라 다시 멈춘다.
    useVirtualTagStore.getState().start();
    store.getState().applyTransitions([stopEnter(C)]);
    expect(store.getState().held?.intruderId).toBe('c');
    store.getState().resume();
    // B 이탈 → 승인 해제 → B 재진입 시 다시 멈춘다.
    store.getState().applyTransitions([stopExit()]);
    expect(store.getState().acknowledged).toEqual(['a#zs|c']);
    useVirtualTagStore.getState().start();
    store.getState().applyTransitions([stopEnter()]);
    expect(store.getState().held?.intruderId).toBe('b');
  });

  it('resume 은 정지 중이 아니면 no-op(참조 유지)', () => {
    const before = useSceneZoneStore.getState();
    useSceneZoneStore.getState().resume();
    expect(useSceneZoneStore.getState()).toBe(before);
  });

  it('정지시킨 쌍이 이탈하면 정지도 풀린다', () => {
    useSceneZoneStore.getState().applyTransitions([stopEnter()]);
    useSceneZoneStore.getState().applyTransitions([stopExit()]);
    expect(useSceneZoneStore.getState().held).toBeNull();
    expect(useRealtimeStore.getState().held).toBe(false);
  });

  it('감지 off·clear·stopOnIntrusion off 는 정지를 풀고 승인을 비운다', () => {
    const store = useSceneZoneStore;
    store.getState().applyTransitions([stopEnter()]);
    store.getState().setEnabled(false);
    expect(store.getState().held).toBeNull();
    expect(store.getState().acknowledged).toEqual([]);
    expect(useRealtimeStore.getState().held).toBe(false);

    store.getState().setEnabled(true);
    store.getState().applyTransitions([stopEnter()]);
    store.getState().clear();
    expect(store.getState().held).toBeNull();
    expect(useRealtimeStore.getState().held).toBe(false);

    store.getState().applyTransitions([stopEnter()]);
    store.getState().setStopOnIntrusion(false);
    expect(store.getState().held).toBeNull();
    expect(useRealtimeStore.getState().held).toBe(false);
  });

  it('영역↔영역은 한쪽만 stop 이어도 stop 이다', () => {
    const stopZoneEnter: ZoneTransition = {
      ...zoneEnter('enter'),
      intruderZone: { ...ZC, level: 'stop' },
    };
    useSceneZoneStore.getState().applyTransitions([stopZoneEnter]);
    const state = useSceneZoneStore.getState();
    expect(state.intrusions.every((i) => i.level === 'stop')).toBe(true);
    expect(state.held).not.toBeNull();
  });
});
