// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  VIRTUAL_TAGS_MAX,
  type VirtualTagSet,
} from '@crane/domain/virtual-tag';
import {
  resetVirtualTagLoadState,
  useVirtualTagStore,
} from '../use-virtual-tag-store';
import { virtualTagRuntime } from '../virtual-tag-runner';
import { setTagIngest, tagLiveValues } from '../tag-value-bus';

/**
 * 영속화 어댑터(virtual-tag-storage)는 도메인에서 따로 테스트한다 — 여기서는
 * mock 으로 "무엇을 넘기고 결과를 어떻게 반영하는가" 만 본다.
 */
const storage = vi.hoisted(() => ({
  load: vi.fn<() => Promise<VirtualTagSet>>(),
  save: vi.fn<(set: VirtualTagSet) => Promise<VirtualTagSet>>(),
}));

vi.mock('@crane/domain/virtual-tag', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@crane/domain/virtual-tag')>();
  return {
    ...actual,
    loadVirtualTagSet: storage.load,
    saveVirtualTagSet: storage.save,
  };
});

const received = new Map<string, number[]>();
const EMPTY: VirtualTagSet = { version: 1, tickMs: 100, tags: [] };

function reset() {
  useVirtualTagStore.getState().pause();
  useVirtualTagStore.setState({
    tags: [],
    tickMs: 100,
    savedSnapshot: JSON.stringify(EMPTY),
    hydrated: false,
    isSaving: false,
    isRunning: false,
  });
  resetVirtualTagLoadState();
  virtualTagRuntime.syncDefinitions([]);
  // 러너는 싱글턴이라 누적 재생 시간(elapsed)이 테스트 사이에 남는다.
  virtualTagRuntime.resetValues();
  received.clear();
  tagLiveValues.clear();
  storage.load.mockReset();
  storage.save.mockReset();
  storage.load.mockResolvedValue(EMPTY);
  storage.save.mockImplementation((set) => Promise.resolve(set));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  reset();
  setTagIngest((key, value) => {
    const list = received.get(key) ?? [];
    list.push(value);
    received.set(key, list);
  });
});

afterEach(() => {
  reset();
  setTagIngest(null);
  vi.useRealTimers();
});

const store = () => useVirtualTagStore.getState();

describe('load / save / isDirty', () => {
  it('load 는 한 번만 읽고 스냅샷을 잡는다 — 직후는 dirty 아님', async () => {
    const loaded: VirtualTagSet = {
      version: 1,
      tickMs: 250,
      tags: [
        {
          id: 'a',
          key: 'C_1:x',
          name: '',
          min: 0,
          max: 10,
          initial: 5,
          pattern: { kind: 'manual' },
          enabled: true,
        },
      ],
    };
    storage.load.mockResolvedValue(loaded);
    await Promise.all([store().load(), store().load()]);
    await store().load();
    expect(storage.load).toHaveBeenCalledTimes(1);
    expect(store().tags.map((t) => t.id)).toEqual(['a']);
    expect(store().tickMs).toBe(250);
    expect(store().isDirty()).toBe(false);
    expect(virtualTagRuntime.getValue('a')).toBe(5);
  });

  it('load 실패는 빈 세트로 시작하되 hydrated 를 세운다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    storage.load.mockRejectedValue(new Error('404'));
    await store().load();
    expect(store().hydrated).toBe(true);
    expect(store().tags).toEqual([]);
  });

  it('편집은 저장하지 않고 dirty 만 세운다. save 가 스냅샷을 갱신한다', async () => {
    await store().load();
    store().addTag({ key: 'a' });
    expect(storage.save).not.toHaveBeenCalled();
    expect(store().isDirty()).toBe(true);
    expect(await store().save()).toBe(true);
    expect(storage.save).toHaveBeenCalledWith(
      expect.objectContaining({ version: 1, tickMs: 100 }),
    );
    expect(store().isDirty()).toBe(false);
    store().setTickMs(200);
    expect(store().isDirty()).toBe(true);
  });

  it('save 응답(정규화된 세트)을 상태에 반영한다', async () => {
    store().addTag({ key: 'a' });
    storage.save.mockImplementation((set) =>
      Promise.resolve({ ...set, tickMs: 16 }),
    );
    await store().save();
    expect(store().tickMs).toBe(16);
    expect(store().isDirty()).toBe(false);
  });

  it('save 실패는 false 이고 메모리 상태·dirty 를 유지한다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    store().addTag({ key: 'a' });
    storage.save.mockRejectedValue(new Error('500'));
    expect(await store().save()).toBe(false);
    expect(store().tags).toHaveLength(1);
    expect(store().isDirty()).toBe(true);
    expect(store().isSaving).toBe(false);
  });
});

