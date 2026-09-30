import { useThree } from '@react-three/fiber';
import { createContext, useContext, type RefObject } from 'react';
import type { PerspectiveCamera } from 'three';

/**
 * 뷰포트 — 한 캔버스를 여러 카메라로 나눠 그릴 때(분할 화면) 타일 하나.
 *
 * drei `Html` 은 `useThree()` 의 camera·size 로 투영하고 DOM 을 캔버스 옆에
 * 붙이므로, 기본 카메라가 아닌 타일에서는 위치가 틀린다. 그래서 타일마다
 * R3F portal(state 의 camera·size 를 타일 것으로 바꿈)로 표시를 복제하고 DOM
 * 은 타일 컨테이너(`portal`)에 붙인다(ui/scene-viewports.tsx 의 PerViewport).
 * 어느 캔버스가 뷰포트를 제공하는지는 `SceneViewportsProvider` 가 정한다 —
 * 없으면(단일 화면) 표시는 평소처럼 한 번 그려진다.
 */
export interface SceneViewport {
  key: string;
  /** 타일 카메라. 같은 인스턴스를 렌더러가 제자리에서 갱신한다. */
  camera: PerspectiveCamera;
  /** 타일의 CSS px 크기·위치(캔버스 왼쪽 위 기준). drei Html 의 size. */
  size: { width: number; height: number; top: number; left: number };
  /** 타일의 DOM 컨테이너 — 이 뷰포트의 Html 이 붙는 곳. */
  portal: RefObject<HTMLElement | null>;
}

const SceneViewportsContext = createContext<readonly SceneViewport[] | null>(
  null,
);

export const SceneViewportsProvider = SceneViewportsContext.Provider;

/** 지금 캔버스의 뷰포트 목록. 단일 화면이면 null. */
export function useSceneViewports(): readonly SceneViewport[] | null {
  return useContext(SceneViewportsContext);
}

/**
 * 화면 픽셀 기준 계산(테두리 두께 등)이 볼 뷰포트 세로 CSS px — 분할이면 타일
 * 높이(타일은 전부 같은 높이), 아니면 캔버스 높이. Canvas 안에서만 부른다.
 */
export function useSceneViewportHeight(): number {
  const canvasHeight = useThree((s) => s.size.height);
  const viewports = useSceneViewports();
  return viewports?.[0]?.size.height ?? canvasHeight;
}
