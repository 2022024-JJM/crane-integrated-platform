import type { SkyPhase } from '../lib/sky-lighting';

/**
 * SceneLighting 이 solar 모드에서 매 프레임 계산한 하늘 국면 — 미니맵 캡처가
 * "낮/박명/밤·작업등이 바뀌었으니 배경을 다시 찍자" 를 판단하는 데 읽는다.
 * useFrame 에서 쓰고 다른 useFrame 이 읽는 mutable 값이라 React 상태로 두지
 * 않는다(프레임 속도 setState 금지).
 *
 * solar 조명이 아닌 씬(현장 위치가 없는 region·manual 태양)은 `skyPhase`
 * 가 null 이고, 그때 읽는 쪽은 재캡처하지 않는다.
 */
export const sceneLightingInfo: {
  skyPhase: SkyPhase | null;
  /** 태양 고도(도). 박명 구간의 밝기 버킷용. */
  sunElevation: number;
  yardLights: boolean;
} = {
  skyPhase: null,
  sunElevation: 0,
  yardLights: true,
};
