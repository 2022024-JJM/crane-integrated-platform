import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  Box3,
  Object3D,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three';
import type { AmbientLight, DirectionalLight, Scene } from 'three';
import {
  SCENE_SUN_AZIMUTH_DEFAULT,
  SCENE_SUN_ELEVATION_DEFAULT,
  getSceneSiteGeo,
  invalidateShadows,
  modelObjectRegistry,
  registerShadowRenderer,
  resolveCameraBoundsMaps,
  unregisterShadowRenderer,
} from '@crane/domain/3d';
import type { SavedSceneInfo, SceneSiteGeo } from '@crane/domain/3d';
import { isSceneShadowEnabled } from '../lib/scene-shadow';
import { sunDirectionFromAngles } from '../lib/sun-direction';
import {
  SCENE_ENVIRONMENT_INTENSITY,
  SCENE_LIGHTING_BASE,
  type RgbTuple,
} from '../lib/sky-lighting';
import {
  KEY_LIGHT_ELEVATION_MIN,
  resolveSolarLighting,
  type SolarLightingSnapshot,
} from '../lib/solar-lighting';
import {
  createMoonTexture,
  createSunGlowTexture,
} from '../lib/celestial-glow-texture';
import {
  createReplayTimeCache,
  readSceneTimeMs,
  type SceneTimeSource,
} from '../model/scene-time-source';
import { useSceneClockStore } from '../model/use-scene-clock-store';
import { clampToRange } from '@crane/core/lib/utils';
import type { Vector3Tuple } from '@crane/core/types/math';

/**
 * 씬 렌더링 공통 설정 — 에디터·모니터링·리플레이가 **같은 화면**을 그리게 하는
 * 단일 소스.
 *
 * 예전에는 세 곳이 각자 gl 옵션과 조명을 복붙해 갖고 있었고, 그러다 값이
 * 어긋났다. 에디터가 `intensity={5}`, 뷰어 둘이 `intensity={4}`여서 에디터가
 * 약 25% 밝게 보였다 — 즉 **에디터에서 맞춘 조명이 실제 화면과 달랐다.**
 * 저작 도구가 결과와 다른 그림을 보여주면 저작 자체를 신뢰할 수 없다.
 *
 * 여기 값을 바꾸면 세 화면이 함께 바뀐다. 한쪽만 손대지 말 것.
 */

/**
 * 카메라 near/far.
 *
 * far: 기본값(1000)이면 줌 아웃 시 카메라-타깃 거리가 1000을 넘는 순간
 *   지도 중앙부터 잘려나간다. 최대 궤도 반경(camera-limits.ts
 *   CAMERA_MAX_DISTANCE 30000) + 씬 반폭보다 커야 잘림이 없다. 바다 평면
 *   (scene-environment.tsx SeaSurface, 반경 40000)이 들어오면서 50000으로
 *   올렸다 — 원판이 far에 잘리면 잘린 경계가 직선으로 드러나므로 원판
 *   반경보다 커야 한다.
 * near: 0.1(three 기본)을 쓴다. 에디터만 0.5를 쓰고 있었는데, near를 올리면
 *   깊이 정밀도는 좋아지지만 카메라에 바짝 붙은 지오메트리가 잘려 보인다 —
 *   뷰어와 다른 값을 쓸 이유가 없다.
 * 깊이 정밀도: 선형 깊이라면 near 0.1 기준 분해능이 거리 제곱으로 나빠져
 *   400m부터 philly 지도의 코플레이너 레이어 간격(8.8cm)을 못 가르지만,
 *   SCENE_GL_OPTIONS의 logarithmicDepthBuffer가 이를 대신 해결한다 — near/far는
 *   이제 클리핑 범위로만 고르면 된다.
 */
export const SCENE_CAMERA_CLIP = { near: 0.1, far: 50000 } as const;

/**
 * 캔버스 픽셀 비율 상한.
 *
 * Retina(DPR 2~3)에서 네이티브로 그리면 프래그먼트 수가 1.8~4배로 늘어
 * 지도급 씬(philly 지도 42만 삼각형)에서 프레임 예산을 다 먹는다. 1.5는
 * 골리앗 충돌가드 모드에서 먼저 검증된 값 — 라벨은 DOM(Html)이라 텍스트
 * 선명도와 무관하고, MSAA(antialias)가 켜져 있어 엣지도 깨끗하다.
 *
 * ThreeSceneViewer(@crane/ui)의 기본값도 같은 [1, 1.5]다 — 그 패키지는
 * features를 참조할 수 없어(SCENE_CAMERA_CLIP과 같은 사정) 리터럴로 들고
 * 있다. 여기 값을 바꾸면 three-scene-viewer.tsx의 기본값도 같이 바꿀 것.
 */
export const SCENE_DEFAULT_DPR = [1, 1.5] as const;

/**
 * WebGLRenderer 옵션.
 *
 * toneMapping: 예전에는 NoToneMapping(0)이었다. 강한 광량과 겹쳐 하이라이트가
 *   전부 흰색으로 뭉개졌고("납작한 룩"의 주범), HDR 환경맵을 도입해도 계조가
 *   살지 않았다. ACESFilmic은 밝은 쪽을 부드럽게 말아 넣어 금속 하이라이트와
 *   하늘의 계조를 함께 살린다. 대신 전체가 어두워지므로 조명·노출을 같이
 *   재보정했다(SCENE_LIGHTING / SCENE_TONE_EXPOSURE 주석 참고).
 */
