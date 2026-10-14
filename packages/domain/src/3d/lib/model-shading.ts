import type { SavedMapInfo } from '../model/types';
import { isContextMap } from './resolve-ground-map';

/**
 * 머티리얼 셰이딩 등급 — GLTF 를 씬에 올릴 때(useClonedModel) 원본 머티리얼을
 * 어느 변환본으로 바꿔 끼울지.
 *
 * - 'standard': GLTF 의 PBR 그대로(기본, 크레인 등 장비).
 * - 'lambert': PBR → Lambert(lib/lambert-material.ts). 관제와 무관한 컨텍스트
 *   지형용 — 조명·낮/밤에는 똑같이 반응하고 스펙큘러·환경맵 radiance
 *   샘플링만 없어 수 km 지형의 픽셀 비용이 준다.
 * - 'matte': PBR 유지, roughness 하한·metalness 0(lib/matte-material.ts).
 *   야드 지도 등 환경 객체용 — 안벽·도크·지붕이 태양과 하늘을 비추는
 *   눈부심을 없앤다. GLB 는 디자이너 기본값(roughness 0.5)을 들고 오고,
 *   일부는 metalness 1 이다.
 *
 * 어느 등급을 쓸지는 호출부가 아니라 아래 resolve* 가 정한다 — 모니터링과
 * 에디터가 같은 함수를 써야 저작 화면과 실제 화면이 같다.
 */
export type ModelShading = 'standard' | 'lambert' | 'matte';

/**
 * 지도의 셰이딩. 컨텍스트 지형(role 'context')은 Lambert, 그 외 지도(ground·
 * 역할 없음)는 무광이다. 지도는 전부 환경이라 모델처럼 장비/환경을 가르지
 * 않는다.
 */
export function resolveMapShading(
  map: Pick<SavedMapInfo, 'role'>,
): ModelShading {
  return isContextMap(map) ? 'lambert' : 'matte';
}
