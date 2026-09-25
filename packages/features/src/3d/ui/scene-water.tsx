import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import {
  CircleGeometry,
  TextureLoader,
  Vector3,
  type Vector3Tuple,
} from 'three';
import { withBaseUrl } from '@crane/core/lib/asset-url';
import {
  SEA_LEVEL_Y,
  modelObjectRegistry,
  type SavedMapInfo,
} from '@crane/domain/3d';
import { OceanWater, type OceanWaterUniforms } from '../lib/ocean-water';
import type { RgbTuple } from '../lib/sky-lighting';
import { ensureRepeatWrapping } from '../lib/water-normals';
import { resolveReflectionExcludedMapIds } from '../lib/water-reflection';
import { resolveWaterSunUniforms } from '../lib/water-sun-uniforms';
import { sceneLightingInfo } from '../model/scene-lighting-info';
import { getReflectionExclusions } from '../model/scene-reflection-exclusions';

/**
 * 바다 — three.js `webgl_shaders_ocean` 예제의 Water(평면 미러 반사 +
 * waternormals.jpg 노멀맵 파도)를 포크한 `OceanWater`(lib/ocean-water.ts)
 * 한 장. 마운트 여부는 SceneEnvironment 가 `seaVisible`(resolveSeaVisible)
 * 로 정한다.
 *
 * 그리는 순서: 불투명 씬 메시(renderOrder 0) **뒤**, 격자(0.5)·선택 박스(1)·
 * 실루엣 마스크(10) 앞인 SEA_RENDER_ORDER. 깊이는 읽지도 쓰지도 않고 스텐실
 * "불투명 씬이 그려졌다" 비트가 없는 픽셀에서만 그려진다 — 지도·드라이독·
 * 잠긴 선체는 깊이 순서와 무관하게 바다 위에 남고,
 * 가려진 픽셀은 셰이더가 아예 돌지 않는다. 오버레이(격자·선택 박스·텍스트
 * 테두리·가드 링)는 renderOrder ≥ 0.5 라 바다 뒤에 그려져 물 위에서도 덮이지
 * 않는다 — 새 오버레이를 0 으로 두면 물 위에서 사라진다.
 *
 * 반사 제외(미러 패스 동안만 visible=false): 컨텍스트 지형은 lib/
 * water-reflection 의 id 판정 → 매 패스 modelObjectRegistry 조회(늦게 로드되는
 * 지도 루트도 잡히고, 미등록 id 는 undefined 라 포크가 건너뛴다). 밤하늘 틴트
 * 돔·태양/달 스프라이트는 SceneLighting 이 model/scene-reflection-exclusions
 * 에 등록한다.
 *
 * 태양 하이라이트는 sceneLightingInfo.sun*(실제 태양 — manual·solar 모두
 * SceneLighting 이 발행) 을 따르고 변환은 lib/water-sun-uniforms 가 한다.
 * 튜플 참조가 바뀐 프레임에만 유니폼을 쓴다. invalidate 는 부르지 않는다 —
 * 바다가 켜진 씬은 거버너가 30fps 로 틱한다(isSceneFrameTickerActive 규약).
 *
 * raycast 는 noop — 에디터의 marquee 선택·드롭 배치 raycast 에 40km 원판이
 * 잡히면 안 된다. geometry 와 물(RT·머티리얼)은 이 컴포넌트 소유라 unmount
 * 에 dispose 하고, 노멀맵은 useLoader 캐시 소유라 건드리지 않는다.
 */

/**
 * 원판 반경. SCENE_CAMERA_CLIP.far(50000) 안에 둬 잘리는 경계가 far 평면이
 * 아니라 깔끔한 원 가장자리가 되게 한다. 가장자리 너머 얇은 띠(카메라
 * y=132 에서 수평선 아래 0.19°, 1km 높이면 1.4°)는 scene.background 의 EXR
 * 사진 바다(배경 없는 씬이면 clear color)라 미러 반사 물색과 다를 수 있다.
 * 이음새가 보이면 far 안에서 반경을 키운다 — 알파 페이드는 불가(transparent
 * 가 되면 투명 리스트로 옮겨 가 틴트 돔·오버레이 순서와 미러 패스 시점이
 * 깨진다). 중심은 원점 — 반경이 씬보다 훨씬 커서 어디에 두든 차이가 없다.
 */