/**
 * R3F Canvas 기본 raycaster 옵션.
 *
 * firstHitOnly: three-mesh-bvh 의 acceleratedRaycast(bvh-setup)가 이 플래그를
 * 읽어 **가장 가까운 히트 하나에서 조기 종료**한다. R3F 는 포인터가 움직일
 * 때마다 핸들러 달린 모든 객체에 raycast 를 도는데, 기본값(false)이면 BVH 가
 * 레이 위 모든 교차(겹겹이 쌓인 지도 레이어·선체 내벽까지)를 수집한다.
 * 이 저장소의 포인터 핸들러는 전부 첫 히트에서 stopPropagation 하므로 첫
 * 히트만 있으면 의미가 같다 — 수십만 삼각형 지형 위 마우스 이동 비용이
 * 크게 준다. 자체 Raycaster 를 만드는 곳(표면 카메라·드롭 raycast)도 같은
 * 이유로 각자 firstHitOnly 를 켠다.
 */
export const SCENE_RAYCASTER_OPTIONS = { firstHitOnly: true } as const;

export const SCENE_GL_OPTIONS = {
  toneMapping: ACESFilmicToneMapping,
  /**
   * 노출은 1.0(중립)이다.
   *
   * 처음엔 "ACES가 중간톤을 누르니 보정해야 한다"고 보고 1.15로 올렸는데,
   * 그건 조명이 그대로일 때의 이야기였다. 실제로는 같은 시점에 환경광(IBL)이
   * 새로 더해져 광원이 하나 늘어난 상태라, 노출까지 올리자 전체가 들떴다.
   * 밝기 손잡이가 셋(조명·환경광·노출)이면 하나만 중립으로 고정해 두는 편이
   * 나머지를 조율하기 쉽다 — 노출을 그 기준으로 삼는다.
   */
  toneMappingExposure: 1,
  /**
   * 지도 원거리 z-fighting 해결. philly 지도는 도로선↔아스팔트, 도크
   * 라인↔바닥이 8.8cm 간격으로 겹쳐 쌓인 2.4km 메시라, 선형 깊이(near 0.1,
   * 24bit)로는 카메라 400m부터 그 간격을 못 갈라 원거리 전체가 깜빡였다
   * (분해능 ≈ z²/(near·2²⁴): 400m에서 9.5cm, 3000m에서 5.4m). 로그 깊이는
   * 상대 정밀도라 3000m에서도 mm 단위다.
   *
   * 비용: three(r183)가 프래그먼트에서 gl_FragDepth를 써 early-Z가 꺼진다 —
   * DPR 상한 1.5로 프래그먼트 예산은 이미 관리 중이라 감수한다.
   * 제약: raw ShaderMaterial은 logdepthbuf 청크를 직접 include해야 깊이가
   * 맞는다(sea-surface-material.ts 참고). onBeforeCompile 패치는 표준 셰이더
   * 템플릿에 청크가 이미 있어 무관하다.
   */
  logarithmicDepthBuffer: true,
  powerPreference: 'high-performance',
  alpha: false,
  antialias: true,
  /**
   * 충돌 하이라이트·에디터 선택의 일체형 실루엣 테두리가 스텐실 마스크를
   * 쓴다 — 대상 모델들의 화면 발자국을 스텐실에 찍고 부풀린 헐을 그 밖에서만
   * 그려 내부 경계선을 지운다(@crane/domain/3d silhouette-outline.ts). 비용은
   * depth 와 패킹되는 8bit 버퍼뿐이다.
   */
  stencil: true,
  depth: true,
} as const;

/**
 * 조명 세기.
 *
 * 예전 값(ambient 2 / directional 4)은 **톤매핑도 환경광도 없던 시절**에
 * 맞춘 것이다. 그때는 조명이 유일한 광원이라 세게 때려야 했다. 지금은
 * 환경맵(IBL)이 반사광을 더하므로 같은 세기를 유지하면 광량이 이중으로
 * 들어가 화면이 들뜬다 — 특히 ambient는 환경광과 역할이 정면으로 겹친다.
 *
 * 그래서 ambient를 줄이고(2 → 0.9) directional도 약간 낮췄다(4 → 3.6).
 * 비율상 directional 비중이 커지는데, 이건 의도한 것이다 — ambient가
 * 지배적이면 면마다 밝기 차이가 사라져 입체감이 죽는다. 방향광이 주도해야
 * 거더의 면이 구분되고, 그 위에 환경광이 반사를 얹는 구성이 된다.
 *
 * 값 이력(전부 화면을 보고 맞춤 — ACES 곡선의 응답은 선형 합산으로
 * 예측되지 않는다):
 *   2.0/4.0 + 노출 1.15 → 들뜸 (조명은 그대로인데 환경광까지 더해진 탓)
 *   1.0/3.0             → 어두움
 *   1.4/4.0             → 약간 밝음
 *   1.1/3.8             → 여전히 약간 밝음
 *   0.9/3.6             → 현재
 *
 * **밝기 조절은 여기 두 값으로 한다.** 노출(toneMappingExposure)은 1.0
 * 중립으로 고정해 두는 편이 기준점이 흔들리지 않아 조율하기 쉽다.
 * 더 밝게: directional을 먼저 올린다(ambient를 올리면 평평해진다).
 * 더 어둡게: 두 값을 같은 비율로 내린다.
 */
