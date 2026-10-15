import {
  DataTexture,
  NearestFilter,
  NoColorSpace,
  RGBAFormat,
  UnsignedByteType,
  type Material,
  type MeshBasicMaterial,
} from 'three';

/**
 * 조명을 받지 않는 지형 사진의 밤 밝기 — 컨텍스트 지형의 항공사진
 * overlay 는 GLB 에서 `KHR_materials_unlit` 이라 three 가 MeshBasicMaterial 로
 * 읽고, 조명이 닿지 않아 해가 져도 한낮 밝기로 남는다. 사진에 햇빛이 이미
 * 구워져 있으니 배경 하늘(EXR)처럼 다룬다: SceneLighting 이 하늘 밝기 배율
 * (`SkyLighting.skyIntensity` — 배경·환경맵과 같은 값)을 발행하고 사진이 같은
 * 배율로 어두워진다. 낮(배율 1)은 원본과 같다.
 *
 * 배율은 공유 1×1 텍스처의 텍셀이고 변환본에 lightMap 으로 붙는다.
 * MeshBasicMaterial 은 출력에 텍셀 × lightMapIntensity / π 를 곱하므로
 * lightMapIntensity = π 면 텍셀이 곧 배율이다. 유니폼(onBeforeCompile)이나
 * color 가 아닌 이유: 변환본은 바다 잠김 공유본(sea-material-cache)과 인스턴스
 * 개별 클론(mesh-material-binding)으로 clone 되는데, clone 은 onBeforeCompile
 * 을 옮기지 않고 잠김 패치가 그 자리를 덮어쓰며, color 는 값으로 복사돼 clone
 * 뒤의 변경이 닿지 않는다. 텍스처는 참조로 복사되므로 어느 clone 이든 같은
 * 텍셀을 본다. 값이 바뀌어도 프로그램은 그대로다(텍셀 하나 업로드).
 *
 * 비용은 픽셀당 1×1 텍스처 조회 하나다. 조명을 받게 바꾸는 것(Lambert)과 달리
 * 조명 수와 무관해 밤 점등·소등 재컴파일에도 끼지 않는다.
 *
 * 텍셀은 8bit 라 배율은 1/255 단위로 양자화된다(1 은 정확히 255).
 * 텍스처는 모듈 전역 하나라 SceneLighting 을 둔 캔버스 둘이 동시에 다른
 * 시각을 그리면 나중에 쓴 쪽이 이긴다(바다 도달 마스크와 같은 한계).
 */
const texel = new Uint8Array([255, 255, 255, 255]);

const skyScaleTexture = new DataTexture(
  texel,
  1,
  1,
  RGBAFormat,
  UnsignedByteType,
);
// lightMap 기본 채널은 uv1 인데 지형은 uv(TEXCOORD_0)만 있다. 1×1 이라 어느
// 좌표든 같은 텍셀이다.
skyScaleTexture.channel = 0;
skyScaleTexture.colorSpace = NoColorSpace;
skyScaleTexture.magFilter = NearestFilter;
skyScaleTexture.minFilter = NearestFilter;
skyScaleTexture.generateMipmaps = false;
skyScaleTexture.needsUpdate = true;

/** 변환본이 lightMap 으로 공유하는 배율 텍스처. */
export const unlitSkyScaleTexture: DataTexture = skyScaleTexture;

/**
 * 하늘 밝기 배율을 쓴다 — SceneLighting 만 부른다(미니맵 캡처의 기준 조명이
 * 잠깐 바꿨다 되돌리는 것은 예외). [0, 1] 로 자르고, 비유한 값은 무시한다.
 * 양자화한 값이 같으면 업로드하지 않는다.
 */
export function publishUnlitSkyScale(scale: number): void {
  if (!Number.isFinite(scale)) return;
  const value = Math.round(Math.min(1, Math.max(0, scale)) * 255);
  if (texel[0] === value) return;
  texel[0] = value;
  texel[1] = value;
  texel[2] = value;
  skyScaleTexture.needsUpdate = true;
}

/** 지금 배율(양자화 뒤 값). */
export function getUnlitSkyScale(): number {
  return texel[0] / 255;
}

function isBasicMaterial(material: Material): material is MeshBasicMaterial {
  return (material as MeshBasicMaterial).isMeshBasicMaterial === true;
}

const cache = new WeakMap<Material, MeshBasicMaterial>();

/**
 * unlit 머티리얼(MeshBasicMaterial) → 하늘 배율을 받는 변환본. 원본당 하나를
 * 캐시해 같은 GLB 의 clone 들이 공유하고, 원본은 건드리지 않는다. 다른
 * 머티리얼과 이미 lightMap 이 있는 것(구운 조명을 덮어쓰지 않는다)은 그대로
 * 돌려준다.
 */
export function toSkyScaledUnlitMaterial(material: Material): Material {
  if (!isBasicMaterial(material) || material.lightMap) return material;
  const cached = cache.get(material);
  if (cached) return cached;

  const scaled = material.clone();
  scaled.lightMap = skyScaleTexture;
  scaled.lightMapIntensity = Math.PI;
  scaled.name = `${material.name}#sky-scaled`;
  cache.set(material, scaled);
  return scaled;
}
