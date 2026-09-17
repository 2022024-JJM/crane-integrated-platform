export type AxisKey = 'x' | 'y' | 'z';

/**
 * 모니터링 3D 뷰의 화면 종류 — 값 생산자·감지 러너·조작 UI 가 갈린다.
 * - simulation: 대시보드 3D 미리보기(가상 태그, 정지 상태로 연다)
 * - realtime: 실시간 모니터링(WebSocket 만)
 * - play3d: 3D 플레이 페이지(리플레이 | 시뮬레이션, 소스는 usePlay3dStore)
 */
export type MonitoringViewMode = 'simulation' | 'realtime' | 'play3d';

export type SceneTransformField = 'position' | 'rotation' | 'scale';
export type SceneTransformMode = 'translate' | 'rotate' | 'scale';
/** 기즈모 기준 축 — three TransformControls 의 `space` 와 같은 값. */
export type SceneTransformSpace = 'local' | 'world';
/**
 * 다중 선택 변형 기준점. individual = 각자 자기 원점(제자리 회전·크기),
 * primary = 프라이머리(마지막 Ctrl 클릭) 원점을 피벗으로 선택 전체를 강체처럼.
 */
export type SceneTransformPivot = 'individual' | 'primary';

export const AXIS_INDEX = {
  x: 0,
  y: 1,
  z: 2,
} as const;

export const TRANSFORM_FIELD_BY_MODE = {
  translate: 'position',
  rotate: 'rotation',
  scale: 'scale',
} as const satisfies Record<SceneTransformMode, SceneTransformField>;

export interface GenValue {
  key: string;
  value: number;
  min: number;
  max: number;
}

export interface ValueGeneratorConfig {
  values: GenValue[];
  interval: number;
}
