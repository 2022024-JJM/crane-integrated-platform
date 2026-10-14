import { describe, expect, it } from 'vitest';
import type { EquipmentOutlineState } from '@crane/core/types/status';
import {
  SILHOUETTE_OUTLINE_PX,
  SILHOUETTE_OUTLINE_RENDER_ORDER,
} from '../silhouette-outline';
import {
  STATUS_OUTLINE_COLORS,
  STATUS_OUTLINE_PX,
  isStatusOutlineVisible,
  statusOutlineRenderOrder,
  type StatusOutlineKind,
} from '../status-outline-style';
import { OUTLINE_STATUS_TAG_ROLES } from '../../model/status-tag-types';

const KINDS: StatusOutlineKind[] = ['commError', 'slowdown', 'endstop'];

describe('isStatusOutlineVisible', () => {
  it('세 가지 외곽선은 그린다', () => {
    for (const kind of KINDS) {
      expect(isStatusOutlineVisible(kind)).toBe(true);
    }
  });

  it('none·생략은 그리지 않는다', () => {
    expect(isStatusOutlineVisible('none')).toBe(false);
    expect(isStatusOutlineVisible(undefined)).toBe(false);
  });

  it('모르는 값은 그리지 않는다 — 색이 없는 외곽선을 만들지 않는다', () => {
    for (const broken of ['', 'fault', 'toString', 'constructor', null, 1]) {
      expect(
        isStatusOutlineVisible(broken as unknown as EquipmentOutlineState),
      ).toBe(false);
    }
  });
});

describe('STATUS_OUTLINE_COLORS', () => {
  it('그리는 외곽선마다 색이 있고 서로 다르다', () => {
    const colors = KINDS.map((kind) => STATUS_OUTLINE_COLORS[kind]);
    for (const color of colors) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(new Set(colors).size).toBe(KINDS.length);
  });

  it('외곽선 역할과 외곽선 종류가 1:1 이다', () => {
    expect([...OUTLINE_STATUS_TAG_ROLES].sort()).toEqual([...KINDS].sort());
    expect(Object.keys(STATUS_OUTLINE_COLORS).sort()).toEqual(
      [...KINDS].sort(),
    );
  });
});

describe('statusOutlineRenderOrder', () => {
  it('위험한 쪽이 위다 — 회색 < 황색 < 적색', () => {
    expect(statusOutlineRenderOrder('commError')).toBeLessThan(
      statusOutlineRenderOrder('slowdown'),
    );
    expect(statusOutlineRenderOrder('slowdown')).toBeLessThan(
      statusOutlineRenderOrder('endstop'),
    );
  });

  it('선택·충돌 테두리보다 먼저 그린다', () => {
    for (const kind of KINDS) {
      expect(statusOutlineRenderOrder(kind)).toBeLessThan(
        SILHOUETTE_OUTLINE_RENDER_ORDER,
      );
    }
  });
});

describe('STATUS_OUTLINE_PX', () => {
  it('선택·충돌 테두리보다 얇다', () => {
    expect(STATUS_OUTLINE_PX).toBeGreaterThan(0);
    expect(STATUS_OUTLINE_PX).toBeLessThan(SILHOUETTE_OUTLINE_PX);
  });
});
