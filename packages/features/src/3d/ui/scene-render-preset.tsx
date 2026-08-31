import { useEffect, useMemo, useState } from 'react';
import { ACESFilmicToneMapping, Box3, Object3D, Vector3 } from 'three';
import {
  SCENE_SUN_POSITION_DEFAULT,
  modelObjectRegistry,
} from '@crane/domain/3d';
import type { SavedSceneInfo } from '@crane/domain/3d';
import { isSceneShadowEnabled } from '../lib/scene-shadow';
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
 *   지도 중앙부터 잘려나간다. OrbitControls maxDistance(3000) + 씬 반폭보다
 *   커야 잘림이 없다. 바다 평면(scene-environment.tsx SeaSurface, 반경
 *   40000)이 들어오면서 50000으로 올렸다 — 원판이 far에 잘리면 잘린 경계가
 *   직선으로 드러나므로 원판 반경보다 커야 한다. 깊이 정밀도는 near가
 *   지배하므로(0.1) far 상향의 비용은 사실상 없다.
 * near: 0.1(three 기본)을 쓴다. 에디터만 0.5를 쓰고 있었는데, near를 올리면
 *   깊이 정밀도는 좋아지지만 카메라에 바짝 붙은 지오메트리가 잘려 보인다 —
 *   뷰어와 다른 값을 쓸 이유가 없다.
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
  powerPreference: 'high-performance',
  alpha: false,
  antialias: true,
  stencil: false,
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
  ambientIntensity: 0.9,
  directionalIntensity: 3.6,
  directionalPosition: [0, 50, 10] as [number, number, number],
  directionalColor: '#ffffff',
} as const;

/**
 * 태양 궤적 상수.
 *
 * 방위 규약: **월드 +X = 동, -X = 서** (SavedLightingInfo 주석 참고 — 씬에
 * 나침반·방위 데이터가 없어 축 규약으로 못박는다). sunPosition t∈[0,1]는
 * XY 평면에서 동(+X 지평선) → 남중(머리 위) → 서(-X 지평선)의 반원 호를
 * 그리고, 여기에 z 방향 틸트를 더해 궤도면을 살짝 기울인다.
 */
/**
 * 최저 태양 고도 20°. 슬라이더 양 끝(동/서)에서 해가 지평선에 닿으면
 * 그림자가 무한정 길어지고 shadow camera가 씬을 못 덮는다. 20°면 그림자
 * 길이가 물체 높이의 ~2.75배(1/tan20°)에서 멈춘다.
 */
const SUN_MIN_ELEVATION_RAD = Math.PI * (20 / 180);
/**
 * 궤도면 z 틸트. 남중(t=0.5)일 때 방향이 normalize([0, 1, 0.2]) =
 * (0, 0.981, 0.196)로, 종전 고정 조명 directionalPosition [0, 50, 10]의
 * 방향과 정확히 일치한다 — lighting 필드가 없는 기존 씬의 셰이딩이 그대로
 * 유지되는 근거다. SCENE_LIGHTING.directionalPosition을 지우지 않고 두는
 * 이유이기도 하다(이 일치의 기준점).
 */
const SUN_ORBIT_TILT_Z = 0.2;
/**
 * shadow map 해상도. 지도 전체를 덮는 큰 반경(임계 초과)에서는 4096으로
 * 올려 텍셀 밀도를 유지한다 — 2048을 수 km에 펴면 그림자가 블록으로
 * 뭉개진다. 4096² depth 텍스처는 VRAM ~64MB로, 반경이 작을 땐 2048로
 * 아낀다.
 */
const SUN_SHADOW_MAP_SIZE = 2048;
const SUN_SHADOW_MAP_SIZE_LARGE = 4096;
const SUN_SHADOW_LARGE_RADIUS = 800;

/** sunPosition t∈[0,1] → 정규화된 태양 방향 벡터(씬 → 태양). */
function sunDirectionFromPosition(t: number): Vector3 {
  const alpha = clampToRange(
    Math.PI * clampToRange(t, 0, 1),
    SUN_MIN_ELEVATION_RAD,
    Math.PI - SUN_MIN_ELEVATION_RAD,
  );
  return new Vector3(Math.cos(alpha), Math.sin(alpha), SUN_ORBIT_TILT_Z).normalize();
}

/**
 * 지도 실측 bbox의 XZ 꼭짓점 — 그림자 커버리지를 지도 전체로 넓히는 근거.
 *
 * 지도 GLB는 position이 원점(또는 없음)이고 지오메트리가 실좌표(km 스케일)로
 * 뻗어 있어 씬 데이터만으로는 범위를 알 수 없다. 지도 GLB에는 건물이 함께
 * 구워져 있어, 모델 기준 반경만 쓰면 씬 외곽 건물이 shadow camera 밖으로
 * 나가 그림자가 끊긴다.
 *
 * 로드 완료 시점을 구독할 방법이 없어(modelObjectRegistry는 리렌더 없는
 * mutable Map) 0.3s 폴링으로 지도 객체를 찾고, bbox를 1회 계산하면 멈춘다.
 * expandByObject는 mesh별 geometry.boundingBox(캐시됨)의 8모서리 변환이라
 * 지도급 트리에서도 싸다. 지도가 로드되지 않으면(404 등) 1분 후 포기한다.
 */