describe('addTag / updateTag / removeTag / duplicateTag', () => {
  it('추가하면 저장되고, 빈 키·중복 키·상한 초과는 거부한다', () => {
    const ok = store().addTag({ key: ' C_1:x ', min: 0, max: 10 });
    expect(ok.ok).toBe(true);
    expect(store().tags[0]).toMatchObject({
      key: 'C_1:x',
      min: 0,
      max: 10,
      enabled: true,
    });
    expect(store().tags[0].pattern.kind).toBe('triangle');

    expect(store().addTag({ key: '  ' })).toEqual({
      ok: false,
      reason: 'invalid-key',
    });
    expect(store().addTag({ key: 'C_1:x' })).toEqual({
      ok: false,
      reason: 'duplicate-key',
    });
    expect(store().tags).toHaveLength(1);
  });

  it('상한: 정확히 MAX 개까지, +1 은 limit 으로 거부', () => {
    for (let i = 0; i < VIRTUAL_TAGS_MAX; i++) {
      expect(store().addTag({ key: `k${i}` }).ok).toBe(true);
    }
    expect(store().addTag({ key: 'one-more' })).toEqual({
      ok: false,
      reason: 'limit',
    });
    expect(store().tags).toHaveLength(VIRTUAL_TAGS_MAX);
  });

  it('updateTag: 키 중복이면 false 이고 다른 필드도 적용하지 않는다', () => {
    const a = store().addTag({ key: 'a' });
    store().addTag({ key: 'b' });
    if (!a.ok) throw new Error('add failed');
    const before = store().tags;
    expect(store().updateTag(a.id, { key: 'b', name: 'renamed' })).toBe(false);
    expect(store().tags).toBe(before);
    expect(
      store().updateTag(a.id, { key: 'a', name: 'renamed', max: 50 }),
    ).toBe(true);
    expect(store().tags[0]).toMatchObject({
      key: 'a',
      name: 'renamed',
      max: 50,
    });
    expect(store().updateTag('missing', { name: 'x' })).toBe(false);
  });

  it('updateTag: 범위를 줄이면 런타임 값이 새 범위로 다시 잡힌다', () => {
    const a = store().addTag({
      key: 'a',
      min: 0,
      max: 100,
      initial: 80,
      pattern: { kind: 'manual' },
    });
    if (!a.ok) throw new Error('add failed');
    expect(virtualTagRuntime.getValue(a.id)).toBe(80);
    store().updateTag(a.id, { max: 50 });
    expect(virtualTagRuntime.getValue(a.id)).toBe(50);
  });

  it('removeTag: 없는 id 는 상태 참조 유지, 있으면 런타임에서도 사라진다', () => {
    const a = store().addTag({ key: 'a' });
    if (!a.ok) throw new Error('add failed');
    const before = store().tags;
    store().removeTag('missing');
    expect(store().tags).toBe(before);
    store().removeTag(a.id);
    expect(store().tags).toEqual([]);
    expect(virtualTagRuntime.getValue(a.id)).toBeUndefined();
  });

  it('duplicateTag 는 키에 접미사를 붙여 복제한다', () => {
    const a = store().addTag({ key: 'a', name: 'A', min: 1, max: 9 });
    if (!a.ok) throw new Error('add failed');
    const dup = store().duplicateTag(a.id);
    expect(dup.ok).toBe(true);
    expect(store().tags[1]).toMatchObject({
      key: 'a_2',
      name: 'A',
      min: 1,
      max: 9,
    });
    store().duplicateTag(a.id);
    expect(store().tags[2].key).toBe('a_3');
    expect(store().duplicateTag('missing').ok).toBe(false);
  });

  it('setTickMs 는 클램프하고 같은 값이면 상태 참조를 유지한다', () => {
    store().setTickMs(5);
    expect(store().tickMs).toBe(16);
    const before = useVirtualTagStore.getState();
    store().setTickMs(16);
    expect(useVirtualTagStore.getState()).toBe(before);
  });
});

