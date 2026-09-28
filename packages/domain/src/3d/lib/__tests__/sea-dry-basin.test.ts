import { describe, expect, it } from 'vitest';
import {
  MeshLambertMaterial,
  MeshStandardMaterial,
  type Material,
} from 'three';
import { toLambertMaterial } from '../lambert-material';
import {
  isSeaDryBasinMaterial,
  resolveMeshSeaSubmersion,
} from '../sea-dry-basin';

function named(name: string): MeshStandardMaterial {
  const material = new MeshStandardMaterial();
  material.name = name;
  return material;
}

describe('isSeaDryBasinMaterial', () => {
  it.each([
    // 배포 지도(okpo·philly-area-1·philly-area-2)에 실제로 있는 이름.
    'Dock_01',
    'Dock_02',
    'Dock_002',
    'Dock_003_Baked',
    'Dock_Floor',
    'Dock_Wall',
    'Dock_Line',
    // 경계 — 접두사만, 구분자가 공백·점·숫자.
    'Dock',
    'Dock 01',
    'Dock.001',
    'Dock1',
    // 대소문자는 가리지 않는다.
    'dock_floor',
    'DOCK_WALL',
  ])('"%s" 는 드라이독이다', (name) => {
    expect(isSeaDryBasinMaterial(named(name))).toBe(true);
  });

  it.each([
    // Dock 뒤에 글자가 이어지면 다른 단어다.
    'Docking',
    'DockFloor',
    'Docks',
    // 앞머리가 아니면 드라이독이 아니다.
    'Dry Dock',
    'Floating_Dock',
    ' Dock_01',
    // 같은 지도의 잠겨야 하는 머티리얼.
    'Water Front Wall',
    'For Baking_Baked.1001',
    'Terrain',
    'Sea',
    '',
  ])('"%s" 는 드라이독이 아니다', (name) => {
    expect(isSeaDryBasinMaterial(named(name))).toBe(false);
  });

  it('Lambert 변환본(#lambert 접미사)도 원본과 같이 판정한다', () => {
    const dock = toLambertMaterial(named('Dock_Floor'));
    const terrain = toLambertMaterial(named('Terrain'));
    expect(dock).toBeInstanceOf(MeshLambertMaterial);
    expect(isSeaDryBasinMaterial(dock)).toBe(true);
    expect(isSeaDryBasinMaterial(terrain)).toBe(false);
  });

  it('이름이 문자열이 아닌 오염값이면 드라이독이 아니다', () => {
    const material = new MeshStandardMaterial();
    (material as unknown as { name: unknown }).name = undefined;
    expect(isSeaDryBasinMaterial(material)).toBe(false);
    (material as unknown as { name: unknown }).name = 42;
    expect(isSeaDryBasinMaterial(material)).toBe(false);
  });

  it('배열은 전부 드라이독일 때만 true 다', () => {
    expect(
      isSeaDryBasinMaterial([named('Dock_Floor'), named('Dock_Wall')]),
    ).toBe(true);
    expect(
      isSeaDryBasinMaterial([named('Dock_Floor'), named('Terrain')]),
    ).toBe(false);
  });

  it('빈 배열은 false 다', () => {
    const empty: Material[] = [];
    expect(isSeaDryBasinMaterial(empty)).toBe(false);
  });
});

describe('resolveMeshSeaSubmersion', () => {
  it('seaSubmersion 이 꺼져 있으면 머티리얼·seaDryBasins 와 무관하게 false 다', () => {
    expect(resolveMeshSeaSubmersion(named('Terrain'), false, false)).toBe(false);
    expect(resolveMeshSeaSubmersion(named('Terrain'), false, true)).toBe(false);
    expect(resolveMeshSeaSubmersion(named('Dock_Floor'), false, true)).toBe(
      false,
    );
  });

  it('지도(seaDryBasins)는 드라이독 메시만 빼고 잠긴다', () => {
    expect(resolveMeshSeaSubmersion(named('Terrain'), true, true)).toBe(true);
    expect(resolveMeshSeaSubmersion(named('Dock_Floor'), true, true)).toBe(
      false,
    );
  });

  it('모델(seaDryBasins 꺼짐)은 이름이 Dock 이어도 잠긴다', () => {
    expect(resolveMeshSeaSubmersion(named('Dock_Floor'), true, false)).toBe(
      true,
    );
  });

  it('머티리얼 배열은 하나라도 잠기는 머티리얼이 섞이면 잠긴다', () => {
    expect(
      resolveMeshSeaSubmersion(
        [named('Dock_Floor'), named('Terrain')],
        true,
        true,
      ),
    ).toBe(true);
    expect(
      resolveMeshSeaSubmersion(
        [named('Dock_Floor'), named('Dock_Wall')],
        true,
        true,
      ),
    ).toBe(false);
  });
});
