import { describe, expect, it } from 'vitest';
import { Color, MeshBasicMaterial, MeshStandardMaterial, Texture } from 'three';
import {
  GUARD_SOLID_FADE,
  applyGuardFade,
  isGuardBlendedMaterial,
  prepareGuardObjectMaterial,
} from '../guard-object-material';

/** 불투명한 본체 재질 — 색과 텍스처를 가진다. */
function opaqueSource() {
  return new MeshStandardMaterial({
    color: new Color('#c2410c'),
    map: new Texture(),
    normalMap: new Texture(),
    roughness: 0.4,
    metalness: 0.7,
  });
}

/** 유리 — GLTF 의 BLEND 재질이 들어오는 모양. */
function glassSource() {
  return new MeshStandardMaterial({
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
  });
}

/** 머리카락 — GLTF 의 MASK 재질이 들어오는 모양. */
function cutoutSource() {
  return new MeshStandardMaterial({ map: new Texture(), alphaTest: 0.5 });
}

describe('prepareGuardObjectMaterial', () => {
  it('복제본을 돌려주고 원본은 건드리지 않는다', () => {
    const source = opaqueSource();
    const prepared = prepareGuardObjectMaterial(source);

    expect(prepared).not.toBe(source);
    expect(source.transparent).toBe(false);
    expect(source.opacity).toBe(1);
    expect(source.depthWrite).toBe(true);
  });

  it('자산의 색·텍스처·재질 값을 그대로 둔다', () => {
    const source = opaqueSource();
    const prepared = prepareGuardObjectMaterial(source);

    expect(prepared.color.getHexString()).toBe(source.color.getHexString());
    expect(prepared.map).toBe(source.map);
    expect(prepared.normalMap).toBe(source.normalMap);
    expect(prepared.roughness).toBe(0.4);
    expect(prepared.metalness).toBe(0.7);
    expect(prepared.emissive.getHex()).toBe(0);
  });

  it('보이지 않는 상태에서 시작한다 — 투명 패스, 불투명도 0, 깊이 안 씀', () => {
    const prepared = prepareGuardObjectMaterial(opaqueSource());

    expect(prepared.transparent).toBe(true);
    expect(prepared.opacity).toBe(0);
    expect(prepared.depthWrite).toBe(false);
  });

  it('알파 컷 재질은 시작부터 컷 기준이 0 보다 크다 — 컷이 빠진 채 컴파일되지 않는다', () => {
    const prepared = prepareGuardObjectMaterial(cutoutSource());

    expect(prepared.alphaTest).toBeGreaterThan(0);
  });

  it('표준 재질이 아니어도 받는다', () => {
    const prepared = prepareGuardObjectMaterial(
      new MeshBasicMaterial({ color: '#ffffff' }),
    );

    expect(prepared.transparent).toBe(true);
    expect(prepared.opacity).toBe(0);
  });

  it('원본의 불투명도·컷 기준이 숫자가 아니면 불투명한 재질로 본다', () => {
    const source = new MeshStandardMaterial();
    source.opacity = Number.NaN;
    source.alphaTest = Number.POSITIVE_INFINITY;
    const prepared = prepareGuardObjectMaterial(source);
    applyGuardFade(prepared, 1);

    expect(prepared.opacity).toBe(1);
    expect(prepared.alphaTest).toBe(0);
    expect(prepared.depthWrite).toBe(true);
  });
});

describe('isGuardBlendedMaterial', () => {
  it('원래 반투명이던 재질만 참이다', () => {
    expect(
      isGuardBlendedMaterial(prepareGuardObjectMaterial(glassSource())),
    ).toBe(true);
    expect(
      isGuardBlendedMaterial(prepareGuardObjectMaterial(opaqueSource())),
    ).toBe(false);
    expect(
      isGuardBlendedMaterial(prepareGuardObjectMaterial(cutoutSource())),
    ).toBe(false);
  });

  it('준비되지 않은 재질은 거짓이다 — 투명 플래그만으로 판정하지 않는다', () => {
    expect(isGuardBlendedMaterial(glassSource())).toBe(false);
  });
});

