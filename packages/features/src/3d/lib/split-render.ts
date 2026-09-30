import {
  Color,
  type PerspectiveCamera,
  type Scene,
  type WebGLRenderer,
} from 'three';
import type { SceneViewport } from '@crane/domain/3d';
import type { TerrainLodController } from '../model/terrain-lod-controller';
import { toGlViewport } from './split-rects';

/**
 * 분할 화면의 프레임 렌더 — ui/scene-split-renderer.tsx 가 useFrame 에서
 * 부른다. renderer·카메라(뷰포트 prop) 변조를 컴포넌트 밖 함수로 뺀 것은
 * scene-render-preset 의 enableOnDemandShadows 와 같은 이유다(훅 값 불변
 * 규칙).
 */

/**
 * `gl.info` 를 프레임 합산 모드로 — autoReset 을 끄고 프레임 시작에 리셋한다.
 * 그래야 perf HUD 가 마지막 타일이 아니라 프레임 전체(타일 합, shadow pass
 * 포함)를 본다. 돌아온 함수가 원래 모드로 되돌린다.
 */
export function beginSplitInfoAccumulation(gl: WebGLRenderer): () => void {
  const previousAutoReset = gl.info.autoReset;
  gl.info.autoReset = false;
  return () => {
    gl.info.autoReset = previousAutoReset;
    gl.info.reset();
    gl.setScissorTest(false);
  };
}

/** 캔버스 배경 토큰 — 컨테이너(`bg-(--canvas-background)`)와 같은 변수. */
export const CANVAS_BACKGROUND_CSS_VAR = '--canvas-background';

/**
 * 빈 칸·타일 사이 간격을 채울 색 — 캔버스 요소에 적용된 테마의
 * `--canvas-background` 를 읽는다(컨테이너 배경과 같은 색이라 이어져 보인다).
 * 값이 없거나 파싱이 안 되면 검정.
 */
export function readCanvasBackgroundColor(element: Element): Color {
  const raw = getComputedStyle(element)
    .getPropertyValue(CANVAS_BACKGROUND_CSS_VAR)
    .trim();
  const color = new Color(0x000000);
  if (raw.length > 0) {
    try {
      color.set(raw);
    } catch {
      color.set(0x000000);
    }
  }
  return color;
}

const _previousClearColor = new Color();

export interface SplitFrameArgs {
  renderer: WebGLRenderer;
  scene: Scene;
  viewports: readonly SceneViewport[];
  /** 빈 칸·간격 색(`readCanvasBackgroundColor`). */
  clearColor: Color;
  /** 캔버스 CSS px 크기. */
  width: number;
  height: number;
  /** 타일 카메라에 맞출 세로 fov(기본 카메라와 같게). */
  fov: number;
  lod: TerrainLodController;
}

/**
 * 프레임 하나: 캔버스 전체를 한 번 지우고(타일 사이 간격이 이전 프레임 잔상으로
 * 남지 않게), 타일마다 카메라 종횡비·fov 를 맞추고 LOD 를 그 카메라 기준으로
 * 다시 쓴 뒤 viewport·scissor 를 타일 사각형으로 두고 그린다. 끝나면 캔버스
 * 전체로 되돌린다. 타일 사각형은 DOM 오버레이가 잰 값이라 캔버스 크기와
 * 소수점이 다를 수 있어 캔버스 안으로 자른다.
 *
 * 지우기 전에 clear 색을 명시한다 — GL 의 clear 색 상태는 마지막으로 그린
 * 패스가 남긴 값이다. shadow pass 가 흰색으로 두고 가고, 텍스처 배경(EXR)은
 * three 가 clear 색을 되돌리지 않아 그대로 두면 빈 칸이 흰색이 된다. 렌더러의
 * clear 색은 프레임 뒤 원래대로 돌려 단일 화면(배경 없는 씬)이 바뀌지 않게 한다.
 */
export function renderSplitFrame({
  renderer,
  scene,
  viewports,
  width,
  height,
  fov,
  clearColor,
  lod,
}: SplitFrameArgs): void {
  const dpr = renderer.getPixelRatio();

  renderer.info.reset();
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, width, height);
  renderer.getClearColor(_previousClearColor);
  const previousClearAlpha = renderer.getClearAlpha();
  renderer.setClearColor(clearColor, 1);
  renderer.clear(true, true, true);
  renderer.setClearColor(_previousClearColor, previousClearAlpha);
  renderer.setScissorTest(true);

  for (const viewport of viewports) {
    const rect = viewport.size;
    if (rect.width <= 0 || rect.height <= 0) continue;
    const camera: PerspectiveCamera = viewport.camera;
    const aspect = rect.width / rect.height;
    if (camera.fov !== fov || camera.aspect !== aspect) {
      camera.fov = fov;
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld();
    lod.apply(viewport.key, camera, rect.height * dpr);

    const glRect = toGlViewport(
      {
        x: rect.left,
        y: rect.top,
        width: Math.min(rect.width, Math.max(0, width - rect.left)),
        height: Math.min(rect.height, Math.max(0, height - rect.top)),
      },
      height,
    );
    renderer.setViewport(glRect.x, glRect.y, glRect.width, glRect.height);
    renderer.setScissor(glRect.x, glRect.y, glRect.width, glRect.height);
    renderer.render(scene, camera);
  }

  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, width, height);
  renderer.setScissor(0, 0, width, height);
}