export const SCENE_LIGHTING = {
  // 숫자의 단일 소스는 lib/sky-lighting 의 SCENE_LIGHTING_BASE — solar 모드
  // (낮/밤) 곡선이 같은 값을 낮 기준으로 쓴다.
  ambientIntensity: SCENE_LIGHTING_BASE.ambientIntensity,
  directionalIntensity: SCENE_LIGHTING_BASE.sunIntensity,
  directionalPosition: [0, 50, 10] as [number, number, number],
  directionalColor: '#ffffff',
} as const;

/**
 * shadow map 해상도.
 *
 * 처음엔 씬(지도) 전체를 한 장에 펴는 고정 frustum이었고, 계단이 보여
 * 2048→4096→8192로 해상도만 올렸지만 수 km 폭에서는 8192도 텍셀이 m급이라
 * 계단이 남았다. 지금은 shadow camera가 **카메라 시점을 따라다니며**
 * (SceneLighting의 useFrame) 보고 있는 영역에만 텍셀을 집중시키므로,
 * 4096 한 장이면 어느 줌에서도 텍셀이 화면 픽셀보다 작거나 비슷하다 —
 * 더 올릴 필요가 없고 VRAM도 64MB로 끝난다. 경계는 Canvas
 * `shadows: 'soft'`(PCFSoftShadowMap, scene-shadow.ts)가 추가로 부드럽게
 * 만든다.
 */
const SUN_SHADOW_MAP_SIZE = 4096;
/**
 * 시점 추종 frustum의 최소 반경. 이보다 좁히면 텍셀은 더 촘촘해지지만
 * 근접 줌에서 화면 밖 물체의 긴 그림자가 frustum을 벗어나 잘린다.
 */
const SUN_SHADOW_RADIUS_MIN = 150;

/**
 * 온디맨드 shadow 의 주기 안전망(초). 무효화 신호(shadow-invalidation)를
 * 놓친 경로가 있어도 그림자 staleness 가 이 시간을 넘지 않는다 — 스무딩
 * epsilon 이 버린 sub-cm 잔여 드리프트도 여기서 흡수된다. 비용은 이 주기당
 * shadow pass 1회뿐이다.
 */
const SHADOW_SAFETY_INTERVAL_S = 4;

interface ShadowMapOwner {
  shadowMap: { autoUpdate: boolean; needsUpdate: boolean };
}

/**
 * 온디맨드 shadow 렌더 켜기/원복 — SceneLighting 의 effect 가 부른다.
 * scene-environment 의 applyEquirectBackground 와 같은 패턴: 외부 시스템
 * (renderer) 변조를 컴포넌트 밖 함수로 빼 훅 값 불변 규칙과 충돌하지 않는다.
 */
function enableOnDemandShadows(gl: ShadowMapOwner): () => void {
  gl.shadowMap.autoUpdate = false;
  gl.shadowMap.needsUpdate = true;
  registerShadowRenderer(gl);
  return () => {
    unregisterShadowRenderer(gl);
    // HMR·씬 전환 뒤 다른 코드가 이 규약을 모르고 그림자를 켜도 동작하게
    // 기본값으로 되돌린다.
    gl.shadowMap.autoUpdate = true;
    gl.shadowMap.needsUpdate = true;
  };
}

/**
 * 지도 실측 bbox의 XZ 꼭짓점 — 그림자 커버리지를 지도 전체로 넓히는 근거.
 *
 * 지도 GLB는 position이 원점(또는 없음)이고 지오메트리가 실좌표(km 스케일)로
 * 뻗어 있어 씬 데이터만으로는 범위를 알 수 없다. 지도 GLB에는 건물이 함께
 * 구워져 있어, 모델 기준 반경만 쓰면 씬 외곽 건물이 shadow camera 밖으로
 * 나가 그림자가 끊긴다.
 *
 * 기준 지도는 카메라 이동 범위·탑뷰와 같은 resolveCameraBoundsMaps(카메라
 * 영역 제한 체크, 없으면 모든 지도)다 — 전체 지도로 잡으면 philly 의 수 km
 * 컨텍스트 지형이 frustum 상한(maxRadius)을 6km 까지 끌어올려, 줌 아웃 시
 * shadow pass 가 도시 전체를 그리고 텍셀은 m 급으로 뭉개진다. 작업 구역
 * (cameraBounds 지도) 밖에는 그림자를 드리울 모델도 없다.
 *
 * 로드 완료 시점을 구독할 방법이 없어(modelObjectRegistry는 리렌더 없는
 * mutable Map) 0.3s 폴링으로 지도 객체를 찾고, bbox를 1회 계산하면 멈춘다.
 * expandByObject는 mesh별 geometry.boundingBox(캐시됨)의 8모서리 변환이라
 * 지도급 트리에서도 싸다. 지도가 로드되지 않으면(404 등) 1분 후 포기한다.
 */