const SEA_RADIUS = 40_000;
const SEA_SEGMENTS = 96;
/**
 * 불투명 씬 메시(0) 뒤, 편집기 격자(0.5)·선택 박스(1) 앞. 스텐실 테스트가
 * 불투명 메시 **전부**가 그려진 뒤여야 맞으므로 0 보다 커야 하고, 오버레이는
 * 바다 위에 보여야 하므로 그들보다 작아야 한다.
 */
const SEA_RENDER_ORDER = 0.25;
/** 반사 RT 한 변(px). 예제와 같다 — 줄이면 반사가 뭉개지는 대신 미러 패스가 싸진다. */
const WATER_REFLECTION_SIZE = 512;
/**
 * 수면 아래 산란색. 예제값(0x001e0f)은 거의 검정이라 낮엔 태양 확산 회색이,
 * 저녁엔 검정이 남았다 — 시각과 무관하게 "바다 파랑" 이 깔리도록 밝게 둔다.
 */
const WATER_COLOR = 0x123f5e;
/** 예제의 distortionScale — 반사상을 파도가 흔드는 세기. */
const WATER_DISTORTION_SCALE = 3.7;
/**
 * 비친 하늘의 밝기 배율(포크 전용, 예제엔 없다). EXR 수평선은 HDR 이라 1 이면
 * 얕은 각도의 바다가 흰색으로 날아간다 — 8bit RT 클램프 위에 이 값을 곱한다.
 * 멀리 있는 바다가 너무 희거나 어두우면 이 값 하나만 조정한다.
 */
const WATER_REFLECTION_INTENSITY = 0.3;
/**
 * 태양 확산 회색항 배율(포크 전용, 예제는 1). 예제 원값이면 낮에 이 회색이
 * 산란색을 8배로 덮어 물이 회색이 된다 — 낮에도 파랑이 남는 값으로 둔다.
 */
const WATER_SUN_DIFFUSE_INTENSITY = 0.25;
/**
 * 파도 시간 배율 — useFrame 의 delta 에 곱해 `time` 유니폼에 누적한다. 예제
 * 그대로(1)면 씬 단위가 m 인 야드에서 물결이 급류처럼 흐른다. 파도 모양·
 * 반사 왜곡은 그대로고 흐르는 속도만 이 값에 비례한다.
 */
const WATER_TIME_SCALE = 0.35;
/** three.js r183 examples/textures/waternormals.jpg (MIT) — HASHED_DIRS 의 textures. */
const WATER_NORMALS_PATH = '/textures/waternormals.jpg';

/**
 * 물 인스턴스별 반사 제외 지도 id — React 밖 슬롯. 물 memo 는 노멀맵에만
 * 의존해야 하고(maps 는 에디터 편집마다 새 배열이라 deps 에 넣으면 RT·
 * 머티리얼이 매번 재생성), 클로저로 잡으면 나중에 추가한 컨텍스트 지도가
 * 반사에서 빠지지 않는다. 훅이 돌려준 물은 effect 에서 고칠 수 없고
 * (react-hooks/immutability), ref 를 읽는 게터는 생성자 인자 검사
 * (react-hooks/refs)에 걸리므로 effect 가 여기에 쓰고 게터가 매 패스 읽는다.
 */
const excludedMapIdsByWater = new WeakMap<OceanWater, readonly string[]>();
const NO_MAP_IDS: readonly string[] = [];

/**
 * 미러 패스 제외 객체 — 돔·스프라이트 등록부에 이어 컨텍스트 지도 루트를
 * 매 패스 identity 조회한다(레지스트리 크기 감시는 같은 id 재등록을 놓친다).
 */
function* excludedObjectsOf(water: OceanWater) {
  yield* getReflectionExclusions();
  for (const id of excludedMapIdsByWater.get(water) ?? NO_MAP_IDS) {
    yield modelObjectRegistry.get(id);
  }
}

/** useFrame 이 읽고 쓰는 프레임 상태 — 훅이 돌려준 물을 직접 고치지 않는다. */
interface WaterFrameState {
  uniforms: OceanWaterUniforms;
  /** 마지막으로 유니폼에 반영한 sceneLightingInfo 튜플·세기 — 참조로 비교. */
  sunDirection: Vector3Tuple | null;
  sunColor: RgbTuple | null;
  sunIntensity: number;
}

function createFrameState(uniforms: OceanWaterUniforms): WaterFrameState {
  // null·NaN 이라 첫 프레임에 반드시 유니폼을 쓴다.
  return {
    uniforms,
    sunDirection: null,
    sunColor: null,
    sunIntensity: Number.NaN,
  };
}

