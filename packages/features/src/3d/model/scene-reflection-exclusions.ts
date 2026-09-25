import type { Object3D } from 'three';

/**
 * 바다 미러 패스에서 숨길 객체의 등록부 — 밤하늘 틴트 돔·태양/달 스프라이트.
 *
 * 돔은 메인 패스에서 이미 물 픽셀을 덮으므로 반사 RT 에도 그리면 이중 틴트
 * + 톤매핑 회색화가 생기고, 스프라이트는 메인 카메라 기준 위치라 미러에서
 * 어긋난다. SceneLighting 이 생성 effect 에서 등록하고 cleanup 에서 해제하며,
 * SceneWater 의 excludedObjects 게터가 매 패스 읽는다. 미니맵 캡처
 * (ui/scene-minimap-capture.tsx)도 같은 객체를 캡처 동안 숨긴다 — 돔은
 * 카메라를 감싸는 구라 직교 캡처 전체를 틴트한다. 컨텍스트 지형은 여기가
 * 아니라 lib/water-reflection 의 id 판정 + modelObjectRegistry 조회다.
 *
 * 모듈 레벨 Set 인 이유: 조명과 물은 같은 캔버스의 형제 컴포넌트라 prop 으로
 * 잇기 어렵고, 프레임 속도로 읽히는 값이라 React 상태로 두지 않는다
 * (sceneLightingInfo 와 같은 사정). 캔버스가 여럿이어도 각 캔버스의 물은
 * 자기 씬에 없는 객체를 숨겨도 무해하다(visible 토글은 그 객체에만 닿는다).
 */
const exclusions = new Set<Object3D>();

/**
 * 등록하고 해제 함수를 돌려준다. 같은 객체를 다시 등록해도 하나이고, 해제
 * 함수는 두 번 불러도 무해하다.
 */
export function excludeFromReflection(object: Object3D): () => void {
  exclusions.add(object);
  return () => {
    exclusions.delete(object);
  };
}

export function getReflectionExclusions(): ReadonlySet<Object3D> {
  return exclusions;
}

/** 테스트 전용 — 모듈 상태를 비운다. 런타임 코드에서 부르지 않는다. */
export function clearReflectionExclusions(): void {
  exclusions.clear();
}
