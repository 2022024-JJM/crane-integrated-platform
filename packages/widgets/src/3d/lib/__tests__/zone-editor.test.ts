import { describe, expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from 'three';
import type { SavedModelZone } from '@crane/domain/3d';
import {
  createModelZone,
  DEFAULT_ZONE_RADIUS,
  measureModelFootprintRadius,
  nextZoneColor,
  normalizeZoneOffset,
  withZoneOffsetAxis,
  ZONE_COLOR_PRESETS,
} from '../zone-editor';

function zone(overrides: Partial<SavedModelZone> = {}): SavedModelZone {
  return { id: 'z', name: '', color: '#38bdf8', radius: 5, ...overrides };
}

describe('createModelZone', () => {
  it('고유 id·기본 반경·이름 인자·첫 프리셋 색', () => {
    const a = createModelZone([]);
    const b = createModelZone([], null, '영역 2');
    expect(a.id).toMatch(/^zone-[^-]{8}$/);
    expect(a.id).not.toBe(b.id);
    expect(a.radius).toBe(DEFAULT_ZONE_RADIUS);
    expect(a.name).toBe('');
    expect(b.name).toBe('영역 2');
    expect(a.color).toBe(ZONE_COLOR_PRESETS[0]);
    expect(a).not.toHaveProperty('offset');
  });
});

describe('createModelZone — 반경 인자', () => {
  it('잰 반경이 있으면 쓰고, null·0·NaN 이면 기본값', () => {
    expect(createModelZone([], 7.5).radius).toBe(7.5);
    expect(createModelZone([], null).radius).toBe(DEFAULT_ZONE_RADIUS);
    expect(createModelZone([], 0).radius).toBe(DEFAULT_ZONE_RADIUS);
    expect(createModelZone([], Number.NaN).radius).toBe(DEFAULT_ZONE_RADIUS);
  });
});

describe('measureModelFootprintRadius', () => {
  function mounted(
    w: number,
    h: number,
    d: number,
    options: { scale?: number; meshOffsetX?: number } = {},
  ) {
    const root = new Group();
    const mesh = new Mesh(new BoxGeometry(w, h, d), new MeshBasicMaterial());
    mesh.position.x = options.meshOffsetX ?? 0;
    root.add(mesh);
    root.scale.setScalar(options.scale ?? 1);
    root.updateMatrixWorld(true);
    return root;
  }

  it('원점에서 발자국 가장 먼 XZ 모서리까지의 거리(모델을 딱 감싸는 원), 높이 무시', () => {
    // 4×2 발자국, 원점 중앙 → 모서리 (2, 1)
    expect(measureModelFootprintRadius(mounted(4, 100, 2))).toBeCloseTo(2.2);
    // 2×6.26 → hypot(1, 3.13) = 3.286 → 3.3
    expect(measureModelFootprintRadius(mounted(2, 1, 6.26))).toBe(3.3);
    // 단위 큐브 × scale 3 → hypot(1.5, 1.5) = 2.12 → 2.1
    expect(measureModelFootprintRadius(mounted(1, 1, 1, { scale: 3 }))).toBe(
      2.1,
    );
  });

  it('원점이 발자국 한쪽에 치우치면 먼 쪽 모서리 기준으로 커진다', () => {
    // 큐브가 x=+2 에 있음: 박스 x∈[1.5,2.5] → 먼 모서리 (2.5, 0.5)
    expect(
      measureModelFootprintRadius(mounted(1, 1, 1, { meshOffsetX: 2 })),
    ).toBeCloseTo(2.5);
  });

  it('숨긴 서브트리(LOD 프록시 등)는 발자국에 넣지 않는다', () => {
    const root = mounted(1, 1, 1);
    const hidden = new Mesh(
      new BoxGeometry(50, 1, 50),
      new MeshBasicMaterial(),
    );
    hidden.visible = false;
    root.add(hidden);
    root.updateMatrixWorld(true);
    expect(measureModelFootprintRadius(root)).toBeCloseTo(0.7);
  });

  it('루트 없음·빈 그룹은 null, 아주 작은 모델은 0.1 바닥값', () => {
    expect(measureModelFootprintRadius(null)).toBeNull();
    expect(measureModelFootprintRadius(new Group())).toBeNull();
    expect(measureModelFootprintRadius(mounted(0.01, 0.01, 0.01))).toBe(0.1);
  });
});

describe('nextZoneColor', () => {
  it('아직 안 쓴 첫 프리셋을 고른다(대소문자 무관)', () => {
    expect(
      nextZoneColor([zone({ color: ZONE_COLOR_PRESETS[0].toUpperCase() })]),
    ).toBe(ZONE_COLOR_PRESETS[1]);
    expect(
      nextZoneColor([
        zone({ color: ZONE_COLOR_PRESETS[0] }),
        zone({ id: 'b', color: ZONE_COLOR_PRESETS[2] }),
      ]),
    ).toBe(ZONE_COLOR_PRESETS[1]);
  });

  it('전부 썼으면 개수 기준으로 순환한다', () => {
    const all = ZONE_COLOR_PRESETS.map((color, i) =>
      zone({ id: `z${i}`, color }),
    );
    expect(nextZoneColor(all)).toBe(ZONE_COLOR_PRESETS[0]);
    expect(
      nextZoneColor([...all, zone({ id: 'x', color: ZONE_COLOR_PRESETS[0] })]),
    ).toBe(ZONE_COLOR_PRESETS[1]);
  });

  it('사용자 지정 색은 프리셋 소비로 치지 않는다', () => {
    expect(nextZoneColor([zone({ color: '#123456' })])).toBe(
      ZONE_COLOR_PRESETS[0],
    );
  });
});

describe('normalizeZoneOffset', () => {
  it('둘 다 0·undefined·NaN 이면 undefined, 아니면 [dx, dz]', () => {
    expect(normalizeZoneOffset(0, 0)).toBeUndefined();
    expect(normalizeZoneOffset(undefined, undefined)).toBeUndefined();
    expect(normalizeZoneOffset(Number.NaN, 0)).toBeUndefined();
    expect(normalizeZoneOffset(1, undefined)).toEqual([1, 0]);
    expect(normalizeZoneOffset(0, -2.5)).toEqual([0, -2.5]);
  });
});

describe('withZoneOffsetAxis', () => {
  it('한 축만 바꾸고 다른 축은 유지한다', () => {
    const z = zone({ offset: [1, 2] });
    expect(withZoneOffsetAxis(z, 'x', 5).offset).toEqual([5, 2]);
    expect(withZoneOffsetAxis(z, 'z', -1).offset).toEqual([1, -1]);
  });

  it('둘 다 0 이 되면 offset 필드를 뗀다', () => {
    const z = zone({ offset: [1, 0] });
    const out = withZoneOffsetAxis(z, 'x', 0);
    expect(out).not.toHaveProperty('offset');
    expect(withZoneOffsetAxis(z, 'x', undefined)).not.toHaveProperty('offset');
  });

  it('원본 객체를 바꾸지 않는다', () => {
    const z = zone({ offset: [1, 2] });
    withZoneOffsetAxis(z, 'x', 9);
    expect(z.offset).toEqual([1, 2]);
  });
});
