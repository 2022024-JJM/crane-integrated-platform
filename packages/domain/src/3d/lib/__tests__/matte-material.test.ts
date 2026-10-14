import { describe, expect, it } from 'vitest';
import {
  Color,
  DoubleSide,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Texture,
} from 'three';
import {
  MATTE_ROUGHNESS_MIN,
  isMatteMaterial,
  toMatteMaterial,
  toMatteMaterials,
} from '../matte-material';

function standard(
  overrides: Partial<{
    roughness: number;
    metalness: number;
    roughnessMap: Texture | null;
    metalnessMap: Texture | null;
  }> = {},
) {
  const material = new MeshStandardMaterial();
  material.roughness = overrides.roughness ?? 0.5;
  material.metalness = overrides.metalness ?? 0;
  material.roughnessMap = overrides.roughnessMap ?? null;
  material.metalnessMap = overrides.metalnessMap ?? null;
  return material;
}

describe('toMatteMaterial', () => {
  it('반사 관련 넷만 고치고 나머지(색·맵·정점색·면·투명도)는 물려받는다', () => {
    const map = new Texture();
    const mr = new Texture();
    const source = new MeshStandardMaterial({
      color: new Color('#336699'),
      map,
      vertexColors: true,
      side: DoubleSide,
      transparent: true,
      opacity: 0.7,
      alphaTest: 0.5,
      depthWrite: false,
      roughness: 0.5,
      metalness: 1,
      roughnessMap: mr,
      metalnessMap: mr,
    });
    source.name = 'Dock_002';
    const out = toMatteMaterial(source) as MeshStandardMaterial;
    expect(out).not.toBe(source);
    expect(out.isMeshStandardMaterial).toBe(true);
    expect(out.roughness).toBe(MATTE_ROUGHNESS_MIN);
    expect(out.metalness).toBe(0);
    expect(out.roughnessMap).toBeNull();
    expect(out.metalnessMap).toBeNull();
    expect(out.color.getHexString()).toBe('336699');
    expect(out.map).toBe(map);
    expect(out.vertexColors).toBe(true);
    expect(out.side).toBe(DoubleSide);
    expect(out.transparent).toBe(true);
    expect(out.opacity).toBeCloseTo(0.7, 12);
    expect(out.alphaTest).toBeCloseTo(0.5, 12);
    expect(out.depthWrite).toBe(false);
    expect(out.name).toBe('Dock_002#matte');
  });

  it('roughness 하한: 경계값은 그대로, 바로 아래는 하한으로, 위는 유지한다', () => {
    const atMin = toMatteMaterial(
      standard({ roughness: MATTE_ROUGHNESS_MIN, metalness: 1 }),
    ) as MeshStandardMaterial;
    expect(atMin.roughness).toBe(MATTE_ROUGHNESS_MIN);

    const below = toMatteMaterial(
      standard({ roughness: MATTE_ROUGHNESS_MIN - 0.0001 }),
    ) as MeshStandardMaterial;
    expect(below.roughness).toBe(MATTE_ROUGHNESS_MIN);

    const above = toMatteMaterial(
      standard({ roughness: 0.95, metalness: 0.3 }),
    ) as MeshStandardMaterial;
    expect(above.roughness).toBe(0.95);
    expect(above.metalness).toBe(0);
  });

  it('roughness 가 수가 아니면 하한으로 둔다', () => {
    const out = toMatteMaterial(
      standard({ roughness: Number.NaN, metalness: 1 }),
    ) as MeshStandardMaterial;
    expect(out.roughness).toBe(MATTE_ROUGHNESS_MIN);
  });

  it('이미 무광이면 원본 참조를 그대로 돌려준다(새 프로그램 없음)', () => {
    const already = standard({ roughness: MATTE_ROUGHNESS_MIN, metalness: 0 });
    expect(isMatteMaterial(already)).toBe(true);
    expect(toMatteMaterial(already)).toBe(already);

    // 하한 바로 아래, 금속, 맵 중 하나만 있어도 변환 대상이다.
    expect(
      isMatteMaterial(standard({ roughness: MATTE_ROUGHNESS_MIN - 0.0001 })),
    ).toBe(false);
    expect(isMatteMaterial(standard({ roughness: 1, metalness: 0.01 }))).toBe(
      false,
    );
    expect(
      isMatteMaterial(standard({ roughness: 1, roughnessMap: new Texture() })),
    ).toBe(false);
    expect(
      isMatteMaterial(standard({ roughness: 1, metalnessMap: new Texture() })),
    ).toBe(false);
  });

  it('같은 원본은 같은 변환본을 돌려준다(캐시) — clone 간 공유', () => {
    const source = standard();
    expect(toMatteMaterial(source)).toBe(toMatteMaterial(source));
  });

  it('원본은 건드리지 않는다', () => {
    const mr = new Texture();
    const source = standard({
      roughness: 0.5,
      metalness: 1,
      roughnessMap: mr,
      metalnessMap: mr,
    });
    toMatteMaterial(source);
    expect(source.roughness).toBe(0.5);
    expect(source.metalness).toBe(1);
    expect(source.roughnessMap).toBe(mr);
    expect(source.metalnessMap).toBe(mr);
  });

  it('Physical 머티리얼은 클래스를 유지한 채 변환한다', () => {
    const source = new MeshPhysicalMaterial({ roughness: 0.3, metalness: 0.5 });
    const out = toMatteMaterial(source) as MeshPhysicalMaterial;
    expect(out.isMeshPhysicalMaterial).toBe(true);
    expect(out.roughness).toBe(MATTE_ROUGHNESS_MIN);
    expect(out.metalness).toBe(0);
  });

  it('PBR 이 아닌 머티리얼은 그대로 돌려준다', () => {
    const basic = new MeshBasicMaterial();
    expect(toMatteMaterial(basic)).toBe(basic);
    const lambert = new MeshLambertMaterial();
    expect(toMatteMaterial(lambert)).toBe(lambert);
  });

  it('배열 머티리얼은 항목별로 변환한다', () => {
    const a = standard();
    const b = new MeshBasicMaterial();
    const out = toMatteMaterials([a, b]) as unknown[];
    expect(Array.isArray(out)).toBe(true);
    expect((out[0] as MeshStandardMaterial).roughness).toBe(
      MATTE_ROUGHNESS_MIN,
    );
    expect(out[0]).toBe(toMatteMaterial(a));
    expect(out[1]).toBe(b);
    expect(toMatteMaterials(a)).toBe(toMatteMaterial(a));
  });
});