function useMapShadowCorners(
  sceneInfo: SavedSceneInfo | null | undefined,
): Vector3Tuple[] | null {
  const mapIdsKey = resolveCameraBoundsMaps(sceneInfo?.maps)
    .map((m) => m.id)
    .join('|');
  const [result, setResult] = useState<{
    key: string;
    corners: Vector3Tuple[];
  } | null>(null);

  useEffect(() => {
    const mapIds = mapIdsKey.length > 0 ? mapIdsKey.split('|') : [];
    if (mapIds.length === 0) return;

    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (attempts > 200) {
        clearInterval(timer);
        return;
      }

      const box = new Box3();
      for (const id of mapIds) {
        const object = modelObjectRegistry.get(id);
        if (!object) return;
        box.expandByObject(object);
      }
      if (box.isEmpty()) return;

      clearInterval(timer);
      setResult({
        key: mapIdsKey,
        corners: [
          [box.min.x, 0, box.min.z],
          [box.min.x, 0, box.max.z],
          [box.max.x, 0, box.min.z],
          [box.max.x, 0, box.max.z],
        ],
      });
    }, 300);

    return () => clearInterval(timer);
  }, [mapIdsKey]);

  // key가 어긋난 결과(지도 교체 전 bbox)는 버린다 — 동기 reset 없이도
  // stale 값이 새 씬에 적용되지 않는다.
  return result && result.key === mapIdsKey ? result.corners : null;
}

/**
 * 조명 앵커·씬 반경. anchor는 모델 위치 + 지도 bbox 꼭짓점의 센트로이드
 * (아무것도 없으면 원점)로 조명 target의 초기값, radius는 anchor에서 가장
 * 먼 점까지의 수평 거리 + 여유로 시점 추종 shadow frustum(SceneLighting의
 * useFrame)의 **상한**이다 — 줌 아웃해 씬 전체가 보일 때 frustum이 이보다
 * 커질 필요가 없다. 배열 루프라 편집 중 재계산도 무비용이고, philly 씬처럼
 * 오브젝트가 원점에서 수 km 떨어져 있어도(x≈-2200) 동작한다.
 */
function useSunAnchor(
  sceneInfo: SavedSceneInfo | null | undefined,
  mapCorners: Vector3Tuple[] | null,
) {
  return useMemo(() => {
    const modelPoints: Vector3Tuple[] =
      sceneInfo?.models && sceneInfo.models.length > 0
        ? sceneInfo.models.map((m) => m.position)
        : (sceneInfo?.maps ?? [])
            .map((m) => m.position)
            .filter((p): p is Vector3Tuple => Array.isArray(p));
    const points = mapCorners ? [...modelPoints, ...mapCorners] : modelPoints;

    if (points.length === 0) {
      return { anchor: [0, 0, 0] as Vector3Tuple, radius: 200 };
    }

    let cx = 0;
    let cz = 0;
    for (const p of points) {
      cx += p[0];
      cz += p[2];
    }
    cx /= points.length;
    cz /= points.length;

    let maxDist = 0;
    for (const p of points) {
      const d = Math.hypot(p[0] - cx, p[2] - cz);
      if (d > maxDist) maxDist = d;
    }

    // 여유 150m: 모델 position은 origin 기준이라 실제 지오메트리가 더
    // 뻗어 있을 수 있고, 그림자도 물체 밖으로 드리워진다. 상한 6000은
    // 비정상 데이터(좌표 오염) 방어용 — 정상 지도 bbox는 그 아래다.
    const radius = clampToRange(maxDist + 150, 200, 6000);
    return { anchor: [cx, 0, cz] as Vector3Tuple, radius };
  }, [sceneInfo, mapCorners]);
}

/**
 * 하늘의 태양·달 표식 거리(카메라 기준, 월드 unit). SCENE_CAMERA_CLIP.far
 * (50000) 안이면서 지형·건물보다 멀어 자연스럽게 가려진다. 바다 평면(반경
 * 40000, depthWrite 없음)은 표식을 가리지 않는다.
 */
const CELESTIAL_DISTANCE = 20_000;
/** 태양 글로우 스프라이트 한 변 — 거리 20000 에서 시각 지름 약 7°(핵 ~0.8°). */
const SUN_SPRITE_SIZE = 2400;
/** 달 스프라이트 한 변 — 원판(텍스처의 42%)이 약 1.2°. 실제(0.5°)보다 키워 읽히게. */
const MOON_SPRITE_SIZE = 1000;

interface SolarFrameState {
  geo: SceneSiteGeo | null;
  /** 마지막으로 계산한 초 단위 시각 키 — 같은 초면 재계산하지 않는다. */
  timeKey: number;
  /** 마지막 계산에 쓴 야간 작업등 옵션 — 바뀌면 같은 초라도 재계산. */
  yardLights: boolean;
  snapshot: SolarLightingSnapshot | null;
  keyAzimuth: number;
  keyElevation: number;
  /** 방향광(키 라이트) 방향 — keyAzimuth/Elevation 이 바뀔 때만 다시 쓴다. */
  keyDir: Vector3;
  /** 표식용 실제 태양·달 방향(지평선 아래 포함). */
  sunDir: Vector3;
  moonDir: Vector3;
}

function createSolarFrameState(): SolarFrameState {
  return {
    geo: null,
    timeKey: Number.NaN,
    yardLights: true,
    snapshot: null,
    keyAzimuth: Number.NaN,
    keyElevation: Number.NaN,
    keyDir: new Vector3(0, 1, 0),
    sunDir: new Vector3(0, 1, 0),
    moonDir: new Vector3(0, 1, 0),
  };
}

