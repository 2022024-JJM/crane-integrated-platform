import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useState } from 'react';
import type { Color, PerspectiveCamera } from 'three';
import type { SceneViewport } from '@crane/domain/3d';
import {
  beginSplitInfoAccumulation,
  readCanvasBackgroundColor,
  renderSplitFrame,
} from '../lib/split-render';
import { TerrainLodController } from '../model/terrain-lod-controller';

/**
 * 분할 화면 렌더러 — 한 캔버스를 뷰포트(타일)마다 viewport·scissor 를 잡고
 * 타일 카메라로 그린다. `useFrame(…, 1)` 로 R3F 자동 렌더를 넘겨받으며,
 * 언마운트하면 자동 렌더가 돌아온다(단일 화면). 프레임의 실제 일은
 * lib/split-render.ts 다.
 *
 * - shadow map 은 첫 타일 렌더가 `needsUpdate` 를 소비해 그 프레임에 한 번만
 *   그려진다(온디맨드 규칙). frustum 초점은 SceneLighting 의 `shadowFocus`
 *   가 타일 합집합으로 고정한다.
 * - 바다 미러 패스는 `OceanWater.onBeforeRender` 가 그리는 카메라 기준이라
 *   타일마다 맞게 돈다(비용은 타일 수만큼).
 * - 지형·모델 LOD 는 자기 컨트롤러로 타일 카메라마다 다시 쓴다 — 가시성이
 *   씬에 하나뿐이라 그리기 직전에 덮어써야 한다.
 * - `gl.info` 는 마운트 동안 프레임 합산 모드다 — perf HUD(ScenePerfProbe,
 *   priority 0 이라 다음 프레임에 읽는다)가 타일 합(shadow pass 포함)을 본다.
 * - 태양·달 스프라이트와 밤하늘 돔은 기본 카메라 위치를 따른 채 둔다 — 각각
 *   20km·45km 거리라 타일 카메라가 몇 km 어긋나도 눈에 띄지 않는다.
 * - 빈 칸·간격 색은 테마의 `--canvas-background`(컨테이너 배경과 같은 토큰)를
 *   캔버스 요소에서 읽는다. 테마 전환(`<html>` 의 class)을 지켜보다 다시 읽는다.
 */
export function SceneSplitRenderer({
  viewports,
}: {
  viewports: readonly SceneViewport[];
}) {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const lod = useMemo(() => new TerrainLodController(), []);
  const [clearColor, setClearColor] = useState<Color>(() =>
    readCanvasBackgroundColor(gl.domElement),
  );

  // 테마가 바뀌면(<html> class 토글) 배경 토큰을 다시 읽는다.
  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setClearColor(readCanvasBackgroundColor(gl.domElement));
      invalidate();
    });
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [gl, invalidate]);

  useEffect(() => {
    const end = beginSplitInfoAccumulation(gl);
    invalidate();
    return () => {
      end();
      invalidate();
    };
  }, [gl, invalidate]);

  // 뷰포트(크기·카메라)가 바뀐 프레임을 바로 그린다 — 정지 씬은 틱이 없다.
  useEffect(() => {
    invalidate();
  }, [viewports, invalidate]);

  useFrame((state) => {
    const main = state.camera as PerspectiveCamera;
    renderSplitFrame({
      renderer: state.gl,
      scene: state.scene,
      viewports,
      width: state.size.width,
      height: state.size.height,
      fov: main.isPerspectiveCamera ? main.fov : 75,
      clearColor,
      lod,
    });
  }, 1);

  return null;
}
