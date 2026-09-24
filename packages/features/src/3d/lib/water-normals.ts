import { RepeatWrapping, type Texture } from 'three';

/**
 * 파도 노멀맵을 RepeatWrapping 으로 맞춘다. 바다 셰이더가 uv 를 월드 좌표
 * (수 km)로 샘플링하므로 반복이 아니면 가장자리 색이 늘어난다.
 *
 * lib 에 둔 이유: useLoader 가 돌려준 캐시 텍스처를 훅 반환값 그대로 변조하면
 * react-hooks/immutability 에 걸린다(applyEquirectBackground 선례). 멱등이라
 * 같은 텍스처에 여러 캔버스가 불러도 첫 호출만 갱신한다.
 *
 * @returns 바꿨는지 — true 면 호출자가 invalidate 해 재업로드된 텍스처로
 *   다음 프레임을 그린다.
 */
export function ensureRepeatWrapping(texture: Texture): boolean {
  if (texture.wrapS === RepeatWrapping && texture.wrapT === RepeatWrapping) {
    return false;
  }
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.needsUpdate = true;
  return true;
}