function setColorIfChanged(
  target: {
    r: number;
    g: number;
    b: number;
    setRGB: (r: number, g: number, b: number) => unknown;
  },
  rgb: RgbTuple,
) {
  if (target.r !== rgb[0] || target.g !== rgb[1] || target.b !== rgb[2]) {
    target.setRGB(rgb[0], rgb[1], rgb[2]);
  }
}

/**
 * 조명·하늘을 수동 모드 기본값으로 되돌린다 — solar 모드를 떠날 때(씬 설정
 * 변경·언마운트). R3F 는 바뀌지 않은 prop 을 다시 쓰지 않으므로 useFrame 이
 * 덮어쓴 값은 직접 원복해야 한다.
 */
function resetToManualLook(
  light: DirectionalLight | null,
  ambient: AmbientLight | null,
  scene: Scene,
) {
  if (light) {
    light.intensity = SCENE_LIGHTING.directionalIntensity;
    light.color.set(SCENE_LIGHTING.directionalColor);
  }
  if (ambient) {
    ambient.intensity = SCENE_LIGHTING.ambientIntensity;
    ambient.color.set('#ffffff');
  }
  scene.backgroundIntensity = 1;
  if (scene.environment) {
    scene.environmentIntensity = SCENE_ENVIRONMENT_INTENSITY;
  }
}

/** 하늘 표식 스프라이트 — 텍스처가 없으면(문서 없는 환경) null. */
function useCelestialSprite(
  createTexture: () => ReturnType<typeof createSunGlowTexture>,
  size: number,
) {
  const sprite = useMemo(() => {
    const map = createTexture();
    if (!map) return null;
    const material = new SpriteMaterial({
      map,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      opacity: 0,
    });
    const object = new Sprite(material);
    object.scale.set(size, size, 1);
    object.visible = false;
    // 에디터 marquee·드롭 raycast 에 잡히면 안 된다(바다 평면과 같은 규칙).
    object.raycast = () => {};
    return object;
  }, [createTexture, size]);

  useEffect(
    () => () => {
      if (!sprite) return;
      sprite.material.map?.dispose();
      sprite.material.dispose();
    },
    [sprite],
  );

  return sprite;
}

/**
 * 씬 공통 조명. 세 화면이 이 컴포넌트 하나를 쓴다.
 *
 * 그림자는 씬 설정(sceneInfo.lighting.shadows)으로 켠다 — 기본 Off.
 * ContactShadows를 넣었다가(2026-08-14) 관제 화면에서 지도 위 어두운 반점이
 * 지형을 읽기 어렵게 해 롤백한 이력이 있어, 전역 상시 적용 대신 씬별
 * opt-in으로 되살렸다. 켜는 쪽은 배경 탭(palette-environment-section.tsx),
 * Canvas의 `shadows`는 세 화면이 isSceneShadowEnabled로 판정한다.
 *
 * 런타임 토글에 별도 대응 코드가 없는 근거: R3F v9은 Canvas `shadows`가
 * 바뀌면 gl.shadowMap.enabled 갱신과 needsUpdate를 처리하고, 머티리얼
 * 셰이더 재컴파일은 아래 directionalLight의 castShadow가 같은 플래그에
 * 바인딩되어 있어 lights state 변경으로 자동 유발된다.
 *
 * 태양 위치는 두 모드가 있다(`lighting.sunMode`).
 * - manual(기본): 씬의 sunAzimuth/sunElevation 고정. 그림자가 꺼져 있어도
 *   항상 적용된다 — 조명 방향(셰이딩)은 그림자와 무관하게 씬의 인상을
 *   정하는 값이다.
 * - solar: 현장 위치(scene-site-geo, `regionId` 로 찾음)와 시각(`timeSource`
 *   — 씬 시계 또는 리플레이 프레임)으로 매 프레임 태양·달 위치를 계산한다
 *   (lib/solar-lighting). 낮에는 태양이, 밤에는 야간 작업등(고정 마스트 방향,
 *   useSceneClockStore.yardLights 로 끌 수 있다)이 방향광이 되고 박명엔 둘을
 *   세기 비율로 섞는다. 세기·색·환경광·배경(EXR)·환경맵 밝기가
 *   lib/sky-lighting 곡선을 따른다. 달은 표식·위상 표시용이다. 하늘에는
 *   태양 글로우·달 표식 스프라이트를 띄운다(EXR 배경이 있을 때만 — 검은
 *   캔버스 위의 해는 어색하다). 현장 위치가 없는 region 은 manual 로 폴백.
 *   방향은 CELESTIAL_ANGLE_STEP(0.05°) 격자에 양자화되어 정지 화면에서
 *   shadow map 이 매 프레임 다시 그려지지 않는다.
 *   세기·색·배경 밝기는 React 상태가 아니라 useFrame 에서 ref 로 직접 쓴다
 *   (이 저장소의 매-프레임 갱신 규칙). 모드를 떠날 때는 resetToManualLook
 *   으로 원복한다.
 *
 * 예외: collision-guard-object-model은 `= false`를 **명시적으로** 넣는다.
 * GLB가 true로 실려 올 수 있어 방어하는 코드라 성격이 다르다.
 */
