import { useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { ShaderMaterial } from 'three';
import { resolveCameraFov } from '@crane/core/lib/top-view-pose';
import { outlineOffsetFactor } from '../lib/silhouette-outline';
import { useSceneViewportHeight } from './scene-viewports-context';

/**
 * 인플레이션 헐 머티리얼의 `uOffsetFactor`(화면 px 두께 → 뷰 깊이 1 기준
 * 오프셋)를 이 캔버스의 뷰포트 높이와 카메라 fov 에 맞춘다. 실루엣 윤곽
 * (ui/object-silhouette-outline.tsx)과 평면도 숨은선 윤곽(ui/object-hidden-
 * line.tsx)이 같이 쓴다.
 *
 * 훅 의존성인 material 을 effect 에서 직접 변경하면 react-hooks/immutability
 * 에 걸리므로 uniform 객체만 ref 로 든다(scene-water 의 프레임 상태 ref 와
 * 같은 선례). material 이 바뀌면 첫 effect 가 ref 를 갈아 끼운다. 세로 px 는
 * 캔버스가 아니라 그리는 뷰포트 높이다 — 분할 화면은 타일 높이(전부 같다).
 * 직교 탑뷰 카메라는 userData 의 원근 fov 를 쓴다(같은 구도의 원근 높이에
 * 서 있다).
 */
export function useOutlineOffset(
  material: ShaderMaterial,
  thicknessPx: number,
): void {
  const heightPx = useSceneViewportHeight();
  const camera = useThree((s) => s.camera);
  const fov = resolveCameraFov(camera) ?? 60;
  const offsetUniformRef = useRef(material.uniforms.uOffsetFactor);
  useEffect(() => {
    offsetUniformRef.current = material.uniforms.uOffsetFactor;
  }, [material]);
  useEffect(() => {
    offsetUniformRef.current.value = outlineOffsetFactor(
      thicknessPx,
      fov,
      heightPx,
    );
  }, [material, thicknessPx, fov, heightPx]);
}
