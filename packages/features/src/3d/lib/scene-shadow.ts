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