describe('재생(runner)', () => {
  it('start 시 현재값을 즉시 내보내고, 틱마다 파형을 진행한다', () => {
    store().addTag({
      key: 'tri',
      min: 0,
      max: 100,
      initial: 0,
      pattern: { kind: 'triangle', periodMs: 1000 },
    });
    store().addTag({ key: 'off', enabled: false });
    store().start();
    expect(store().isRunning).toBe(true);
    expect(received.get('tri')).toEqual([0]);
    expect(received.has('off')).toBe(false);

    vi.advanceTimersByTime(250);
    const values = received.get('tri') ?? [];
    expect(values.length).toBe(1 + 2);
    expect(values[values.length - 1]).toBeCloseTo(40, 6);
    expect(tagLiveValues.get('tri')?.value).toBeCloseTo(40, 6);
  });

  it('pause 후에는 틱이 멈추고, 재개하면 위상이 이어진다', () => {
    store().addTag({
      key: 'saw',
      min: 0,
      max: 100,
      pattern: { kind: 'sawtooth', periodMs: 1000 },
    });
    store().start();
    vi.advanceTimersByTime(300);
    store().pause();
    expect(store().isRunning).toBe(false);
    const countAtPause = received.get('saw')?.length ?? 0;
    vi.advanceTimersByTime(1000);
    expect(received.get('saw')?.length).toBe(countAtPause);

    store().start();
    vi.advanceTimersByTime(100);
    const values = received.get('saw') ?? [];
    // 재개 직후 publishAll(30) → 다음 틱 40: 멈춘 동안의 시간은 흐르지 않는다.
    expect(values[values.length - 1]).toBeCloseTo(40, 6);
  });

  it('start 는 멱등이고, 정의가 바뀌면 다음 틱부터 반영된다', () => {
    const a = store().addTag({
      key: 'a',
      min: 0,
      max: 10,
      pattern: { kind: 'manual' },
      initial: 3,
    });
    if (!a.ok) throw new Error('add failed');
    store().start();
    store().start();
    vi.advanceTimersByTime(100);
    expect(received.get('a')).toEqual([3, 3]);
    store().updateTag(a.id, { key: 'renamed' });
    vi.advanceTimersByTime(100);
    expect(received.get('renamed')).toEqual([3]);
  });

  it('manual 값 설정은 재생 중이 아니어도 즉시 내보내고 클램프한다', () => {
    const a = store().addTag({
      key: 'a',
      min: 0,
      max: 10,
      pattern: { kind: 'manual' },
    });
    if (!a.ok) throw new Error('add failed');
    virtualTagRuntime.setManualValue(a.id, 99);
    expect(received.get('a')).toEqual([10]);
    expect(virtualTagRuntime.getValueByKey('a')).toBe(10);
    virtualTagRuntime.setManualValue('missing', 1);
    expect(received.size).toBe(1);
  });

  it('resetValues 는 initial 로 되돌리고 파형 위상을 0 으로', () => {
    store().addTag({
      key: 'saw',
      min: 0,
      max: 100,
      pattern: { kind: 'sawtooth', periodMs: 1000 },
    });
    store().start();
    vi.advanceTimersByTime(500);
    virtualTagRuntime.resetValues();
    expect(virtualTagRuntime.getValueByKey('saw')).toBe(0);
    vi.advanceTimersByTime(100);
    expect(virtualTagRuntime.getValueByKey('saw')).toBeCloseTo(10, 6);
  });
});