export function SceneLighting({
  sceneInfo,
  regionId,
  timeSource = 'clock',
}: {
  sceneInfo?: SavedSceneInfo | null;
  /** solar 모드의 현장 위치를 찾는 키. 없으면 solar 설정이어도 manual. */
  regionId?: string;
  /** solar 모드의 시각 출처. 리플레이 화면은 'replay'. */
  timeSource?: SceneTimeSource;
} = {}) {
  const lighting = sceneInfo?.lighting;
  const shadowsEnabled = isSceneShadowEnabled(lighting);
  const sunAzimuth = lighting?.sunAzimuth ?? SCENE_SUN_AZIMUTH_DEFAULT;
  const sunElevation = lighting?.sunElevation ?? SCENE_SUN_ELEVATION_DEFAULT;
  // solar 모드는 씬 설정과 현장 위치가 모두 있어야 켜진다.
  const solarGeo =
    lighting?.sunMode === 'solar' && regionId
      ? getSceneSiteGeo(regionId)
      : null;

  const mapCorners = useMapShadowCorners(sceneInfo);
  // anchor는 시점 추종 초점의 폴백으로만, radius는 frustum 상한으로 쓴다.
  const { anchor, radius: maxRadius } = useSunAnchor(sceneInfo, mapCorners);

  const manualSunDir = useMemo(
    () => sunDirectionFromAngles(sunAzimuth, sunElevation),
    [sunAzimuth, sunElevation],
  );

  // 조명 target — three 기본 target은 씬에 붙어 있지 않아 원점만 바라본다.
  // primitive로 씬에 넣고 초점이 바뀐 프레임에 옮긴다.
  const target = useMemo(() => new Object3D(), []);
  const lightRef = useRef<DirectionalLight | null>(null);
  const ambientRef = useRef<AmbientLight | null>(null);
  const scratchForward = useMemo(() => new Vector3(), []);
  const scene = useThree((s) => s.scene);

  // solar 프레임 상태 — 시각·천체 계산 캐시. React 상태가 아니다.
  const solarRef = useRef<SolarFrameState>(createSolarFrameState());
  const replayTimeCacheRef = useRef(createReplayTimeCache());
  const sunSprite = useCelestialSprite(createSunGlowTexture, SUN_SPRITE_SIZE);
  const moonSprite = useCelestialSprite(createMoonTexture, MOON_SPRITE_SIZE);
  // useFrame 은 메모 값(sunSprite)을 직접 고치지 않고 ref 를 거친다 —
  // 훅이 돌려준 값을 변경하면 react-hooks/immutability 에 걸린다(SeaSurface
  // 의 uniform ref 와 같은 사정).
  const sunSpriteRef = useRef<Sprite | null>(null);
  const moonSpriteRef = useRef<Sprite | null>(null);

  // solar 모드를 떠나면(설정 변경·언마운트) useFrame 이 덮어쓴 조명·하늘을
  // 수동 기본값으로 되돌리고 표식을 숨긴다. ref 는 effect 시점에 잡아 둔다
  // — 언마운트 cleanup 에서는 ref 가 이미 null 일 수 있다.
  useEffect(() => {
    if (!solarGeo) return;
    const light = lightRef.current;
    const ambient = ambientRef.current;
    const solar = solarRef.current;
    const sun = sunSpriteRef.current;
    const moon = moonSpriteRef.current;
    return () => {
      resetToManualLook(light, ambient, scene);
      solar.snapshot = null;
      solar.timeKey = Number.NaN;
      if (sun) sun.visible = false;
      if (moon) moon.visible = false;
    };
  }, [solarGeo, scene]);

  // 온디맨드 shadow 렌더 — three 기본은 매 프레임 shadow map 재렌더인데,
  // 캐스터가 움직인 프레임에만 그리도록 autoUpdate 를 끄고 무효화 신호
  // (@crane/domain/3d shadow-invalidation — 값 저장소·기즈모·ModelMesh 커밋이
  // 부른다)로 needsUpdate 를 세운다. 정지 화면·실시간 유휴·리플레이 프레임
  // 사이의 depth pass(수십만 tris)가 0 이 된다. 그림자 꺼진 씬은 원래대로.
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    if (!shadowsEnabled) return;
    return enableOnDemandShadows(gl);
  }, [gl, shadowsEnabled]);

  // 마지막으로 조명에 적용한 frustum 입력 — 달라진 프레임에만 쓰고 무효화한다.
  const lastShadowInputRef = useRef<{
    cx: number;
    cz: number;
    radius: number;
    sunDir: Vector3;
  }>({ cx: Number.NaN, cz: Number.NaN, radius: 0, sunDir: new Vector3() });
  const lastShadowRenderAtRef = useRef(0);

  // 시점 추종 shadow frustum — 고정 frustum으로 씬 전체를 덮으면 텍셀이
  // m급이라 계단이 보인다(SUN_SHADOW_MAP_SIZE 주석). 대신 카메라 시선이
  // 지면과 만나는 점을 초점으로 frustum을 옮기고, 반경을 시거리에 비례시켜
  // 어느 줌에서도 텍셀 크기 ≈ 화면 픽셀 크기를 유지한다(단일 캐스케이드
  // CSM과 같은 원리). React 상태 대신 useFrame에서 ref를 직접 mutate하는
  // 것이 이 저장소의 매-프레임 갱신 규칙이다(useFrame 내 setState 금지).
  //
  // 초점은 텍셀 격자 스냅·2배 단계 반경 양자화 덕에 카메라가 멈추면 값이
  // 비트 단위로 같아진다 — 이 성질이 "달라진 프레임에만 쓰기+무효화"를
  // 가능하게 한다(카메라 회전만으로는 shadow map 이 다시 그려지지 않는다).
  // scene 은 useThree 반환값이 아니라 프레임 상태에서 받는다 — 훅이 돌려준
  // 값을 변경하면 react-hooks/immutability 에 걸린다.
  useFrame(({ camera, clock, scene: frameScene }) => {
    const light = lightRef.current;
    if (!light) return;

    // 0) 이 프레임의 태양 방향 — manual 은 메모 값, solar 는 시각으로 계산.
    let sunDir = manualSunDir;
    if (solarGeo) {
      const solar = solarRef.current;
      const timeMs = readSceneTimeMs(
        timeSource,
        solarGeo.timeZone,
        replayTimeCacheRef.current,
      );
      // 초 단위로 자른다 — 태양은 1초에 0.004° 움직여 그 안의 차이는 없다.
      const timeKey = Math.floor(timeMs / 1000);
      const yardLights = useSceneClockStore.getState().yardLights;
      if (
        solar.timeKey !== timeKey ||
        solar.geo !== solarGeo ||
        solar.yardLights !== yardLights
      ) {
        solar.timeKey = timeKey;
        solar.geo = solarGeo;
        solar.yardLights = yardLights;
        const snapshot = resolveSolarLighting(
          timeMs,
          solarGeo,
          SCENE_LIGHTING_BASE,
          { yardLights },
        );
        if (snapshot) {
          solar.snapshot = snapshot;
          if (
            snapshot.keyAzimuth !== solar.keyAzimuth ||
            snapshot.keyElevation !== solar.keyElevation
          ) {
            solar.keyAzimuth = snapshot.keyAzimuth;
            solar.keyElevation = snapshot.keyElevation;
            solar.keyDir.copy(
              sunDirectionFromAngles(
                snapshot.keyAzimuth,
                snapshot.keyElevation,
                KEY_LIGHT_ELEVATION_MIN,
              ),
            );
          }
          solar.sunDir.copy(
            sunDirectionFromAngles(
              snapshot.sun.azimuth,
              snapshot.sun.elevation,
              -90,
            ),
          );
          solar.moonDir.copy(
            sunDirectionFromAngles(
              snapshot.moon.azimuth,
              snapshot.moon.elevation,
              -90,
            ),
          );
        }
      }

      const snapshot = solar.snapshot;
      if (snapshot) {
        sunDir = solar.keyDir;
        const sky = snapshot.sky;
        // 세기·색·하늘 밝기 — 값이 다를 때만 쓴다(R3F 리렌더의 prop 재적용도
        // 여기서 다시 잡힌다).
        if (light.intensity !== sky.keyIntensity) {
          light.intensity = sky.keyIntensity;
        }
        setColorIfChanged(light.color, sky.keyColor);
        const ambient = ambientRef.current;
        if (ambient) {
          if (ambient.intensity !== sky.ambientIntensity) {
            ambient.intensity = sky.ambientIntensity;
          }
          setColorIfChanged(ambient.color, sky.ambientColor);
        }
        if (frameScene.backgroundIntensity !== sky.skyIntensity) {
          frameScene.backgroundIntensity = sky.skyIntensity;
        }
        if (frameScene.environment) {
          const envIntensity = SCENE_ENVIRONMENT_INTENSITY * sky.skyIntensity;
          if (frameScene.environmentIntensity !== envIntensity) {
            frameScene.environmentIntensity = envIntensity;
          }
        }

        // 하늘 표식 — EXR 배경이 있을 때만. 카메라를 따라 "무한 원점"에 둔다.
        const hasSky = frameScene.background !== null;
        const sun = sunSpriteRef.current;
        if (sun) {
          const opacity = hasSky ? sky.sunVisibility : 0;
          sun.visible = opacity > 0.001;
          if (sun.visible) {
            sun.material.opacity = opacity;
            sun.position
              .copy(camera.position)
              .addScaledVector(solar.sunDir, CELESTIAL_DISTANCE);
          }
        }
        const moon = moonSpriteRef.current;
        if (moon) {
          const opacity = hasSky ? sky.moonVisibility : 0;
          moon.visible = opacity > 0.001;
          if (moon.visible) {
            moon.material.opacity = opacity;
            moon.position
              .copy(camera.position)
              .addScaledVector(solar.moonDir, CELESTIAL_DISTANCE);
          }
        }
      }
    }

    // 1) 초점 = 시선과 지면(y=0)의 교점. 수평·상향 시선이면 카메라 바로
    //    아래(폴백은 씬 앵커가 아니라 카메라 — 시점을 따라가는 게 목적).
    camera.getWorldDirection(scratchForward);
    let focusX = camera.position.x;
    let focusZ = camera.position.z;
    let viewDist = Math.abs(camera.position.y) + 50;
    if (scratchForward.y < -1e-4) {
      const t = -camera.position.y / scratchForward.y;
      if (t > 0 && Number.isFinite(t)) {
        focusX = camera.position.x + scratchForward.x * t;
        focusZ = camera.position.z + scratchForward.z * t;
        viewDist = t;
      }
    }

    // 2) 반경: 시거리 비례를 2배 단계로 양자화 — 연속으로 변하면 텍셀
    //    크기가 매 프레임 달라져 아래 스냅이 무력화되고 그림자가 일렁인다.
    const want = clampToRange(viewDist * 1.2, SUN_SHADOW_RADIUS_MIN, maxRadius);
    let frustumRadius = SUN_SHADOW_RADIUS_MIN;
    while (frustumRadius < want) frustumRadius *= 2;
    frustumRadius = Math.min(frustumRadius, maxRadius);

    // 3) 초점을 텍셀 격자에 스냅 — 카메라 팬 중 frustum이 서브텍셀로
    //    미끄러지며 그림자 경계가 기어다니는 shimmer를 막는다.
    const texel = (2 * frustumRadius) / SUN_SHADOW_MAP_SIZE;
    const cx = Math.round(focusX / texel) * texel;
    const cz = Math.round(focusZ / texel) * texel;

    const orbitDistance = Math.max(frustumRadius * 2.5, 300);
    const lightX = cx + sunDir.x * orbitDistance;
    const lightY = sunDir.y * orbitDistance;
    const lightZ = cz + sunDir.z * orbitDistance;

    // 입력(cx·cz·반경·태양각)뿐 아니라 light/target 의 실제 위치도 본다 —
    // R3F 리렌더의 prop 재적용이 초기값으로 되돌린 경우를 잡아 다시 쓴다
    // (primitive position=anchor, directionalLight position=프리셋 초기값).
    // 태양 방향은 성분 비교 — solar 모드는 같은 Vector3 를 제자리에서 고친다.
    const last = lastShadowInputRef.current;
    const changed =
      last.cx !== cx ||
      last.cz !== cz ||
      last.radius !== frustumRadius ||
      !last.sunDir.equals(sunDir) ||
      light.position.x !== lightX ||
      light.position.y !== lightY ||
      light.position.z !== lightZ ||
      target.position.x !== cx ||
      target.position.z !== cz;

    if (changed) {
      last.cx = cx;
      last.cz = cz;
      last.radius = frustumRadius;
      last.sunDir.copy(sunDir);

      target.position.set(cx, 0, cz);
      target.updateMatrixWorld();
      light.position.set(lightX, lightY, lightZ);
      // acne(자기 그림자 줄무늬)와 peter-panning(그림자 들뜸)의 균형점은
      // 텍셀 크기에 비례한다 — 반경이 변할 때 같이 갱신한다.
      light.shadow.normalBias = Math.max(0.05, texel);

      const shadowCamera = light.shadow.camera;
      const shadowFar = orbitDistance + frustumRadius * 3;
      if (
        shadowCamera.right !== frustumRadius ||
        shadowCamera.far !== shadowFar
      ) {
        shadowCamera.left = -frustumRadius;
        shadowCamera.right = frustumRadius;
        shadowCamera.top = frustumRadius;
        shadowCamera.bottom = -frustumRadius;
        shadowCamera.near = 1;
        shadowCamera.far = shadowFar;
        shadowCamera.updateProjectionMatrix();
      }

      invalidateShadows();
      lastShadowRenderAtRef.current = clock.elapsedTime;
    } else if (
      shadowsEnabled &&
      clock.elapsedTime - lastShadowRenderAtRef.current >
        SHADOW_SAFETY_INTERVAL_S
    ) {
      // 주기 안전망 — 상수 주석 참고.
      lastShadowRenderAtRef.current = clock.elapsedTime;
      invalidateShadows();
    }
  });

  return (
    <>
      <ambientLight
        ref={ambientRef}
        intensity={SCENE_LIGHTING.ambientIntensity}
      />
      <primitive object={target} position={anchor} />
      <directionalLight
        ref={lightRef}
        // position·shadow-camera 값은 useFrame이 매 프레임 덮어쓴다 —
        // 여기 값은 첫 프레임 전의 초기값일 뿐이다. solar 모드는 intensity·
        // color 도 useFrame 이 쓴다.
        position={SCENE_LIGHTING.directionalPosition}
        target={target}
        color={SCENE_LIGHTING.directionalColor}
        intensity={SCENE_LIGHTING.directionalIntensity}
        castShadow={shadowsEnabled}
        shadow-mapSize={[SUN_SHADOW_MAP_SIZE, SUN_SHADOW_MAP_SIZE]}
        shadow-bias={-0.0002}
      >
        <orthographicCamera
          attach="shadow-camera"
          args={[
            -SUN_SHADOW_RADIUS_MIN,
            SUN_SHADOW_RADIUS_MIN,
            SUN_SHADOW_RADIUS_MIN,
            -SUN_SHADOW_RADIUS_MIN,
            1,
            1000,
          ]}
        />
      </directionalLight>
      {/* 하늘 표식 — solar 모드에서만 보인다(useFrame 이 visible 을 켠다). */}
      {sunSprite ? <primitive object={sunSprite} ref={sunSpriteRef} /> : null}
      {moonSprite ? (
        <primitive object={moonSprite} ref={moonSpriteRef} />
      ) : null}
    </>
  );
}
