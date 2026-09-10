import { describe, expect, it } from 'vitest';
import type { VirtualTagDefinition } from '@crane/domain/virtual-tag';
import type { TagBindingTarget } from '../../model/rig-value-store';
import type { TagMappingIndex } from '../tag-mapping-index';
import {
  buildPredictedAddressValues,
  sampleFutureTagValues,
} from '../tag-prediction';

function tag(patch: Partial<VirtualTagDefinition> = {}): VirtualTagDefinition {
  return {
    id: patch.id ?? 'tag-1',
    key: patch.key ?? 'GC_01:gantry',
    name: patch.name ?? '',
    min: patch.min ?? 0,
    max: patch.max ?? 100,
    initial: patch.initial ?? 0,
    pattern: patch.pattern ?? { kind: 'sine', periodMs: 40_000 },
    enabled: patch.enabled ?? true,
  };
}

const noCurrent = () => undefined;

describe('sampleFutureTagValues', () => {
  it('sine — initial 위상에서 시작해 지정 시각의 값을 낸다', () => {
    const def = tag({
      min: 0,
      max: 100,
      initial: 0,
      pattern: { kind: 'sine', periodMs: 40_000 },
    });
    // 0.5 - 0.5cos(2π t/T) 이므로 t=T/2 에서 최대.
    expect(
      sampleFutureTagValues([def], 20_000, noCurrent).get(def.key),
    ).toBeCloseTo(100, 6);
    expect(sampleFutureTagValues([def], 0, noCurrent).get(def.key)).toBeCloseTo(
      0,
      6,
    );
  });

  it('triangle·sawtooth 도 시각만으로 결정된다', () => {
    const tri = tag({
      id: 't',
      key: 'k:tri',
      pattern: { kind: 'triangle', periodMs: 1000 },
    });
    const saw = tag({
      id: 's',
      key: 'k:saw',
      pattern: { kind: 'sawtooth', periodMs: 1000 },
    });
    const values = sampleFutureTagValues([tri, saw], 500, noCurrent);
    expect(values.get('k:tri')).toBeCloseTo(100, 6);
    expect(values.get('k:saw')).toBeCloseTo(50, 6);
  });

  it('square — duty 경계 정확값은 max, 넘으면 min', () => {
    const def = tag({
      pattern: { kind: 'square', periodMs: 1000, dutyPct: 50 },
    });
    // t/period < duty 가 max 조건이므로 경계 정확값(0.5)은 이미 min 이다.
    expect(sampleFutureTagValues([def], 499, noCurrent).get(def.key)).toBe(100);
    expect(sampleFutureTagValues([def], 500, noCurrent).get(def.key)).toBe(0);
  });

  it('manual 은 현재값을 그대로 유지한다 — 저절로 움직이지 않는다', () => {
    const def = tag({ pattern: { kind: 'manual' }, initial: 10 });
    const current = () => 42;
    expect(sampleFutureTagValues([def], 9_999_999, current).get(def.key)).toBe(
      42,
    );
    // 현재값을 모르면 initial 로 떨어진다.
    expect(
      sampleFutureTagValues([def], 9_999_999, noCurrent).get(def.key),
    ).toBe(10);
  });

  it('manual 의 현재값이 범위 밖이면 클램프한다', () => {
    const def = tag({ pattern: { kind: 'manual' }, min: 0, max: 100 });
    expect(sampleFutureTagValues([def], 1000, () => 500).get(def.key)).toBe(
      100,
    );
    expect(sampleFutureTagValues([def], 1000, () => -500).get(def.key)).toBe(0);
  });

  it('enabled:false 태그는 제외한다', () => {
    const on = tag({ id: 'a', key: 'k:on' });
    const off = tag({ id: 'b', key: 'k:off', enabled: false });
    const values = sampleFutureTagValues([on, off], 1000, noCurrent);
    expect(values.has('k:on')).toBe(true);
    expect(values.has('k:off')).toBe(false);
  });

  it('음수·NaN·Infinity 시각은 0 으로 본다', () => {
    const def = tag({
      pattern: { kind: 'sine', periodMs: 40_000 },
      initial: 0,
    });
    const at0 = sampleFutureTagValues([def], 0, noCurrent).get(def.key);
    for (const bad of [-1000, Number.NaN, Number.POSITIVE_INFINITY]) {
      // Infinity 는 유한하지 않으므로 0 취급 — 파형이 튀지 않는다.
      expect(sampleFutureTagValues([def], bad, noCurrent).get(def.key)).toBe(
        at0,
      );
    }
  });

  it('빈 태그 목록은 빈 맵이고, out 을 주면 그 참조를 비우고 재사용한다', () => {
    const out = new Map([['stale', 1]]);
    const result = sampleFutureTagValues([], 1000, noCurrent, out);
    expect(result).toBe(out);
    expect(out.size).toBe(0);
  });

  it('같은 키를 가진 정의가 둘이면 뒤에 오는 것이 이긴다', () => {
    const a = tag({
      id: 'a',
      key: 'dup',
      pattern: { kind: 'manual' },
      initial: 1,
    });
    const b = tag({
      id: 'b',
      key: 'dup',
      pattern: { kind: 'manual' },
      initial: 2,
    });
    expect(sampleFutureTagValues([a, b], 0, noCurrent).get('dup')).toBe(2);
  });
});

function indexOf(
  entries: Array<[string, TagBindingTarget[]]>,
): TagMappingIndex {
  return new Map(entries);
}

describe('buildPredictedAddressValues', () => {
  it('offset + value * scale 을 주소에 쓴다', () => {
    const index = indexOf([
      ['k:a', [{ address: 'm1/j1', scale: 0.1, offset: 71 }]],
    ]);
    const out = buildPredictedAddressValues(index, new Map([['k:a', 20]]));
    expect(out.get('m1/j1')).toBeCloseTo(73, 10);
  });

  it('한 태그가 여러 주소를 가리키면 전부 채운다', () => {
    const index = indexOf([
      [
        'k:a',
        [
          { address: 'm1/j1', scale: 1, offset: 0 },
          { address: 'm2/j1', scale: 2, offset: 5 },
        ],
      ],
    ]);
    const out = buildPredictedAddressValues(index, new Map([['k:a', 3]]));
    expect(out.get('m1/j1')).toBe(3);
    expect(out.get('m2/j1')).toBe(11);
  });

  it('값이 없는 태그 키는 건너뛴다 — 주소가 생기지 않는다', () => {
    const index = indexOf([
      ['k:missing', [{ address: 'm1/j1', scale: 1, offset: 0 }]],
    ]);
    expect(buildPredictedAddressValues(index, new Map()).size).toBe(0);
  });

  it('같은 주소를 두 태그가 가리키면 뒤에 오는 것이 이긴다', () => {
    const index = indexOf([
      ['k:a', [{ address: 'm1/j1', scale: 1, offset: 0 }]],
      ['k:b', [{ address: 'm1/j1', scale: 1, offset: 100 }]],
    ]);
    const out = buildPredictedAddressValues(
      index,
      new Map([
        ['k:a', 1],
        ['k:b', 1],
      ]),
    );
    expect(out.get('m1/j1')).toBe(101);
  });

  it('빈 인덱스는 빈 맵이고, out 참조를 비우고 재사용한다', () => {
    const out = new Map([['stale', 1]]);
    const result = buildPredictedAddressValues(indexOf([]), new Map(), out);
    expect(result).toBe(out);
    expect(out.size).toBe(0);
  });
});