function useMapShadowCorners(
  sceneInfo: SavedSceneInfo | null | undefined,
): Vector3Tuple[] | null {
  const mapIdsKey = (sceneInfo?.maps ?? []).map((m) => m.id).join('|');
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
 * 조명 앵커·커버리지. anchor는 모델 위치 + 지도 bbox 꼭짓점의 센트로이드
 * (아무것도 없으면 원점), radius는 anchor에서 가장 먼 점까지의 수평 거리 +
 * 여유. 배열 루프라 편집 중 재계산도 무비용이고, philly 씬처럼 오브젝트가
 * 원점에서 수 km 떨어져 있어도(x≈-2200) 조명 target과 shadow camera가 씬을
 * 따라간다.
 *
 * 지도 bbox 꼭짓점(useMapShadowCorners)이 합쳐지면 커버리지가 지도 전체로
 * 넓어져 씬 외곽 건물도 그림자를 드리운다 — bbox 계산 전(로드 중)에는 모델
 * 기준 반경으로 시작했다가 계산이 끝나면 한 번 넓어진다.
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
 * 태양 위치(sunPosition)는 그림자가 꺼져 있어도 항상 적용된다 — 조명
 * 방향(셰이딩)은 그림자와 무관하게 씬의 인상을 정하는 값이다.
 *
 * 예외: collision-guard-object-model은 `= false`를 **명시적으로** 넣는다.
 * GLB가 true로 실려 올 수 있어 방어하는 코드라 성격이 다르다.
 */
export function SceneLighting({
  sceneInfo,
}: {
  sceneInfo?: SavedSceneInfo | null;
} = {}) {
  const lighting = sceneInfo?.lighting;
  const shadowsEnabled = isSceneShadowEnabled(lighting);
  const sunPosition = lighting?.sunPosition ?? SCENE_SUN_POSITION_DEFAULT;

  const mapCorners = useMapShadowCorners(sceneInfo);
  const { anchor, radius } = useSunAnchor(sceneInfo, mapCorners);
  const shadowMapSize =
    radius > SUN_SHADOW_LARGE_RADIUS
      ? SUN_SHADOW_MAP_SIZE_LARGE
      : SUN_SHADOW_MAP_SIZE;

  // 조명 target — three 기본 target은 씬에 붙어 있지 않아 원점만 바라본다.
  // primitive로 씬에 넣고 anchor에 놓아야 원점에서 먼 씬에서도 방향이 맞는다.
  const target = useMemo(() => new Object3D(), []);

  const { lightPosition, shadowFar } = useMemo(() => {
    const dir = sunDirectionFromPosition(sunPosition);
    // 조명은 방향만 의미 있지만 shadow camera는 위치 기준이므로 씬 반경보다
    // 충분히 멀리 둔다.
    const orbitDistance = Math.max(radius * 2.5, 300);
    return {
      lightPosition: [
        anchor[0] + dir.x * orbitDistance,
        anchor[1] + dir.y * orbitDistance,
        anchor[2] + dir.z * orbitDistance,
      ] as Vector3Tuple,
      shadowFar: orbitDistance + radius * 3,
    };
  }, [sunPosition, anchor, radius]);

  return (
    <>
      <ambientLight intensity={SCENE_LIGHTING.ambientIntensity} />
      <primitive object={target} position={anchor} />
      <directionalLight
        // mapSize는 shadow map 텍스처가 이미 만들어진 뒤 바꿔도 재할당되지
        // 않는다 — 해상도 티어가 바뀌면 조명을 리마운트해 새로 만들게 한다.
        key={shadowMapSize}
        position={lightPosition}
        target={target}
        color={SCENE_LIGHTING.directionalColor}
        intensity={SCENE_LIGHTING.directionalIntensity}
        castShadow={shadowsEnabled}
        shadow-mapSize={[shadowMapSize, shadowMapSize]}
        // 미터 스케일 대형 메시의 shadow acne 방지. normalBias는 표면을
        // 법선 방향으로 밀어내는 값이라 미터 단위 씬에선 1 정도가 맞다.
        shadow-bias={-0.0002}
        shadow-normalBias={1}
      >
        {/* args 방식은 값 변경 시 카메라를 재생성하므로 updateProjectionMatrix
            수동 호출이 필요 없다. shadow-camera-left 같은 pierced prop은
            갱신이 안 걸리므로 쓰지 말 것. */}
        <orthographicCamera
          attach="shadow-camera"
          args={[-radius, radius, radius, -radius, 1, shadowFar]}
        />
      </directionalLight>
    </>
  );
}
