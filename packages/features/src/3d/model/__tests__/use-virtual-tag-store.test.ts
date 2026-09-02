// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VIRTUAL_TAGS_MAX } from '@crane/domain/virtual-tag';
import {
  useVirtualTagStore,
  VIRTUAL_TAGS_STORAGE_KEY,
} from '../use-virtual-tag-store';
import { virtualTagRuntime } from '../virtual-tag-runner';
import { setTagIngest, tagLiveValues } from '../tag-value-bus';

const received = new Map<string, number[]>();

function reset() {
  useVirtualTagStore.getState().pause();
  useVirtualTagStore.setState({
    tags: [],
    tickMs: 100,
    hydrated: false,
    isRunning: false,
  });
  virtualTagRuntime.syncDefinitions([]);
  // 러너는 싱글턴이라 누적 재생 시간(elapsed)이 테스트 사이에 남는다.
  virtualTagRuntime.resetValues();
  received.clear();
  tagLiveValues.clear();
  window.localStorage.clear();
}

function stored(): unknown {
  const raw = window.localStorage.getItem(VIRTUAL_TAGS_STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
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

describe('hydrate', () => {
  it('저장소가 비면 빈 목록, 두 번 불러도 한 번만 읽는다', () => {
    store().hydrate();
    expect(store().tags).toEqual([]);
    expect(store().hydrated).toBe(true);
    window.localStorage.setItem(
      VIRTUAL_TAGS_STORAGE_KEY,
      JSON.stringify({ version: 1, tickMs: 50, tags: [] }),
    );
    store().hydrate();
    expect(store().tickMs).toBe(100);
  });

  it('손상 JSON·손상 항목은 조용히 버리고 유효 항목만 읽는다', () => {
    window.localStorage.setItem(VIRTUAL_TAGS_STORAGE_KEY, '{not json');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    store().hydrate();
    expect(store().tags).toEqual([]);

    useVirtualTagStore.setState({ hydrated: false });
    window.localStorage.setItem(
      VIRTUAL_TAGS_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        tickMs: 250,
        tags: [
          { id: 'a', key: 'C_1:x', min: 0, max: 10, initial: 5, pattern: { kind: 'manual' }, enabled: true },
          { id: 'b', key: '', min: 0, max: 10 },
          'garbage',
        ],
      }),
    );
    store().hydrate();
    expect(store().tags.map((t) => t.id)).toEqual(['a']);
    expect(store().tickMs).toBe(250);
    expect(virtualTagRuntime.getValue('a')).toBe(5);
  });
});

