import { useEffect, useRef } from 'react';
import { useProgress } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import {
  Box3,
  FloatType,
  OrthographicCamera,
  UnsignedByteType,
  Vector3,
  WebGLRenderTarget,
  type Object3D,
  type Scene,
  type WebGLRenderer,
} from 'three';
import {
  modelObjectRegistry,
  resolveCameraBoundsMaps,
  SCENE_SUN_AZIMUTH_DEFAULT,
  SCENE_SUN_ELEVATION_DEFAULT,
  unionObjectBounds,
  type SavedSceneInfo,
} from '@crane/domain/3d';
import { computeMinimapFrame, type MinimapFrame } from '../lib/minimap';
import {
  applyCanonicalCaptureLighting,
  applyCanonicalWaterUniforms,
} from '../lib/minimap-capture-lighting';
import { toDisplayPixels, toLinearFloatPixels } from '../lib/minimap-image';
import { isOceanWater } from '../lib/ocean-water';
import { sunDirectionFromAngles } from '../lib/sun-direction';
import { getReflectionExclusions } from '../model/scene-reflection-exclusions';
import { useSceneMinimapStore } from '../model/use-scene-minimap-store';

/**
 * 미니맵 탑뷰 스냅샷 — Canvas 안 null 렌더 컴포넌트.
 *
 * 씬이 준비되면(Suspense resolve + 로더 idle) 기준 지도들(카메라 영역 제한과
 * 같은 resolveCameraBoundsMaps 합집합)을 직교 카메라로 한 번 내려다보며 렌더
 * 타깃에 그리고, 픽셀을 읽어 2D 캔버스 이미지로 만들어 스토어에 둔다. 장비는
 * 스냅샷 시점의 자세로 굳지만 미니맵이 그 위에 실시간 마커를 따로 찍으므로
 * 배경 용도로 충분하다. 다시 찍는 때는 기준 지도 목록이나 씬의 수동 태양
 * 각도(에디터에서 바꿀 때)가 바뀔 때뿐이다.
 *
 * 렌더는 useFrame 안에서 한다 — 그 시점엔 씬의 matrixWorld 가 이 프레임
 * 기준으로 갱신돼 있고, R3F 는 useFrame 뒤에 메인 프레임을 그리므로 렌더
 * 타깃 전환을 되돌려 두기만 하면 화면에 영향이 없다. demand 루프라 캡처를
 * 무장(arm)할 때 invalidate 로 프레임 하나를 요청한다.
 *
 * 조명은 캡처 순간만 **기준(수동 모드) 값**으로 바꾼다(lib/minimap-capture-
 * lighting applyCanonicalCaptureLighting — 키 방향광을 씬의 수동 태양 방향·
 * 백색·기준 세기로, 환경광 백색·기준 세기, 밤 전용 조명 0, 그림자
 * `shadow.intensity` 0, 환경맵 기준 세기, renderer 의 shadowMap
 * autoUpdate/needsUpdate 를 캡처 동안 끔). 미니맵이 3D 화면의 기본 룩과 같은
 * 색으로 나오고 solar 모드의 시각·날씨·그림자와 무관해 같은 씬은 언제 찍어도
 * 같은 이미지다. 전부 유니폼 변경이라 셰이더 재컴파일이 없다(visible·
 * castShadow·shadowMap.enabled 는 건드리지 않는다).
 *
 * 렌더 타깃은 **Float** 이다 — 8bit 선형 RT 는 어두운 값이 양자화돼 sRGB 로
 * 펴면 띠·색 편향이 생긴다. readback 은 선형·비톤매핑이라(three 는 RT 에
 * 톤매핑을 걸지 않는다) lib/minimap-image 가 three 와 동일한 ACESFilmic →
 * sRGB 를 픽셀마다 적용한다. WebGL2 에서 Float 컬러 첨부는
 * EXT_color_buffer_float, 반투명 블렌딩은 EXT_float_blend 가 필요하다
 * (데스크톱 브라우저는 전부 지원). three 는 프레임버퍼 완성 여부를 검사하지
 * 않아 확장이 없으면 검은 스냅샷이 조용히 남으므로, 둘 중 하나라도 없으면
 * 8bit 로 폴백해 찍는다(toLinearFloatPixels 가 0~1 로 편다 — 1.0 위가 잘리고
 * 어두운 값이 양자화되지만 배경을 잃는 것보다 낫다).
 *
 * 렌더 타깃에 스텐실 버퍼가 **꼭** 있어야 한다: 실루엣 마스크/헐(충돌
 * 하이라이트 중 캡처)이 자기 스텐실 비트로 발자국을 거르는데(silhouette-
 * outline.ts), 스텐실 없는 프레임버퍼에선 테스트가 항상 통과라 헐이 모델
 * 위를 덩어리로 덮는다. MSAA(samples)는 쓰지 않는다 — 멀티샘플 타깃의
 * readback 은 resolve 경로가 따로 필요하고 미니맵 해상도에선 이득이 없다.
 *
 * 바다(OceanWater)는 **보이는 채로** 그린다 — 바다 색이 물 자신의 셰이더
 * (waterColor 산란 + 태양 확산)에서 나와 3D 화면과 같다. 직교 카메라엔 미러
 * 패스가 없어 반사 RT 에 낡은 원근 프레임이 남으므로 캡처 동안만
 * applyCanonicalWaterUniforms 로 `reflectionIntensity` 0, 태양 방향·색을
 * 기준 조명과 같게 둔다. 밤하늘 틴트 돔·태양/달 스프라이트(바다 반사 제외
 * 등록부와 같은 객체)만 숨긴다 — 돔은 카메라를 감싸 캡처 전체를 틴트한다.
 * 바다 영역은 물 원판(반경 수십 km)이 덮으므로 clear color 는 손대지 않고,
 * 바다 없는 씬은 검정 배경이다.
 *
 * useFrame 은 캡처가 무장된 프레임에만 일한다. 스토어 갱신(setSnapshot)은
 * 캡처가 끝난 그 한 프레임뿐이라 프레임 속도 setState 금지 규약과 충돌하지
 * 않는다.
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
  const setSnapshot = useSceneMinimapStore((s) => s.setSnapshot);
  const invalidate = useThree((s) => s.invalidate);
  const boundsMaps = resolveCameraBoundsMaps(sceneInfo?.maps);
  const boundsKey = boundsMaps.map((m) => m.id).join('|');
  // 기준 태양 = 씬의 수동 태양(SceneLighting 의 manual 모드와 같은 식).
  // solar 씬도 저장된 수동 각도를 쓴다 — 시각과 무관한 기준이 목적이다.
  const sunAzimuth =
    sceneInfo?.lighting?.sunAzimuth ?? SCENE_SUN_AZIMUTH_DEFAULT;
  const sunElevation =
    sceneInfo?.lighting?.sunElevation ?? SCENE_SUN_ELEVATION_DEFAULT;
  const pendingRef = useRef(false);
  const boundsMapsRef = useRef(boundsMaps);
  const sunDirectionRef = useRef<Vector3>(new Vector3(0, 1, 0));

  // 캡처 무장 — 준비 조건이 갖춰지거나 기준 지도·수동 태양 각도가 바뀔 때.
  // useFrame 이 읽을 기준 지도 목록·태양 방향도 여기서 갱신한다(렌더 중 ref
  // 쓰기 금지).
  useEffect(() => {
    boundsMapsRef.current = boundsMaps;
    sunDirectionRef.current = sunDirectionFromAngles(sunAzimuth, sunElevation);
    if (!ready || assetsActive) return;
    pendingRef.current = true;
    invalidate();
    // boundsMaps 는 boundsKey 가 같으면 같은 지도 목록이다(id 로 판정).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, assetsActive, boundsKey, sunAzimuth, sunElevation, invalidate]);

  // 화면을 떠나면 스냅샷을 비운다 — 다른 리전의 미니맵이 옛 이미지를 잠깐
  // 보이지 않게.
  useEffect(() => () => setSnapshot(null), [setSnapshot]);

  useFrame(({ gl, scene }) => {
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
    const image = captureTopView(
      gl,
      scene,
      frame,
      bounds,
      sunDirectionRef.current,
    );
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
  sunDirection: Vector3,
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

  // Float 첨부·블렌딩 확장이 없으면 8bit 폴백(파일 상단 주석).
  const floatCapable =
    gl.extensions.has('EXT_color_buffer_float') &&
    gl.extensions.has('EXT_float_blend');
  const target = new WebGLRenderTarget(width, height, {
    type: floatCapable ? FloatType : UnsignedByteType,
    depthBuffer: true,
    stencilBuffer: true,
  });
  const previousTarget = gl.getRenderTarget();
  const pixels = floatCapable
    ? new Float32Array(width * height * 4)
    : new Uint8Array(width * height * 4);
  /** 캡처 동안 숨긴 객체(틴트 돔·스프라이트) — finally 에서 되켠다. */
  const hidden: Object3D[] = [];
  /** 캡처 동안 바꾼 바다 유니폼의 원복 함수들. */
  const waterRestores: Array<() => void> = [];
  let restoreLighting: (() => void) | null = null;
  try {
    scene.traverse((object) => {
      if (isOceanWater(object) && object.visible) {
        waterRestores.push(applyCanonicalWaterUniforms(object, sunDirection));
      }
    });
    // 밤하늘 틴트 돔은 카메라를 감싸는 BackSide 구라 직교 카메라도 그 안에
    // 있어 캡처 전체를 남색으로 덮는다. 바다 반사 제외 등록부와 같은 객체다.
    for (const object of getReflectionExclusions()) {
      if (object.visible) {
        object.visible = false;
        hidden.push(object);
      }
    }
    restoreLighting = applyCanonicalCaptureLighting(scene, gl, sunDirection);
    gl.setRenderTarget(target);
    gl.clear(true, true, true);
    gl.render(scene, camera);
    gl.readRenderTargetPixels(target, 0, 0, width, height, pixels);
  } catch (error) {
    console.warn('[scene-minimap] 탑뷰 스냅샷 실패', error);
    return null;
  } finally {
    restoreLighting?.();
    for (const restore of waterRestores) restore();
    for (const object of hidden) object.visible = true;
    gl.setRenderTarget(previousTarget);
    target.dispose();
  }

  const display = toDisplayPixels(
    toLinearFloatPixels(pixels),
    width,
    height,
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
