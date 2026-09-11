import { describe, expect, it } from 'vitest';
import {
  Color,
  DoubleSide,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshStandardMaterial,
  Texture,
} from 'three';
import { toLambertMaterial, toLambertMaterials } from '../lambert-material';

describe('toLambertMaterial', () => {
  it('PBR 의 색·맵·정점색·면·투명도를 옮기고 반사는 끈다', () => {
    const map = new Texture();
    const source = new MeshStandardMaterial({
      color: new Color('#336699'),
      map,
      vertexColors: true,
      side: DoubleSide,
      transparent: true,
      opacity: 0.7,
      alphaTest: 0.5,
      depthWrite: false,
    });
    source.name = 'terrain';
    const out = toLambertMaterial(source);
    expect(out).toBeInstanceOf(MeshLambertMaterial);
    const lambert = out as MeshLambertMaterial;
    expect(lambert.color.getHexString()).toBe('336699');
    expect(lambert.map).toBe(map);
    expect(lambert.vertexColors).toBe(true);
    expect(lambert.side).toBe(DoubleSide);
    expect(lambert.transparent).toBe(true);
    expect(lambert.opacity).toBeCloseTo(0.7, 12);
    expect(lambert.alphaTest).toBeCloseTo(0.5, 12);
    expect(lambert.depthWrite).toBe(false);
    expect(lambert.reflectivity).toBe(0);
    expect(lambert.name).toBe('terrain#lambert');
  });

  it('같은 원본은 같은 변환본을 돌려준다(캐시) — clone 간 공유', () => {
    const source = new MeshStandardMaterial();
    expect(toLambertMaterial(source)).toBe(toLambertMaterial(source));
  });

  it('원본은 건드리지 않는다', () => {
    const source = new MeshStandardMaterial({ color: 0xff0000 });
    toLambertMaterial(source);
    expect(source.isMeshStandardMaterial).toBe(true);
    expect(source.color.getHex()).toBe(0xff0000);
  });

  it('PBR 이 아닌 머티리얼은 그대로 돌려준다', () => {
    const basic = new MeshBasicMaterial();
    expect(toLambertMaterial(basic)).toBe(basic);
    const lambert = new MeshLambertMaterial();
    expect(toLambertMaterial(lambert)).toBe(lambert);
  });

  it('배열 머티리얼은 항목별로 변환한다', () => {
    const a = new MeshStandardMaterial();
    const b = new MeshBasicMaterial();
    const out = toLambertMaterials([a, b]) as unknown[];
    expect(Array.isArray(out)).toBe(true);
    expect(out[0]).toBeInstanceOf(MeshLambertMaterial);
    expect(out[1]).toBe(b);
    expect(toLambertMaterials(a)).toBe(toLambertMaterial(a));
  });
});
