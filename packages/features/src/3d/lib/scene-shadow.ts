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
 * Canvas `shadows` prop 값. 켤 때는 'soft'(PCFSoftShadowMap) — 기본
 * PCF(4탭)는 지도 전체를 덮는 큰 shadow camera에서 텍셀 계단이 그대로
 * 드러나는데, soft는 필터 탭을 늘려 같은 해상도에서도 경계가 부드럽다.
 * 세 화면이 같은 값을 쓰도록 여기서 한 번만 정의한다.
 */
export function sceneCanvasShadows(
  lighting: SavedLightingInfo | null | undefined,
): 'soft' | false {
  return isSceneShadowEnabled(lighting) ? 'soft' : false;
}
