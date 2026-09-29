import {
  ClampToEdgeWrapping,
  DataTexture,
  LinearFilter,
  Matrix3,
  NoColorSpace,
  RedFormat,
  UnsignedByteType,
  type Texture,
} from 'three';
import { SEA_REACH_DRY, SEA_REACH_WET } from './sea-reach-grid';
import type { SeaReachMask } from './sea-reach-mask';

/**
 * 바다 도달 마스크의 셰이더 유니폼 — 잠김 패치(sea-submersion.ts)가 건 모든
 * 머티리얼이 **같은 유니폼 객체**를 참조한다. 값만 갈아 끼우면 다음 프레임에
 * 전 머티리얼이 새 마스크를 본다(three 는 프레임마다 머티리얼 유니폼을 다시
 * 올린다).
 *
 * 앱 전역 하나다 — 잠김 공유 머티리얼(sea-material-cache.ts)이 캔버스를
 * 가리지 않고 공유되므로 캔버스별 값을 둘 수 없다. 바다가 켜진 캔버스 둘이
 * 서로 다른 씬을 동시에 그리면 나중에 올린 마스크가 이긴다.
 *
 * 상태는 셋이다.
 *  - 준비 전(기본): 어디를 조회해도 0 — 안개가 전혀 끼지 않는다. 마스크가
 *    만들어지는 동안 드라이독이 잠깐 물 색이 되는 것보다 안개가 늦게 나타나는
 *    편이 덜 틀려 보인다.
 *  - 전부 바다: 어디를 조회해도 1 — 막는 지형이 없는 씬.
 *  - 마스크: 격자 안은 마스크 값, 밖은 셰이더가 1 로 본다.
 *
 * 서명(signature)은 마스크를 만든 지도 구성이다. 같은 구성의 씬에 다시
 * 들어오면 다시 만들지 않고 그대로 쓴다.
 */

function constantTexture(value: number): DataTexture {
  const texture = new DataTexture(
    new Uint8Array([value]),
    1,
    1,
    RedFormat,
    UnsignedByteType,
  );
  texture.needsUpdate = true;
  return texture;
}

/** 어디를 조회해도 텍스처 중앙을 읽는 변환 — 상수 텍스처용. */
function setConstantTransform(target: Matrix3): void {
  target.set(0, 0, 0.5, 0, 0, 0.5, 0, 0, 1);
}

const notReadyTexture = constantTexture(SEA_REACH_DRY);
const allSeaTexture = constantTexture(SEA_REACH_WET);

function createTransform(): Matrix3 {
  const transform = new Matrix3();
  setConstantTransform(transform);
  return transform;
}

export const seaReachUniforms: {
  seaReachMask: { value: Texture };
  seaReachTransform: { value: Matrix3 };
} = {
  seaReachMask: { value: notReadyTexture },
  seaReachTransform: { value: createTransform() },
};

let publishedSignature: string | null = null;

function replaceTexture(next: Texture): void {
  const previous = seaReachUniforms.seaReachMask.value;
  seaReachUniforms.seaReachMask.value = next;
  if (
    previous !== next &&
    previous !== notReadyTexture &&
    previous !== allSeaTexture
  ) {
    previous.dispose();
  }
}

/**
 * 마스크를 올린다. `mask` 가 null 이면 "전부 바다" 다. 이전 마스크 텍스처는
 * 폐기한다.
 */
export function publishSeaReachMask(
  mask: SeaReachMask | null,
  signature: string,
): void {
  publishedSignature = signature;
  if (!mask) {
    replaceTexture(allSeaTexture);
    setConstantTransform(seaReachUniforms.seaReachTransform.value);
    return;
  }
  const texture = new DataTexture(
    mask.data,
    mask.width,
    mask.height,
    RedFormat,
    UnsignedByteType,
  );
  texture.colorSpace = NoColorSpace;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  replaceTexture(texture);
  const m = mask.transform;
  seaReachUniforms.seaReachTransform.value.set(
    m[0],
    m[1],
    m[2],
    m[3],
    m[4],
    m[5],
    m[6],
    m[7],
    m[8],
  );
}

/** 준비 전 상태로 되돌린다 — 안개가 전혀 끼지 않는다. */
export function resetSeaReachMask(): void {
  publishedSignature = null;
  replaceTexture(notReadyTexture);
  setConstantTransform(seaReachUniforms.seaReachTransform.value);
}

/** 지금 올라가 있는 마스크의 서명. 준비 전이면 null. */
export function getSeaReachSignature(): string | null {
  return publishedSignature;
}
