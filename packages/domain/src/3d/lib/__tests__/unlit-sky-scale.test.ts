import { afterEach, describe, expect, it } from 'vitest';
import {
  Color,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshStandardMaterial,
  NearestFilter,
  NoColorSpace,
  Texture,
} from 'three';
import {
  getUnlitSkyScale,
  publishUnlitSkyScale,
  toSkyScaledUnlitMaterial,
  unlitSkyScaleTexture,
} from '../unlit-sky-scale';

afterEach(() => {
  // 모듈 전역 텍셀 — 테스트 사이에 새지 않게 낮 값으로 되돌린다.
  publishUnlitSkyScale(1);
});

describe('unlitSkyScaleTexture', () => {
  it('1×1 선형 텍스처, uv 채널, 밉맵 없음, 초기 배율 1', () => {
    expect(unlitSkyScaleTexture.image.width).toBe(1);
    expect(unlitSkyScaleTexture.image.height).toBe(1);
    expect(unlitSkyScaleTexture.channel).toBe(0);
    expect(unlitSkyScaleTexture.colorSpace).toBe(NoColorSpace);
    expect(unlitSkyScaleTexture.magFilter).toBe(NearestFilter);
    expect(unlitSkyScaleTexture.minFilter).toBe(NearestFilter);
    expect(unlitSkyScaleTexture.generateMipmaps).toBe(false);
    expect(getUnlitSkyScale()).toBe(1);
  });
});

describe('publishUnlitSkyScale', () => {
  const texelOf = () =>
    Array.from(unlitSkyScaleTexture.image.data as Uint8Array);

  it('RGB 를 같은 8bit 값으로 쓰고 알파는 255 로 둔다', () => {
    publishUnlitSkyScale(0.5);
    expect(texelOf()).toEqual([128, 128, 128, 255]);
    expect(getUnlitSkyScale()).toBeCloseTo(128 / 255, 12);
  });

  it('1/255 단위로 양자화한다 — 밤 하늘 배율 0.12 는 31/255', () => {
    publishUnlitSkyScale(0.12);
    expect(texelOf()[0]).toBe(31);
    expect(getUnlitSkyScale()).toBeCloseTo(31 / 255, 12);
  });

  it('경계: 0 과 1 은 정확히 0·255, 밖은 잘린다', () => {
    publishUnlitSkyScale(0);
    expect(getUnlitSkyScale()).toBe(0);
    publishUnlitSkyScale(-0.2);
    expect(getUnlitSkyScale()).toBe(0);
    publishUnlitSkyScale(1);
    expect(getUnlitSkyScale()).toBe(1);
    publishUnlitSkyScale(1.5);
    expect(getUnlitSkyScale()).toBe(1);
  });

  it('비유한 값은 무시하고 이전 값을 유지한다', () => {
    publishUnlitSkyScale(0.4);
    const before = getUnlitSkyScale();
    const version = unlitSkyScaleTexture.version;
    publishUnlitSkyScale(Number.NaN);
    publishUnlitSkyScale(Number.POSITIVE_INFINITY);
    publishUnlitSkyScale(Number.NEGATIVE_INFINITY);
    expect(getUnlitSkyScale()).toBe(before);
    expect(unlitSkyScaleTexture.version).toBe(version);
  });

  it('값이 바뀌면 업로드를 요청하고(version 증가), 양자화 값이 같으면 하지 않는다', () => {
    publishUnlitSkyScale(0.3);
    const version = unlitSkyScaleTexture.version;
    // 0.3 × 255 = 76.5 → 77, 0.3005 × 255 = 76.6 → 77 — 같은 텍셀.
    publishUnlitSkyScale(0.3005);
    publishUnlitSkyScale(0.3);
    expect(unlitSkyScaleTexture.version).toBe(version);
    publishUnlitSkyScale(0.6);
    expect(unlitSkyScaleTexture.version).toBe(version + 1);
  });
});

describe('toSkyScaledUnlitMaterial', () => {
  it('unlit(MeshBasicMaterial)을 배율 텍스처를 lightMap(세기 π)으로 단 clone 으로 바꾼다', () => {
    const map = new Texture();
    const source = new MeshBasicMaterial({
      color: new Color('#336699'),
      map,
    });
    source.name = 'overlay';
    const out = toSkyScaledUnlitMaterial(source) as MeshBasicMaterial;
    expect(out).not.toBe(source);
    expect(out).toBeInstanceOf(MeshBasicMaterial);
    expect(out.lightMap).toBe(unlitSkyScaleTexture);
    expect(out.lightMapIntensity).toBe(Math.PI);
    expect(out.map).toBe(map);
    expect(out.color.getHexString()).toBe('336699');
    expect(out.name).toBe('overlay#sky-scaled');
  });

  it('원본은 건드리지 않는다', () => {
    const source = new MeshBasicMaterial({ color: 0xff0000 });
    toSkyScaledUnlitMaterial(source);
    expect(source.lightMap).toBeNull();
    expect(source.lightMapIntensity).toBe(1);
    expect(source.color.getHex()).toBe(0xff0000);
  });

  it('같은 원본은 같은 변환본을 돌려준다(캐시)', () => {
    const source = new MeshBasicMaterial();
    expect(toSkyScaledUnlitMaterial(source)).toBe(
      toSkyScaledUnlitMaterial(source),
    );
  });

  it('변환본을 다시 clone 해도(바다 잠김 공유본·개별 클론) 같은 텍스처를 본다', () => {
    const scaled = toSkyScaledUnlitMaterial(
      new MeshBasicMaterial(),
    ) as MeshBasicMaterial;
    const variant = scaled.clone();
    expect(variant.lightMap).toBe(unlitSkyScaleTexture);
    expect(variant.lightMapIntensity).toBe(Math.PI);
  });

  it('이미 lightMap 이 있는 unlit 은 그대로 돌려준다(구운 조명을 덮지 않는다)', () => {
    const baked = new Texture();
    const source = new MeshBasicMaterial({ lightMap: baked });
    expect(toSkyScaledUnlitMaterial(source)).toBe(source);
    expect(source.lightMap).toBe(baked);
  });

  it('unlit 이 아닌 머티리얼은 그대로 돌려준다', () => {
    const standard = new MeshStandardMaterial();
    expect(toSkyScaledUnlitMaterial(standard)).toBe(standard);
    const lambert = new MeshLambertMaterial();
    expect(toSkyScaledUnlitMaterial(lambert)).toBe(lambert);
  });
});
