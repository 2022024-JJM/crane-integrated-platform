import type { Object3D } from 'three';

/**
 * "렌더 전용 오버레이 메시" 표식.
 *
 * 실루엣 테두리(마스크·헐)는 `createPortal` 로 **대상 메시의 자식**으로 붙는다
 * (object-silhouette-outline). 둘 다 position 속성이 있는 평범한 `Mesh` 이고
 * visible 이라, 표식이 없으면 씬 순회가 이들을 실제 씬 콘텐츠로 착각한다.
 * 충돌 감지에서 실측된 결함이 그것이다 — 마스크는 대상 지오메트리를 그대로
 * 재사용해 **같은 메시가 두 번** 수집되고, 헐은 BVH 를 붙이지 않는 스무딩
 * 사본이라 삼각형 판정이 영영 "판정 불가" 를 답해 그 쌍이 재시도 주기마다
 * 다시 큐에 들어간다.
 *
 * 표식을 `userData` 에 두는 이유: three 의 `Mesh` 를 상속하지 않고 붙일 수
 * 있는 유일한 자리이고, 오버레이를 만드는 코드(domain/3d/lib)와 읽는 코드
 * (충돌 프리미티브·향후 씬 순회)가 서로를 import 하지 않아도 된다.
 *
 * 새 오버레이 메시를 씬 그래프에 붙이는 코드를 만들면 여기를 통과시킨다.
 */

const OVERLAY_FLAG = 'craneOverlayMesh';

export function markOverlayMesh(object: Object3D): void {
  object.userData[OVERLAY_FLAG] = true;
}

export function isOverlayMesh(object: Object3D): boolean {
  return object.userData[OVERLAY_FLAG] === true;
}