describe('addTag / updateTag / removeTag / duplicateTag', () => {
  it('추가하면 저장되고, 빈 키·중복 키·상한 초과는 거부한다', () => {
    const ok = store().addTag({ key: ' C_1:x ', min: 0, max: 10 });
    expect(ok.ok).toBe(true);
    expect(store().tags[0]).toMatchObject({ key: 'C_1:x', min: 0, max: 10, enabled: true });
    expect(store().tags[0].pattern.kind).toBe('triangle');
    expect((stored() as { tags: unknown[] }).tags).toHaveLength(1);

    expect(store().addTag({ key: '  ' })).toEqual({ ok: false, reason: 'invalid-key' });
    expect(store().addTag({ key: 'C_1:x' })).toEqual({ ok: false, reason: 'duplicate-key' });
    expect(store().tags).toHaveLength(1);
  });

  it('상한: 정확히 MAX 개까지, +1 은 limit 으로 거부', () => {
    for (let i = 0; i < VIRTUAL_TAGS_MAX; i++) {
      expect(store().addTag({ key: `k${i}` }).ok).toBe(true);
    }
    expect(store().addTag({ key: 'one-more' })).toEqual({ ok: false, reason: 'limit' });
    expect(store().tags).toHaveLength(VIRTUAL_TAGS_MAX);
  });

  it('updateTag: 키 중복이면 false 이고 다른 필드도 적용하지 않는다', () => {
    const a = store().addTag({ key: 'a' });
    store().addTag({ key: 'b' });
    if (!a.ok) throw new Error('add failed');
    const before = store().tags;
    expect(store().updateTag(a.id, { key: 'b', name: 'renamed' })).toBe(false);
    expect(store().tags).toBe(before);
    expect(store().updateTag(a.id, { key: 'a', name: 'renamed', max: 50 })).toBe(true);
    expect(store().tags[0]).toMatchObject({ key: 'a', name: 'renamed', max: 50 });
    expect(store().updateTag('missing', { name: 'x' })).toBe(false);
  });

  it('updateTag: 범위를 줄이면 런타임 값이 새 범위로 다시 잡힌다', () => {
    const a = store().addTag({ key: 'a', min: 0, max: 100, initial: 80, pattern: { kind: 'manual' } });
    if (!a.ok) throw new Error('add failed');
    expect(virtualTagRuntime.getValue(a.id)).toBe(80);
    store().updateTag(a.id, { max: 50 });
    expect(virtualTagRuntime.getValue(a.id)).toBe(50);
  });

  it('removeTag: 없는 id 는 상태 참조 유지, 있으면 저장소·런타임에서도 사라진다', () => {
    const a = store().addTag({ key: 'a' });
    if (!a.ok) throw new Error('add failed');
    const before = store().tags;
    store().removeTag('missing');
    expect(store().tags).toBe(before);
    store().removeTag(a.id);
    expect(store().tags).toEqual([]);
    expect((stored() as { tags: unknown[] }).tags).toEqual([]);
    expect(virtualTagRuntime.getValue(a.id)).toBeUndefined();
  });

  it('duplicateTag 는 키에 접미사를 붙여 복제한다', () => {
    const a = store().addTag({ key: 'a', name: 'A', min: 1, max: 9 });
    if (!a.ok) throw new Error('add failed');
    const dup = store().duplicateTag(a.id);
    expect(dup.ok).toBe(true);
    expect(store().tags[1]).toMatchObject({ key: 'a_2', name: 'A', min: 1, max: 9 });
    store().duplicateTag(a.id);
    expect(store().tags[2].key).toBe('a_3');
    expect(store().duplicateTag('missing').ok).toBe(false);
  });

  it('setTickMs 는 클램프하고 같은 값이면 저장하지 않는다', () => {
    store().setTickMs(5);
    expect(store().tickMs).toBe(16);
    window.localStorage.clear();
    store().setTickMs(16);
    expect(stored()).toBeNull();
  });

  it('replaceAll / toExport 왕복', () => {
    store().addTag({ key: 'a' });
    const exported = store().toExport();
    reset();
    store().replaceAll(exported);
    expect(store().tags.map((t) => t.key)).toEqual(['a']);
    store().replaceAll('garbage');
    expect(store().tags).toEqual([]);
  });
});

describe('재생(runner)', () => {
  it('start 시 현재값을 즉시 내보내고, 틱마다 파형을 진행한다', () => {
    store().addTag({ key: 'tri', min: 0, max: 100, initial: 0, pattern: { kind: 'triangle', periodMs: 1000 } });
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
    store().addTag({ key: 'saw', min: 0, max: 100, pattern: { kind: 'sawtooth', periodMs: 1000 } });
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
    const a = store().addTag({ key: 'a', min: 0, max: 10, pattern: { kind: 'manual' }, initial: 3 });
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
    const a = store().addTag({ key: 'a', min: 0, max: 10, pattern: { kind: 'manual' } });
    if (!a.ok) throw new Error('add failed');
    virtualTagRuntime.setManualValue(a.id, 99);
    expect(received.get('a')).toEqual([10]);
    expect(virtualTagRuntime.getValueByKey('a')).toBe(10);
    virtualTagRuntime.setManualValue('missing', 1);
    expect(received.size).toBe(1);
  });

  it('resetValues 는 initial 로 되돌리고 파형 위상을 0 으로', () => {
    store().addTag({ key: 'saw', min: 0, max: 100, pattern: { kind: 'sawtooth', periodMs: 1000 } });
    store().start();
    vi.advanceTimersByTime(500);
    virtualTagRuntime.resetValues();
    expect(virtualTagRuntime.getValueByKey('saw')).toBe(0);
    vi.advanceTimersByTime(100);
    expect(virtualTagRuntime.getValueByKey('saw')).toBeCloseTo(10, 6);
  });
});
