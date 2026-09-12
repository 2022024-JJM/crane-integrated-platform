import { useEffect, useRef } from 'react';
import { useProgress } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import {
  Box3,
  OrthographicCamera,
  WebGLRenderTarget,
  type PerspectiveCamera,
  type Scene,
  type WebGLRenderer,
} from 'three';
import {
  modelObjectRegistry,
  resolveCameraBoundsMaps,
  unionObjectBounds,
  type SavedSceneInfo,
} from '@crane/domain/3d';
import { computeMinimapFrame, type MinimapFrame } from '../lib/minimap';
import {
  autoExposure,
  meanLinearLuminance,
  toDisplayPixels,
} from '../lib/minimap-image';
import {
  minimapCameraInfo,
  useSceneMinimapStore,
} from '../model/use-scene-minimap-store';

/**
 * 미니맵 탑뷰 스냅샷 — Canvas 안 null 렌더 컴포넌트.
 *
 * 씬이 준비되면(Suspense resolve + 로더 idle) 기준 지도들(카메라 영역 제한과
 * 같은 resolveCameraBoundsMaps 합집합)을 직교 카메라로 한 번 내려다보며 렌더
 * 타깃에 그리고, 픽셀을 읽어 2D 캔버스 이미지로 만들어 스토어에 둔다. 장비는
 * 스냅샷 시점의 자세로 굳지만 미니맵이 그 위에 실시간 마커를 따로 찍으므로
 * 배경 용도로 충분하다. 다시 찍는 때: 기준 지도 목록이 바뀔 때, 수동 새로
 * 고침(스토어 captureRequest). 낮/밤은 자동 노출(lib/minimap-image)이 보정한다.
 *
 * 렌더는 useFrame 안에서 한다 — 그 시점엔 씬의 matrixWorld 가 이 프레임
 * 기준으로 갱신돼 있고, R3F 는 useFrame 뒤에 메인 프레임을 그리므로 렌더
 * 타깃 전환을 되돌려 두기만 하면 화면에 영향이 없다. demand 루프라 캡처를
 * 무장(arm)할 때 invalidate 로 프레임 하나를 요청한다.
 *
 * 렌더 타깃에 스텐실 버퍼가 **꼭** 있어야 한다: 바다 평면은 깊이 대신
 * "불투명 씬이 그려졌다" 스텐실 비트가 없는 픽셀에만 그려지는데(scene-stencil
 * .ts), 스텐실 없는 프레임버퍼에선 스텐실 테스트가 항상 통과라 바다가 야드
 * 위를 덮어 버린다. MSAA(samples)는 쓰지 않는다 — 멀티샘플 타깃의 readback
 * 은 resolve 경로가 따로 필요하고 미니맵 해상도에선 이득이 없다.
 *
 * 그림자는 shadowMap.autoUpdate=false 라 메인 카메라 기준의 마지막 맵이 그대로
 * 쓰인다 — 탑뷰에선 일부만 맞지만 미니맵에서 티가 나지 않는다. 셰이더
 * 재컴파일이 따르는 shadowMap.enabled 토글은 하지 않는다.
 *
 * 매 프레임엔 카메라 fov·종횡비만 mutable 로 써 둔다(미니맵의 발자국 부채꼴
 * 폭). 스토어 갱신(setSnapshot)은 캡처가 끝난 그 한 프레임뿐이라 프레임 속도
 * setState 금지 규약과 충돌하지 않는다.
 */

/** 스냅샷 긴 변 픽셀. 미니맵 표시 폭(224 CSS px)의 2배 남짓 — DPR 2 대응. */
const SNAPSHOT_MAX_PX = 512;
/** 직교 카메라를 지도 최고점 위 이만큼 띄운다(m) — 골리앗 높이(~130m) 여유. */
const CAMERA_CLEARANCE_ABOVE = 400;
/** 지도 최저점 아래로 보는 깊이(m) — 바다·드라이독 바닥. */
const CAMERA_DEPTH_BELOW = 200;

interface SceneMinimapCaptureProps {
  sceneInfo: SavedSceneInfo | null;
  /** 씬 Suspense 가 resolve 됐는지(SceneReadyProbe 신호). */
  ready: boolean;
}