export function SceneWater({ maps }: { maps?: SavedMapInfo[] }) {
  const normals = useLoader(TextureLoader, withBaseUrl(WATER_NORMALS_PATH));
  const invalidate = useThree((s) => s.invalidate);

  // 캐시 텍스처 변조는 lib 경유(훅 반환값 직접 변조 금지 —
  // applyEquirectBackground 선례). layout effect 인 이유: 물은 commit 에
  // 씬에 붙고 첫 미러 패스가 다음 rAF 에 돌 수 있는데, passive effect 는
  // paint 뒤라 첫 프레임이 ClampToEdge(평평한 물)로 그려진다.
  useLayoutEffect(() => {
    if (ensureRepeatWrapping(normals)) invalidate();
  }, [normals, invalidate]);

  const { geometry, water } = useMemo(() => {
    const geometry = new CircleGeometry(SEA_RADIUS, SEA_SEGMENTS);
    const water: OceanWater = new OceanWater(geometry, {
      textureWidth: WATER_REFLECTION_SIZE,
      textureHeight: WATER_REFLECTION_SIZE,
      waterNormals: normals,
      sunDirection: new Vector3(0, 1, 0),
      sunColor: 0xffffff,
      waterColor: WATER_COLOR,
      distortionScale: WATER_DISTORTION_SCALE,
      reflectionIntensity: WATER_REFLECTION_INTENSITY,
      sunDiffuseIntensity: WATER_SUN_DIFFUSE_INTENSITY,
      alpha: 1,
      fog: false,
      // 미러 패스마다 호출 — 이 물의 슬롯(excludedMapIdsByWater)을 읽는다.
      excludedObjects: () => excludedObjectsOf(water),
    });
    water.rotation.x = -Math.PI / 2;
    water.position.y = SEA_LEVEL_Y;
    water.renderOrder = SEA_RENDER_ORDER;
    water.raycast = () => {};
    water.name = 'scene-water';
    return { geometry, water };
  }, [normals]);

  const excludedIds = useMemo(
    () => resolveReflectionExcludedMapIds(maps),
    [maps],
  );
  // layout effect — 첫 미러 패스(다음 rAF)보다 먼저 슬롯이 차 있어야
  // 컨텍스트 지형(수백만 삼각형)이 첫 프레임 반사에 들어가지 않는다.
  useLayoutEffect(() => {
    excludedMapIdsByWater.set(water, excludedIds);
    return () => {
      excludedMapIdsByWater.delete(water);
    };
  }, [water, excludedIds]);

  // R3F 는 removeChild 에서 invalidate 하지 않아(parent 를 먼저 null) 끈 뒤
  // 마지막 프레임이 남는다 — 직접 깨운다(EnvironmentBackground 와 같은 처리).
  useEffect(
    () => () => {
      geometry.dispose();
      water.dispose();
      invalidate();
    },
    [geometry, water, invalidate],
  );

  const frameRef = useRef<WaterFrameState>(createFrameState(water.uniforms));
  useLayoutEffect(() => {
    frameRef.current = createFrameState(water.uniforms);
  }, [water]);

  useFrame((_, delta) => {
    const state = frameRef.current;
    // 예제와 같이 무한 누적 — 며칠 연속 가동하면 float32 정밀도로 파도가
    // 거칠어진다(이전 셰이더도 같았다). wrap 은 레이어 주기가 서로 소수라
    // 어디서든 튄다 — docs/agents/rendering-perf.md 미룬 것.
    state.uniforms.time.value += delta * WATER_TIME_SCALE;

    const { sunDirection, sunColor, sunIntensity } = sceneLightingInfo;
    if (
      sunDirection === state.sunDirection &&
      sunColor === state.sunColor &&
      sunIntensity === state.sunIntensity
    ) {
      return;
    }
    state.sunDirection = sunDirection;
    state.sunColor = sunColor;
    state.sunIntensity = sunIntensity;
    const sun = resolveWaterSunUniforms(sunDirection, sunColor, sunIntensity);
    state.uniforms.sunDirection.value.set(
      sun.direction[0],
      sun.direction[1],
      sun.direction[2],
    );
    // linear working space — setColorIfChanged 와 같은 규약.
    state.uniforms.sunColor.value.setRGB(
      sun.color[0],
      sun.color[1],
      sun.color[2],
    );
  });

  return <primitive object={water} />;
}
