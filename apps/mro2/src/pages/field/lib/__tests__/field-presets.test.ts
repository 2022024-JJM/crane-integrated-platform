import { describe, expect, it } from 'vitest';
import {
  componentAfterPreset,
  presetComponent,
  symptomPresets,
} from '../field-presets';

const label = (c: string) => `L:${c}`;

describe('symptomPresets', () => {
  it('골리앗·갠트리·천장은 트롤리·주행 프리셋', () => {
    for (const t of ['goliath', 'gantry', 'overhead'] as const) {
      const keys = symptomPresets(t);
      expect(keys).toContain('trolleyTravel');
      expect(keys).toContain('gantryTravel');
      expect(keys).not.toContain('luffing');
    }
  });
  it('러핑·LLC·지브·TTC 는 기복·선회 프리셋', () => {
    for (const t of ['luffing', 'llc', 'jib', 'ttc'] as const) {
      const keys = symptomPresets(t);
      expect(keys).toContain('luffing');
      expect(keys).toContain('slewing');
      expect(keys).not.toContain('trolleyTravel');
    }
  });
  it('장비를 모르면 공통 프리셋', () => {
    expect(symptomPresets(null)).toEqual(symptomPresets(undefined));
    expect(symptomPresets(null)).toContain('motorStop');
    expect(symptomPresets(null)).not.toContain('hoist');
  });
  it('프리셋 키는 종류 안에서 겹치지 않는다', () => {
    for (const t of ['goliath', 'luffing', null] as const) {
      const keys = symptomPresets(t);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});

describe('presetComponent', () => {
  it('부위가 있는 프리셋과 없는 프리셋', () => {
    expect(presetComponent('trolleyTravel')).toBe('trolley');
    expect(presetComponent('leak')).toBe('hydraulics');
    expect(presetComponent('noise')).toBeNull();
  });
});

describe('componentAfterPreset', () => {
  it('켤 때 비어 있으면 채운다', () => {
    expect(componentAfterPreset('', 'hoist', true, label)).toBe('L:hoist');
    expect(componentAfterPreset('   ', 'hoist', true, label)).toBe('L:hoist');
  });
  it('켤 때 이미 적힌 부위는 건드리지 않는다', () => {
    expect(componentAfterPreset('손으로 적음', 'hoist', true, label)).toBe(
      '손으로 적음',
    );
  });
  it('끌 때 자동으로 넣은 값이면 비우고, 다른 값이면 둔다', () => {
    expect(componentAfterPreset('L:hoist', 'hoist', false, label)).toBe('');
    expect(componentAfterPreset('L:brake', 'hoist', false, label)).toBe(
      'L:brake',
    );
  });
  it('부위 없는 프리셋은 어느 쪽이든 그대로', () => {
    expect(componentAfterPreset('', 'noise', true, label)).toBe('');
    expect(componentAfterPreset('x', 'noise', false, label)).toBe('x');
  });
});
