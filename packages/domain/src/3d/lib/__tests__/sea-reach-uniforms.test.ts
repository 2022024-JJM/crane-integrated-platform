import { afterEach, describe, expect, it, vi } from 'vitest';
import { LinearFilter, type DataTexture } from 'three';
import type { SeaReachMask } from '../sea-reach-mask';
import {
  getSeaReachSignature,
  publishSeaReachMask,
  resetSeaReachMask,
  seaReachUniforms,
} from '../sea-reach-uniforms';

function mask(width = 3, height = 2): SeaReachMask {
  return {
    data: new Uint8Array(width * height).fill(255),
    width,
    height,
    transform: [0.1, 0, 0.5, 0, 0.2, 0.25, 0, 0, 1],
  };
}

function texture(): DataTexture {
  return seaReachUniforms.seaReachMask.value as DataTexture;
}

/** 현재 유니폼으로 월드 XZ 를 조회한 uv. */
function uvOf(x: number, z: number): [number, number] {
  // Matrix3.elements 는 열 우선이다.
  const e = seaReachUniforms.seaReachTransform.value.elements;
  return [e[0] * x + e[3] * z + e[6], e[1] * x + e[4] * z + e[7]];
}

afterEach(() => {
  resetSeaReachMask();
});

describe('sea-reach-uniforms', () => {
  it('처음에는 준비 전이다 — 어디를 조회해도 0 을 읽는다', () => {
    expect(getSeaReachSignature()).toBeNull();
    expect(texture().image).toMatchObject({ width: 1, height: 1 });
    expect(Array.from(texture().image.data as Uint8Array)).toEqual([0]);
    expect(uvOf(0, 0)).toEqual([0.5, 0.5]);
    expect(uvOf(-5000, 12345)).toEqual([0.5, 0.5]);
  });

  it('마스크를 올리면 텍스처·변환·서명이 바뀐다', () => {
    const next = mask();
    publishSeaReachMask(next, 'scene-a');

    expect(getSeaReachSignature()).toBe('scene-a');
    expect(texture().image).toMatchObject({ width: 3, height: 2 });
    expect(texture().image.data).toBe(next.data);
    expect(texture().magFilter).toBe(LinearFilter);
    expect(texture().minFilter).toBe(LinearFilter);
    expect(texture().generateMipmaps).toBe(false);
    // 폭이 4 의 배수가 아닌 1채널 텍스처라 정렬이 1 이어야 행이 밀리지 않는다.
    expect(texture().unpackAlignment).toBe(1);
    expect(uvOf(0, 0)).toEqual([0.5, 0.25]);
    expect(uvOf(5, 1)).toEqual([1, 0.45]);
  });

  it('유니폼 객체는 그대로 두고 값만 바꾼다 — 머티리얼이 참조를 들고 있다', () => {
    const maskUniform = seaReachUniforms.seaReachMask;
    const transformUniform = seaReachUniforms.seaReachTransform;
    const matrix = transformUniform.value;

    publishSeaReachMask(mask(), 'scene-a');

    expect(seaReachUniforms.seaReachMask).toBe(maskUniform);
    expect(seaReachUniforms.seaReachTransform).toBe(transformUniform);
    expect(seaReachUniforms.seaReachTransform.value).toBe(matrix);
  });

  it('null 을 올리면 전부 바다다 — 어디를 조회해도 255 를 읽는다', () => {
    publishSeaReachMask(null, '');

    expect(getSeaReachSignature()).toBe('');
    expect(Array.from(texture().image.data as Uint8Array)).toEqual([255]);
    expect(uvOf(999, -999)).toEqual([0.5, 0.5]);
  });

  it('새 마스크를 올리면 이전 마스크 텍스처를 폐기한다', () => {
    publishSeaReachMask(mask(), 'scene-a');
    const first = texture();
    const dispose = vi.spyOn(first, 'dispose');

    publishSeaReachMask(mask(4, 4), 'scene-b');

    expect(dispose).toHaveBeenCalledTimes(1);
    expect(texture()).not.toBe(first);
    expect(getSeaReachSignature()).toBe('scene-b');
  });

  it('상수 텍스처(준비 전·전부 바다)는 폐기하지 않는다', () => {
    const notReady = texture();
    const disposeNotReady = vi.spyOn(notReady, 'dispose');
    publishSeaReachMask(null, '');
    const allSea = texture();
    const disposeAllSea = vi.spyOn(allSea, 'dispose');

    publishSeaReachMask(mask(), 'scene-a');
    resetSeaReachMask();
    publishSeaReachMask(null, '');

    expect(disposeNotReady).not.toHaveBeenCalled();
    expect(disposeAllSea).not.toHaveBeenCalled();
    expect(texture()).toBe(allSea);
    disposeNotReady.mockRestore();
    disposeAllSea.mockRestore();
  });

  it('reset 은 마스크를 폐기하고 준비 전으로 되돌린다', () => {
    publishSeaReachMask(mask(), 'scene-a');
    const dispose = vi.spyOn(texture(), 'dispose');

    resetSeaReachMask();

    expect(dispose).toHaveBeenCalledTimes(1);
    expect(getSeaReachSignature()).toBeNull();
    expect(Array.from(texture().image.data as Uint8Array)).toEqual([0]);
    expect(uvOf(3, 3)).toEqual([0.5, 0.5]);
  });

  it('준비 전에서 reset 은 no-op 이다', () => {
    const before = texture();
    const dispose = vi.spyOn(before, 'dispose');

    resetSeaReachMask();

    expect(texture()).toBe(before);
    expect(dispose).not.toHaveBeenCalled();
    expect(getSeaReachSignature()).toBeNull();
    dispose.mockRestore();
  });
});
