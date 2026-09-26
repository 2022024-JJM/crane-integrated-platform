import type { SavedLightingInfo } from '@crane/domain/3d';

/**
 * Canvas `shadows` prop 판정 — 세 화면(에디터·모니터링·리플레이)이 같은
 * 기준을 쓰도록 여기서 한 번만 정의한다. 조명 컴포넌트(SceneLighting,
 * scene-render-preset.tsx)의 castShadow도 같은 판정을 쓴다.
 *
 * ui가 아닌 lib에 있는 이유: scene-render-preset.tsx는 컴포넌트 파일이라
 * 함수 export가 react-refresh(HMR) 규칙에 걸린다.
 */
export function isSceneShadowEnabled(
  lighting: SavedLightingInfo | null | undefined,
): boolean {
  return lighting?.shadows === true;
}

/**
 * Canvas `shadows` prop 값. 켤 때는 'percentage'(PCFShadowMap) — 세 화면이
 * 같은 값을 쓰도록 여기서 한 번만 정의한다.
 *
 * 'soft'·true(PCFSoftShadowMap)를 쓰지 않는다. three r183 은 PCFSoft 를
 * 폐기해 첫 shadow pass 에서 PCF 로 바꾸는데, R3F 는 Canvas 가 재렌더될
 * 때마다 타입을 PCFSoft 로 되돌린다. 그 사이(shadow pass 전)에 컴파일된
 * 셰이더는 PCFSoft 의 define 이 없어 BASIC 변형(`sampler2D`)이 되고, 비교
 * 모드 깊이 텍스처를 그 샘플러로 읽는 드로우를 WebGL 이 버린다 — 그림자
 * 패스를 막고 첫 프레임에 찍는 미니맵 캡처에서 그림자 받는 지도·모델이
 * 통째로 빠졌다. 화면 결과는 어차피 PCF 라 룩은 같다.
 */
export function sceneCanvasShadows(
  lighting: SavedLightingInfo | null | undefined,
): 'percentage' | false {
  return isSceneShadowEnabled(lighting) ? 'percentage' : false;
}