describe('applyGuardFade', () => {
  it('불투명한 재질은 페이드가 곧 불투명도다', () => {
    const material = prepareGuardObjectMaterial(opaqueSource());

    applyGuardFade(material, 0.3);
    expect(material.opacity).toBeCloseTo(0.3);
    applyGuardFade(material, 1);
    expect(material.opacity).toBe(1);
    applyGuardFade(material, 0);
    expect(material.opacity).toBe(0);
  });

  it('실체 기준값에서 깊이를 쓰고 바로 아래에서는 쓰지 않는다', () => {
    const material = prepareGuardObjectMaterial(opaqueSource());

    applyGuardFade(material, GUARD_SOLID_FADE);
    expect(material.depthWrite).toBe(true);
    applyGuardFade(material, GUARD_SOLID_FADE - 0.001);
    expect(material.depthWrite).toBe(false);
    applyGuardFade(material, 1);
    expect(material.depthWrite).toBe(true);
  });

  it('유리는 다 나타나도 원래 불투명도까지만 차고 깊이를 쓰지 않는다', () => {
    const material = prepareGuardObjectMaterial(glassSource());

    applyGuardFade(material, 1);
    expect(material.opacity).toBeCloseTo(0.4);
    expect(material.depthWrite).toBe(false);
    applyGuardFade(material, 0.5);
    expect(material.opacity).toBeCloseTo(0.2);
  });

  it('알파 컷 기준을 페이드에 비례해 낮춘다 — 반투명 구간에서 잘리는 자리가 같다', () => {
    const material = prepareGuardObjectMaterial(cutoutSource());

    applyGuardFade(material, 1);
    expect(material.alphaTest).toBe(0.5);
    applyGuardFade(material, 0.3);
    expect(material.alphaTest).toBeCloseTo(0.15);
    // 텍스처 알파 0.5 인 자리: 알파와 기준이 같은 비율로 움직인다.
    expect(0.5 * material.opacity).toBeCloseTo(material.alphaTest);
  });

  it('알파 컷 기준은 페이드 0 에서도 0 이 되지 않는다', () => {
    const material = prepareGuardObjectMaterial(cutoutSource());

    applyGuardFade(material, 0);
    expect(material.alphaTest).toBeGreaterThan(0);
    expect(material.alphaTest).toBeLessThan(0.001);
  });

  it('컷이 없던 재질에는 컷을 만들지 않는다', () => {
    const material = prepareGuardObjectMaterial(opaqueSource());

    applyGuardFade(material, 0.5);
    expect(material.alphaTest).toBe(0);
  });

  it('범위를 벗어난 페이드는 0~1 로 자른다', () => {
    const material = prepareGuardObjectMaterial(opaqueSource());

    applyGuardFade(material, 2);
    expect(material.opacity).toBe(1);
    expect(material.depthWrite).toBe(true);
    applyGuardFade(material, -1);
    expect(material.opacity).toBe(0);
    applyGuardFade(material, Number.POSITIVE_INFINITY);
    expect(material.opacity).toBe(1);
  });

  it('숫자가 아닌 페이드는 보이지 않는 상태로 둔다', () => {
    const material = prepareGuardObjectMaterial(cutoutSource());
    applyGuardFade(material, 1);

    applyGuardFade(material, Number.NaN);
    expect(material.opacity).toBe(0);
    expect(material.depthWrite).toBe(false);
    expect(material.alphaTest).toBeGreaterThan(0);
  });

  it('같은 페이드를 다시 넣어도 값이 같다', () => {
    const material = prepareGuardObjectMaterial(glassSource());

    applyGuardFade(material, 0.7);
    const opacity = material.opacity;
    applyGuardFade(material, 0.7);
    expect(material.opacity).toBe(opacity);
  });

  it('준비되지 않은 재질은 불투명한 재질로 다룬다', () => {
    const material = glassSource();

    applyGuardFade(material, 1);
    expect(material.opacity).toBe(1);
    expect(material.depthWrite).toBe(true);
    applyGuardFade(material, 0.5);
    expect(material.opacity).toBe(0.5);
    expect(material.depthWrite).toBe(false);
  });

  it('복제본끼리 기준값을 나누지 않는다', () => {
    const source = glassSource();
    const first = prepareGuardObjectMaterial(source);
    const second = prepareGuardObjectMaterial(source);

    applyGuardFade(first, 1);
    expect(first.opacity).toBeCloseTo(0.4);
    expect(second.opacity).toBe(0);
  });
});
