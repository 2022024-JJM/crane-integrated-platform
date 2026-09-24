import {
  ClampToEdgeWrapping,
  LinearFilter,
  MirroredRepeatWrapping,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
} from 'three';
import { describe, expect, it } from 'vitest';
import { ensureRepeatWrapping } from '../water-normals';

describe('ensureRepeatWrapping', () => {
  it('기본(ClampToEdge) 텍스처는 Repeat 로 바꾸고 version 을 올리며 true', () => {
    const texture = new Texture();
    expect(texture.wrapS).toBe(ClampToEdgeWrapping);
    const version = texture.version;
    expect(ensureRepeatWrapping(texture)).toBe(true);
    expect(texture.wrapS).toBe(RepeatWrapping);
    expect(texture.wrapT).toBe(RepeatWrapping);
    // needsUpdate 는 setter 뿐이라 version 으로 확인한다.
    expect(texture.version).toBe(version + 1);
  });

  it('이미 Repeat 이면 false 이고 version 이 그대로다(멱등)', () => {
    const texture = new Texture();
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    const version = texture.version;
    expect(ensureRepeatWrapping(texture)).toBe(false);
    expect(texture.version).toBe(version);
  });

  it('두 번째 호출은 false·version 불변', () => {
    const texture = new Texture();
    ensureRepeatWrapping(texture);
    const version = texture.version;
    expect(ensureRepeatWrapping(texture)).toBe(false);
    expect(texture.version).toBe(version);
  });

  it('한 축만 Repeat 이면 나머지 축을 맞추고 true', () => {
    const onlyS = new Texture();
    onlyS.wrapS = RepeatWrapping;
    expect(ensureRepeatWrapping(onlyS)).toBe(true);
    expect(onlyS.wrapT).toBe(RepeatWrapping);

    const onlyT = new Texture();
    onlyT.wrapT = RepeatWrapping;
    onlyT.wrapS = MirroredRepeatWrapping;
    expect(ensureRepeatWrapping(onlyT)).toBe(true);
    expect(onlyT.wrapS).toBe(RepeatWrapping);
  });

  it('colorSpace·필터 등 다른 필드는 건드리지 않는다', () => {
    const texture = new Texture();
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter;
    texture.flipY = false;
    ensureRepeatWrapping(texture);
    expect(texture.colorSpace).toBe(SRGBColorSpace);
    expect(texture.minFilter).toBe(LinearFilter);
    expect(texture.flipY).toBe(false);
  });
});