export function SceneMinimapCapture({
  sceneInfo,
  ready,
}: SceneMinimapCaptureProps) {
  const assetsActive = useProgress((s) => s.active);
  const captureRequest = useSceneMinimapStore((s) => s.captureRequest);
  const setSnapshot = useSceneMinimapStore((s) => s.setSnapshot);
  const invalidate = useThree((s) => s.invalidate);
  const boundsMaps = resolveCameraBoundsMaps(sceneInfo?.maps);
  const boundsKey = boundsMaps.map((m) => m.id).join('|');
  const pendingRef = useRef(false);
  const boundsMapsRef = useRef(boundsMaps);

  // 캡처 무장 — 준비 조건이 갖춰지거나 기준 지도·새로 고침 요청이 바뀔 때.
  // useFrame 이 읽을 기준 지도 목록도 여기서 갱신한다(렌더 중 ref 쓰기 금지).
  useEffect(() => {
    boundsMapsRef.current = boundsMaps;
    if (!ready || assetsActive) return;
    pendingRef.current = true;
    invalidate();
    // boundsMaps 는 boundsKey 가 같으면 같은 지도 목록이다(id 로 판정).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, assetsActive, boundsKey, captureRequest, invalidate]);

  // 화면을 떠나면 스냅샷을 비운다 — 다른 리전의 미니맵이 옛 이미지를 잠깐
  // 보이지 않게.
  useEffect(() => () => setSnapshot(null), [setSnapshot]);

  useFrame(({ gl, scene, camera }) => {
    const perspective = camera as PerspectiveCamera;
    if (perspective.isPerspectiveCamera) {
      minimapCameraInfo.fovDeg = perspective.fov;
      minimapCameraInfo.aspect = perspective.aspect;
    }
    if (!pendingRef.current) return;

    const bounds = unionObjectBounds(
      boundsMapsRef.current.map((m) => modelObjectRegistry.get(m.id)),
    );
    if (!bounds) {
      // 기준 지도가 아직 등록 전 — 다음 프레임에 다시 본다.
      invalidate();
      return;
    }
    const frame = computeMinimapFrame(bounds, SNAPSHOT_MAX_PX);
    if (!frame) {
      pendingRef.current = false;
      return;
    }
    pendingRef.current = false;
    const image = captureTopView(gl, scene, frame, bounds);
    if (image) {
      setSnapshot({ image, frame, capturedAt: Date.now() });
    }
  });

  return null;
}

function captureTopView(
  gl: WebGLRenderer,
  scene: Scene,
  frame: MinimapFrame,
  bounds: Box3,
): HTMLCanvasElement | null {
  const { pxWidth: width, pxHeight: height } = frame;
  const centerX = frame.minX + frame.worldWidth / 2;
  const centerZ = frame.minZ + frame.worldDepth / 2;
  const top = bounds.max.y + CAMERA_CLEARANCE_ABOVE;
  const bottom = bounds.min.y - CAMERA_DEPTH_BELOW;

  // 기저는 lib/minimap.ts 의 좌표 규약 주석 — up=(0,0,-1) 로 내려다보면
  // 로컬 +x = 월드 +X, 로컬 +y = 월드 −Z 라 이미지 위쪽이 minZ 가 된다.
  const camera = new OrthographicCamera(
    -frame.worldWidth / 2,
    frame.worldWidth / 2,
    frame.worldDepth / 2,
    -frame.worldDepth / 2,
    1,
    top - bottom + 1,
  );
  camera.position.set(centerX, top, centerZ);
  camera.up.set(0, 0, -1);
  camera.lookAt(centerX, bottom, centerZ);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);

  const target = new WebGLRenderTarget(width, height, {
    depthBuffer: true,
    stencilBuffer: true,
  });
  const previousTarget = gl.getRenderTarget();
  const pixels = new Uint8Array(width * height * 4);
  try {
    gl.setRenderTarget(target);
    gl.clear(true, true, true);
    gl.render(scene, camera);
    gl.readRenderTargetPixels(target, 0, 0, width, height, pixels);
  } catch (error) {
    console.warn('[scene-minimap] 탑뷰 스냅샷 실패', error);
    return null;
  } finally {
    gl.setRenderTarget(previousTarget);
    target.dispose();
  }

  const display = toDisplayPixels(
    pixels,
    width,
    height,
    autoExposure(meanLinearLuminance(pixels)),
  );
  if (!display) return null;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.putImageData(new ImageData(display, width, height), 0, 0);
  return canvas;
}
