import { Grid, Html, OrbitControls, useGLTF } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  Box as BoxIcon,
  Camera,
  Grid3x3,
  Rotate3d,
  RotateCcw,
  RotateCw,
  Ruler,
  SunMoon,
} from 'lucide-react';
import {
  Suspense,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  AnimationMixer,
  Box3,
  PMREMGenerator,
  type Object3D,
  type PerspectiveCamera,
} from 'three';
import { RoomEnvironment, SkeletonUtils } from 'three/examples/jsm/Addons.js';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { Vector3Tuple } from '@crane/core/types/math';
import { cn } from '@crane/core/lib/utils';
import { extendGltfLoaderWithKtx2 } from '@crane/domain/3d';
import {
  formatMeters,
  pickGridStep,
  type AssetStats,
} from '@crane/domain/asset-library';
import { VIEWER_GLASS_BAR } from '../lib/asset-presentation';
import { renderThumbnail } from '../lib/thumbnail-crop';
import {
  DEFAULT_VIEW_MODE,
  nextViewerBackground,
  type ViewerBackground,
  type ViewerDisplay,
} from '../lib/viewer-display-state';
import { useViewerDisplay } from '../model/use-viewer-display';
import {
  applyLodLevel,
  applyViewMode,
  ASSET_VIEW_MODES,
  computeFramingPose,
  computeObjectStats,
  computeRenderBounds,
  countLodLevels,
  createPlaybackClock,
  createViewModeMaterials,
  DEFAULT_PLAYBACK_SPEED,
  disposeViewModeMaterials,
  fromRelativeCameraPose,
  listPlaybackClips,
  matchPlaybackClip,
  orbitCameraPose,
  resolvePlaybackClip,
  REST_POSE_CLIP,
  toRelativeCameraPose,
  VIEW_PRESETS,
  VIEWER_ORBIT_STEP_DEG,
  type AssetViewMode,
  type FramingBounds,
  type OrbitDirection,
  type OriginalMaterialMap,
  type PlaybackClip,
  type PlaybackClock,
  type ViewerCameraSync,
  type ViewPreset,
} from '@crane/features/asset-library';
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
} from '@crane/ui/molecules/select';
import { TooltipProvider } from '@crane/ui/molecules/tooltip';
import { AssetPlaybackBar } from './asset-playback-bar';
import {
  ViewerErrorBoundary,
  ViewerIconButton,
  ViewerLoadingOverlay,
} from './asset-viewer-chrome';

/**
 * 자산 한 개를 살펴보는 3D 뷰어.
 *
 * 모니터링 씬 뷰어(ThreeSceneViewer)와 따로 둔 이유: 그쪽은 지도 위를 날아
 * 다니는 카메라(표면 기준 줌·이동 범위 제한)이고, 여기는 물체 하나를 돌려
 * 보는 카메라다. 캔버스는 `frameloop="demand"` 이고 턴테이블이나 애니메이션을
 * 돌리는 동안만 계속 그린다.
 *
 * GLB 로드는 다른 화면과 같은 구성(`extendGltfLoaderWithKtx2`)을 쓴다 —
 * KTX2 텍스처가 든 GLB 는 이 배선이 없으면 파스 단계에서 던진다. 바다가
 * 없는 뷰어라 스텐실 표식(markSceneOpaqueStencil)은 필요 없다.
 */

const FOV_DEG = 35;
const THUMBNAIL_SIZE = 512;
/** 도우미(격자·경계 상자) 묶음 — 썸네일을 찍을 때 통째로 숨긴다. */
const HELPERS_GROUP_NAME = 'asset-viewer-helpers';

/**
 * 배경별 색. 치수선은 브랜드 주황을 쓰지 않는다 — 조선소 크레인은 주황·노랑
 * 도장이 많아 물체와 섞인다. 배경과 가장 대비되는 무채색으로 그린다.
 */
const BACKGROUND_STYLE: Record<
  ViewerBackground,
  {
    surface: string;
    gridMajor: string;
    gridMinor: string;
    wire: string;
    dimension: string;
    dimensionLabel: string;
  }
> = {
  dark: {
    surface: 'bg-[radial-gradient(120%_90%_at_50%_35%,#2b2d32_0%,#1b1c1f_70%)]',
    gridMajor: '#6a717c',
    gridMinor: '#3d4147',
    wire: '#a9b4c2',
    dimension: '#e9edf2',
    dimensionLabel: 'bg-white text-zinc-900',
  },
  light: {
    surface: 'bg-[radial-gradient(120%_90%_at_50%_35%,#f6f7f9_0%,#e3e6ea_75%)]',
    gridMajor: '#8d96a3',
    gridMinor: '#c3c9d1',
    wire: '#3a4350',
    dimension: '#222a33',
    dimensionLabel: 'bg-zinc-900 text-white',
  },
  // 청사진 — 도면 바탕 위에 물체를 올려 본다.
  blueprint: {
    surface: 'bg-[radial-gradient(120%_90%_at_50%_35%,#16395b_0%,#0b2238_75%)]',
    gridMajor: '#7fb4e2',
    gridMinor: '#2f5f8a',
    wire: '#cfe6fb',
    dimension: '#ffffff',
    dimensionLabel: 'bg-white text-[#0f2c47]',
  },
};

export interface AssetViewerHandle {
  /** 지금 보이는 시점을 정사각 투명 PNG 로 찍는다. 도우미는 빠진다. */
  captureThumbnail: () => Promise<Blob | null>;
}

export interface AssetViewerLoaded {
  stats: AssetStats;
}

interface AssetModelViewerProps {
  /**
   * 열 파일. `null` 이면 아직 열지 않는다 — 자리와 조작 도구, 불러오는 표시만
   * 그리고 파일은 받지 않는다(목록에서 지나치는 자산).
   */
  url: string | null;
  /** 뷰어 아래에 놓이는 표제란. */
  titleBlock?: ReactNode;
  handleRef?: Ref<AssetViewerHandle>;
  onLoaded?: (info: AssetViewerLoaded) => void;
  /** 모델이 올라오고 카메라가 맞춰진 뒤 한 번 — 이때부터 썸네일을 찍을 수 있다. */
  onReady?: () => void;
  /** 썸네일 저장 버튼. 없으면 버튼을 그리지 않는다. */
  onSaveThumbnail?: () => void;
  /**
   * 조작 도구. `full` 은 전부, `compact` 는 좁은 자리(목록의 미리보기)에 맞는
   * 표시 토글만, `none` 은 없음(나란히 보기의 오른쪽).
   */
  toolbar?: 'full' | 'compact' | 'none';
  /** 표시 상태를 바깥이 들 때(나란히 보기). 없으면 뷰어가 직접 든다. */
  display?: ViewerDisplay;
  onDisplayChange?: (patch: Partial<ViewerDisplay>) => void;
  /** 다른 뷰어와 카메라를 맞물린다. `id` 는 통로 안에서 이 뷰어의 이름. */
  cameraSync?: { bus: ViewerCameraSync; id: string };
  /**
   * 다른 뷰어와 애니메이션 시계를 같이 쓴다(나란히 보기). `drive` 가 미는
   * 쪽이고 아닌 쪽은 읽기만 한다. 없으면 뷰어가 시계를 직접 든다.
   */
  playbackSync?: { clock: PlaybackClock; drive: boolean };
  /** 뷰어 왼쪽 아래에 놓이는 꼬리표(어느 버전인지 등). */
  cornerLabel?: ReactNode;
}

interface ModelInfo {
  stats: AssetStats;
  bounds: Box3;
  lodLevels: number;
  clips: PlaybackClip[];
}

/** 모델 쪽에 넘기는 재생 상태. 시계는 바깥(또는 비교 뷰)이 든다. */
interface ViewerPlayback {
  clip: PlaybackClip | null;
  playing: boolean;
  speed: number;
  clock: PlaybackClock;
  /** 시계를 미는 쪽인가. 따라가는 쪽(비교의 새 버전)은 읽기만 한다. */
  drive: boolean;
}

const EMPTY_CLIPS: PlaybackClip[] = [];

function ViewerModel({
  url,
  viewMode,
  lodLevel,
  wireColor,
  playback,
  onInfo,
}: {
  url: string;
  viewMode: AssetViewMode;
  lodLevel: number;
  wireColor: string;
  playback: ViewerPlayback;
  onInfo: (info: ModelInfo) => void;
}) {
  const gltf = useGLTF(url, true, true, extendGltfLoaderWithKtx2);
  const invalidate = useThree((state) => state.invalidate);
  const object = useMemo<Object3D>(
    () => SkeletonUtils.clone(gltf.scene),
    [gltf.scene],
  );
  const originalsRef = useRef<OriginalMaterialMap>(new Map());
  const materials = useMemo(() => createViewModeMaterials('#ffffff'), []);

  // 통계는 뷰 모드·LOD 를 적용하기 **전에** 잰다(effect 는 선언 순서로 돈다).
  // 뒤에 재면 교체된 머티리얼과 숨겨진 LOD 가 수치에 섞인다. 애니메이션도
  // 아직 자세를 바꾸기 전이라 경계(치수·격자)는 rest 자세 기준이다.
  useEffect(() => {
    onInfo({
      stats: computeObjectStats(object, gltf.animations.length),
      bounds: computeRenderBounds(object),
      lodLevels: countLodLevels(object),
      clips: listPlaybackClips(gltf.animations),
    });
  }, [gltf.animations, object, onInfo]);

  useEffect(() => {
    applyLodLevel(object, lodLevel);
    invalidate();
  }, [invalidate, lodLevel, object]);

  useEffect(() => {
    materials.wireframe.color.set(wireColor);
    applyViewMode(object, viewMode, materials, originalsRef.current);
    invalidate();
  }, [invalidate, materials, object, viewMode, wireColor]);

  useEffect(() => {
    const originals = originalsRef.current;
    return () => {
      // 원본 머티리얼은 캐시와 공유한다 — 교체용만 버린다.
      originals.clear();
      disposeViewModeMaterials(materials);
    };
  }, [materials]);

  // 애니메이션은 사본에 건다 — 클립은 노드 이름으로 바인딩되므로 캐시의 원본
  // 클립을 그대로 쓴다. 화면을 떠나면 바인딩을 풀어 사본이 캐시에 남지 않게.
  const mixer = useMemo(() => new AnimationMixer(object), [object]);
  useEffect(
    () => () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(object);
    },
    [mixer, object],
  );

  const { clip, playing, speed, clock, drive } = playback;
  const animation = clip ? (gltf.animations[clip.index] ?? null) : null;
  useEffect(() => {
    // 클립을 떼면(앞 effect 의 정리) three 가 바인딩할 때 저장해 둔 원래 값으로
    // 뼈대가 돌아간다 — 그 기본 자세를 한 프레임 그린다.
    if (!animation) {
      invalidate();
      return;
    }
    const action = mixer.clipAction(animation);
    action.reset().play();
    mixer.setTime(clock.getTime());
    invalidate();
    return () => {
      action.stop();
      mixer.uncacheAction(animation);
    };
  }, [animation, clock, invalidate, mixer]);

  // 멈춘 채 위치를 옮기면(demand 루프) 옮긴 자세를 한 프레임 다시 그린다.
  useEffect(() => clock.subscribe(invalidate), [clock, invalidate]);

  // 매 프레임 시계의 시각을 그대로 자세에 놓는다 — 미는 쪽과 따라가는 쪽이
  // 같은 코드라 두 캔버스가 같은 자세를 그린다. 배속은 시계가 곱한다.
  useFrame((_, delta) => {
    if (!animation || !clip) return;
    if (drive && playing) clock.advance(delta, speed, clip.durationSec);
    mixer.setTime(clock.getTime());
  });

  return <primitive object={object} />;
}

interface ViewerRigHandle extends AssetViewerHandle {
  frame: (preset: ViewPreset) => void;
  /** 대상 둘레로 카메라를 한 걸음 돌린다 — 물체가 그쪽으로 도는 것처럼 보인다. */
  orbit: (direction: OrbitDirection) => void;
}

/**
 * 바깥에서 정한 카메라 자세를 컨트롤에 반영한다. 감쇠를 잠시 끄고 update —
 * 켠 채면 직전 드래그의 관성이 방금 맞춘 포즈를 흘려 보낸다(ThreeSceneViewer
 * 와 같은 이유).
 */
function settleControls(controls: OrbitControlsImpl) {
  const damping = controls.enableDamping;
  controls.enableDamping = false;
  controls.update();
  controls.enableDamping = damping;
}

function ViewerRig({
  bounds,
  turntable,
  handleRef,
  onFramed,
  cameraSync,
}: {
  bounds: Box3 | null;
  turntable: boolean;
  handleRef: Ref<ViewerRigHandle>;
  /** 새 모델에 카메라를 맞춘 직후. 이때부터 화면을 찍을 수 있다. */
  onFramed: () => void;
  cameraSync?: { bus: ViewerCameraSync; id: string };
}) {
  // 카메라·렌더러는 콜백 안에서 스토어로 읽는다 — 프레이밍이 카메라의 near/far
  // 를 직접 고치는데, 훅이 돌려준 값을 고치는 것은 컴파일러 규칙이 막는다.
  const getState = useThree((state) => state.get);
  const invalidate = useThree((state) => state.invalidate);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  const frame = useCallback(
    (preset: ViewPreset) => {
      const controls = controlsRef.current;
      if (!bounds || bounds.isEmpty() || !controls) return;
      const { gl } = getState();
      const camera = getState().camera as PerspectiveCamera;
      const canvas = gl.domElement;
      const pose = computeFramingPose(
        {
          min: bounds.min.toArray() as Vector3Tuple,
          max: bounds.max.toArray() as Vector3Tuple,
        },
        camera.fov,
        canvas.clientWidth / Math.max(1, canvas.clientHeight),
        preset,
      );
      camera.position.fromArray(pose.position);
      // 물체 크기에 맞춘 깊이 범위 — 수 cm 부품과 수 km 지형을 같은 뷰어로 본다.
      camera.near = Math.max(pose.radius / 500, 0.001);
      camera.far = (pose.distance + pose.radius) * 12;
      camera.updateProjectionMatrix();
      controls.target.fromArray(pose.target);
      controls.minDistance = pose.radius * 0.05;
      controls.maxDistance = pose.distance * 6;
      settleControls(controls);
      invalidate();
    },
    [bounds, getState, invalidate],
  );

  const orbit = useCallback(
    (direction: OrbitDirection) => {
      const controls = controlsRef.current;
      if (!controls) return;
      const camera = getState().camera;
      const pose = orbitCameraPose(
        {
          position: camera.position.toArray() as Vector3Tuple,
          target: controls.target.toArray() as Vector3Tuple,
        },
        direction,
      );
      camera.position.fromArray(pose.position);
      // update 가 change 를 내보내므로 맞물린 다른 뷰어도 따라온다.
      settleControls(controls);
      invalidate();
    },
    [getState, invalidate],
  );

  // 새 모델이 준비되면 전체가 보이게 맞춘다. 캔버스 안은 별도의 React 루트라
  // 바깥 상태가 여기까지 오는 시점이 프레임과 맞물리지 않는다 — "찍어도 되는
  // 때" 는 바깥에서 프레임 수로 짐작하지 않고 여기서 알린다.
  useEffect(() => {
    if (!bounds || bounds.isEmpty()) return;
    frame('iso');
    onFramed();
  }, [bounds, frame, onFramed]);

  // 카메라 맞물림 — 내 카메라가 움직이면 물체 기준 상대 자세로 내보내고,
  // 다른 뷰어가 보낸 자세는 내 물체의 경계로 되돌려 적용한다. 적용 중에 나는
  // change 는 되받아 보내지 않는다(서로 주고받으며 끝없이 돈다).
  const syncBus = cameraSync?.bus;
  const syncId = cameraSync?.id;
  useEffect(() => {
    const controls = controlsRef.current;
    if (!syncBus || !syncId || !controls || !bounds || bounds.isEmpty()) {
      return;
    }
    const framing: FramingBounds = {
      min: bounds.min.toArray() as Vector3Tuple,
      max: bounds.max.toArray() as Vector3Tuple,
    };
    let applying = false;
    const handleChange = () => {
      if (applying) return;
      const relative = toRelativeCameraPose(
        {
          position: getState().camera.position.toArray() as Vector3Tuple,
          target: controls.target.toArray() as Vector3Tuple,
        },
        framing,
      );
      if (relative) syncBus.publish(syncId, relative);
    };
    controls.addEventListener('change', handleChange);
    const unsubscribe = syncBus.subscribe((sourceId, relative) => {
      if (sourceId === syncId) return;
      const pose = fromRelativeCameraPose(relative, framing);
      applying = true;
      getState().camera.position.fromArray(pose.position);
      controls.target.fromArray(pose.target);
      settleControls(controls);
      applying = false;
      invalidate();
    });
    return () => {
      controls.removeEventListener('change', handleChange);
      unsubscribe();
    };
  }, [bounds, getState, invalidate, syncBus, syncId]);

  useImperativeHandle(
    handleRef,
    () => ({
      frame,
      orbit,
      captureThumbnail: () => {
        const { camera, gl, scene } = getState();
        const helpers = scene.getObjectByName(HELPERS_GROUP_NAME);
        const wasVisible = helpers?.visible ?? false;
        if (helpers) helpers.visible = false;
        gl.render(scene, camera);
        // 그리기 버퍼는 이 태스크가 끝나면 비워질 수 있다 — 렌더 직후
        // 동기로 2D 캔버스에 옮겨 둔다.
        const canvas = renderThumbnail(gl.domElement, THUMBNAIL_SIZE);
        if (helpers) helpers.visible = wasVisible;
        invalidate();
        return new Promise<Blob | null>((resolve) => {
          if (!canvas) resolve(null);
          else canvas.toBlob(resolve, 'image/png');
        });
      },
    }),
    [frame, getState, invalidate, orbit],
  );

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.12}
      autoRotate={turntable}
      autoRotateSpeed={1.6}
    />
  );
}

function DimensionLabel({
  position,
  axis,
  meters,
  className,
}: {
  position: Vector3Tuple;
  axis: string;
  meters: number;
  className: string;
}) {
  return (
    <Html position={position} center zIndexRange={[5, 0]}>
      <span
        className={cn(
          'font-condensed pointer-events-none flex items-baseline gap-1 rounded-sm px-1.5 py-0.5 text-[11px] leading-none font-semibold whitespace-nowrap tabular-nums shadow-sm',
          className,
        )}
      >
        <span className="opacity-60">{axis}</span>
        {formatMeters(meters)}
      </span>
    </Html>
  );
}

function ViewerHelpers({
  bounds,
  showGrid,
  showDimensions,
  background,
}: {
  bounds: Box3;
  showGrid: boolean;
  showDimensions: boolean;
  background: ViewerBackground;
}) {
  const { min, max } = bounds;
  const sizeX = max.x - min.x;
  const sizeY = max.y - min.y;
  const sizeZ = max.z - min.z;
  const step = pickGridStep(Math.max(sizeX, sizeZ));
  const radius = 0.5 * Math.hypot(sizeX, sizeY, sizeZ) || 1;
  const tone = BACKGROUND_STYLE[background];
  const dimensionBox = useMemo(() => bounds.clone(), [bounds]);
  const invalidate = useThree((state) => state.invalidate);

  // R3F 는 객체를 붙일 때만 프레임을 요청하고 뗄 때는 요청하지 않는다 — 다시
  // 그리라고 알리지 않으면 꺼진 격자·경계 상자가 카메라를 움직일 때까지 남는다.
  useEffect(() => {
    invalidate();
  }, [invalidate, showDimensions, showGrid]);

  return (
    <group name={HELPERS_GROUP_NAME}>
      {showGrid ? (
        <>
          {/* 멀어질수록 흐려지는 바닥 격자 — 가장자리가 잘린 판으로 보이지 않고,
              물체에서 먼 선이 화면을 어지럽히지 않는다. 굵은 선은 5칸마다.
              물체 바닥과 같은 높이면 겹쳐 깜빡이므로 아주 조금 내린다. */}
          <Grid
            position={[
              (min.x + max.x) / 2,
              min.y - radius * 0.0015,
              (min.z + max.z) / 2,
            ]}
            infiniteGrid
            followCamera={false}
            cellSize={step}
            sectionSize={step * 5}
            cellThickness={0.9}
            sectionThickness={1.4}
            cellColor={tone.gridMinor}
            sectionColor={tone.gridMajor}
            fadeDistance={radius * 9}
            fadeStrength={1.6}
          />
        </>
      ) : null}
      {showDimensions ? (
        <>
          <box3Helper key={background} args={[dimensionBox, tone.dimension]} />
          <DimensionLabel
            className={tone.dimensionLabel}
            axis="W"
            position={[(min.x + max.x) / 2, min.y, max.z]}
            meters={sizeX}
          />
          <DimensionLabel
            className={tone.dimensionLabel}
            axis="D"
            position={[max.x, min.y, (min.z + max.z) / 2]}
            meters={sizeZ}
          />
          <DimensionLabel
            className={tone.dimensionLabel}
            axis="H"
            // 폭·깊이 꼬리표는 앞·오른쪽 바닥 모서리의 가운데에 있다. 높이는
            // 둘에서 가장 먼 앞-왼쪽 세로 모서리에 둔다 — 납작하고 긴 물체에서
            // 오른쪽 모서리에 두면 깊이 꼬리표와 겹친다.
            position={[min.x, (min.y + max.y) / 2, max.z]}
            meters={sizeY}
          />
        </>
      ) : null}
    </group>
  );
}

/**
 * 반사 환경. 금속·도장면은 비칠 것이 있어야 재질로 읽힌다 — 조명만으로는
 * 납작한 단색이 된다. HDRI 파일 대신 three 의 절차적 실내(RoomEnvironment)를
 * 쓴다: 폐쇄망이라 CDN 프리셋을 받을 수 없고, 자산 하나를 보는 데 수 MB 짜리
 * 배경을 내려받을 이유도 없다.
 */
function ViewerEnvironment() {
  const getState = useThree((state) => state.get);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    const { gl, scene } = getState();
    const generator = new PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const target = generator.fromScene(room, 0.04);
    scene.environment = target.texture;
    scene.environmentIntensity = 0.55;
    invalidate();
    return () => {
      scene.environment = null;
      target.dispose();
      generator.dispose();
      room.dispose();
    };
  }, [getState, invalidate]);

  return null;
}

export function AssetModelViewer({
  url,
  titleBlock,
  handleRef,
  onLoaded,
  onReady,
  onSaveThumbnail,
  toolbar = 'full',
  display: controlledDisplay,
  onDisplayChange,
  cameraSync,
  playbackSync,
  cornerLabel,
}: AssetModelViewerProps) {
  const { t } = useTranslation();
  const rigRef = useRef<ViewerRigHandle | null>(null);

  const own = useViewerDisplay();
  // 캔버스가 놓이는 자리. R3F 는 만들어진 뒤 비동기로 이벤트를 이 요소에 건다 —
  // 요소를 직접 넘겨 두면, 그 사이 뷰어가 사라져도(목록을 빠르게 넘길 때)
  // 없는 요소에 걸다 던지지 않는다.
  const [surface, setSurface] = useState<HTMLDivElement | null>(null);
  const display = controlledDisplay ?? own.display;
  const setDisplay = onDisplayChange ?? own.setDisplay;
  const { background, showGrid, showDimensions, turntable } = display;
  const compact = toolbar === 'compact';
  // 좁은 자리에는 표시 방식 버튼이 없다 — 다른 화면에서 고른 방식을 여기서
  // 되돌릴 길이 없으므로 기본 방식으로만 보인다.
  const viewMode = compact ? DEFAULT_VIEW_MODE : display.viewMode;
  const [lodLevel, setLodLevel] = useState(0);
  // 로드 결과는 URL 에 묶어 둔다 — 다른 파일로 바뀌면 옛 결과가 한 프레임도
  // 보이지 않는다.
  const [loaded, setLoaded] = useState<{ url: string; info: ModelInfo } | null>(
    null,
  );
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  const info = url !== null && loaded?.url === url ? loaded.info : null;
  const failed = url !== null && failedUrl === url;

  // 애니메이션 — 시계는 나란히 보기가 넘기면 그것을, 아니면 내 것을 쓴다.
  const ownClock = useMemo(() => createPlaybackClock(), []);
  const clock = playbackSync?.clock ?? ownClock;
  const drive = playbackSync?.drive ?? true;
  const clips = info?.clips ?? EMPTY_CLIPS;
  // 좁은 자리에는 재생 조작이 없다 — 기억한 멈춤·배속을 되돌릴 길이 없으므로
  // 첫 클립을 1× 로 돌린다. 따라가는 쪽은 고른 이름의 클립만 돌고 없으면 멈춘다
  // (다른 클립으로 대신 돌면 비교가 되지 않는다).
  const clip = compact
    ? resolvePlaybackClip(clips, null)
    : drive
      ? resolvePlaybackClip(clips, display.animationClip)
      : matchPlaybackClip(clips, display.animationClip);
  const playing = compact ? true : display.animationPlaying;
  const speed = compact ? DEFAULT_PLAYBACK_SPEED : display.animationSpeed;
  const playback = useMemo<ViewerPlayback>(
    () => ({ clip, playing, speed, clock, drive }),
    [clip, clock, drive, playing, speed],
  );
  const animating = playing && clip !== null;
  const playbackControls = toolbar === 'full' && clips.length > 0;

  useImperativeHandle(
    handleRef,
    () => ({
      captureThumbnail: () =>
        rigRef.current?.captureThumbnail() ?? Promise.resolve(null),
    }),
    [],
  );

  // 콜백은 ref 로 읽는다 — 호출부가 매 렌더 새 함수를 넘겨도 모델 쪽 effect 가
  // 다시 돌지 않는다(다시 돌면 통계 보고 → 리렌더가 되풀이된다).
  const onLoadedRef = useRef(onLoaded);
  const onReadyRef = useRef(onReady);
  const setDisplayRef = useRef(setDisplay);
  const restPoseRef = useRef(display.animationClip === REST_POSE_CLIP);
  useEffect(() => {
    onLoadedRef.current = onLoaded;
    onReadyRef.current = onReady;
    setDisplayRef.current = setDisplay;
    restPoseRef.current = display.animationClip === REST_POSE_CLIP;
  }, [display.animationClip, onLoaded, onReady, setDisplay]);
  // 카메라를 맞추기 전의 한 프레임(모델이 화면 가득 크게 그려진다)을 보이지
  // 않게, 맞춘 뒤에야 캔버스를 드러낸다.
  const [framedUrl, setFramedUrl] = useState<string | null>(null);
  const handleFramed = useCallback(() => {
    setFramedUrl(url);
    onReadyRef.current?.();
  }, [url]);
  const handleInfo = useCallback(
    (next: ModelInfo) => {
      if (url === null) return;
      setLoaded({ url, info: next });
      setLodLevel(0);
      // 클립 이름은 자산마다 다르다 — 새 파일이 올라오면 첫 클립부터. "애니메이션
      // 없음" 은 자산과 무관한 취향이라 그대로 두고, 따라가는 쪽은 미는 쪽이
      // 고른 이름을 그대로 둔다.
      if (drive && !restPoseRef.current) {
        setDisplayRef.current({ animationClip: null });
      }
      onLoadedRef.current?.({ stats: next.stats });
    },
    [drive, url],
  );

  // 뷰어에 초점이 있을 때 Space 로 멈추고 다시 돌린다. 목록의 Space(미리보기
  // 열기)와 겹치지 않게 조작이 있는 뷰어에서만 받는다.
  const handleSurfaceKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== ' ' || !playbackControls || clip === null) return;
    event.preventDefault();
    setDisplay({ animationPlaying: !playing });
  };

  // 화면을 떠나면 이 파일의 파싱 결과를 캐시에서 놓는다 — 자산을 여러 개
  // 열어 볼수록 수십 MB 씩 쌓이는 것을 막는다.
  useEffect(() => {
    if (url === null) return;
    return () => {
      try {
        useGLTF.clear(url);
      } catch {
        // 캐시에 없으면 그만이다.
      }
    };
  }, [url]);

  const tone = BACKGROUND_STYLE[background];
  const light = background === 'light';

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={cn('relative min-h-0 flex-1', tone.surface)}>
        <div
          ref={setSurface}
          tabIndex={playbackControls ? 0 : undefined}
          onKeyDown={playbackControls ? handleSurfaceKeyDown : undefined}
          className={cn(
            'absolute inset-0 transition-opacity duration-200 outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-inset',
            framedUrl === url ? 'opacity-100' : 'opacity-0',
          )}
        >
          {surface && url !== null ? (
            <Canvas
              key={url}
              eventSource={surface}
              frameloop={turntable || animating ? 'always' : 'demand'}
              dpr={[1, 1.5]}
              gl={{ alpha: true, antialias: true }}
              camera={{
                fov: FOV_DEG,
                near: 0.1,
                far: 5000,
                position: [6, 4, 6],
              }}
            >
              <ViewerEnvironment />
              <hemisphereLight args={['#ffffff', '#59616e', 0.55]} />
              <directionalLight position={[6, 10, 7]} intensity={2.3} />
              <directionalLight position={[-7, 4, -5]} intensity={0.5} />
              <ViewerErrorBoundary onError={() => setFailedUrl(url)}>
                <Suspense fallback={null}>
                  <ViewerModel
                    url={url}
                    viewMode={viewMode}
                    lodLevel={lodLevel}
                    wireColor={tone.wire}
                    playback={playback}
                    onInfo={handleInfo}
                  />
                </Suspense>
              </ViewerErrorBoundary>
              {info ? (
                <ViewerHelpers
                  bounds={info.bounds}
                  showGrid={showGrid}
                  showDimensions={showDimensions}
                  background={background}
                />
              ) : null}
              <ViewerRig
                bounds={info?.bounds ?? null}
                turntable={turntable}
                handleRef={rigRef}
                onFramed={handleFramed}
                cameraSync={cameraSync}
              />
            </Canvas>
          ) : null}
        </div>

        {failed ? (
          <div
            role="alert"
            className={cn(
              'absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 px-6 text-center',
              light ? 'text-zinc-700' : 'text-white/85',
            )}
          >
            <BoxIcon className="size-6 opacity-60" />
            <p className="text-sm font-medium">
              {t('asset-library:viewer.loadFailed')}
            </p>
            <p className="max-w-sm text-xs opacity-75">
              {t('asset-library:viewer.loadFailedHint')}
            </p>
          </div>
        ) : info ? null : (
          <ViewerLoadingOverlay light={light} subject="model" />
        )}

        {cornerLabel ? (
          <div className="pointer-events-none absolute bottom-3 left-3 z-10">
            {cornerLabel}
          </div>
        ) : null}

        {/* 따라가는 쪽에 고른 이름의 클립이 없으면 멈춘 채 그 사실만 적는다. */}
        {!drive &&
        clip === null &&
        clips.length > 0 &&
        display.animationClip !== null &&
        display.animationClip !== REST_POSE_CLIP ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center">
            <span className="rounded-md bg-black/55 px-2 py-1 text-xs font-medium text-white shadow-sm backdrop-blur-md">
              {t('asset-library:viewer.clipMissing', {
                name: display.animationClip,
              })}
            </span>
          </div>
        ) : null}

        {toolbar === 'none' ? null : (
          <TooltipProvider delay={150}>
            <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex flex-wrap items-start justify-between gap-2">
              <div className="pointer-events-auto flex items-center gap-2">
                {toolbar === 'full' ? (
                  <div
                    role="group"
                    aria-label={t('asset-library:viewer.viewMode')}
                    className={VIEWER_GLASS_BAR}
                  >
                    {ASSET_VIEW_MODES.map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        aria-pressed={viewMode === mode}
                        onClick={() => setDisplay({ viewMode: mode })}
                        className={cn(
                          'h-7 cursor-pointer rounded-md px-2.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/70',
                          viewMode === mode
                            ? 'bg-white text-zinc-900'
                            : 'text-white/75 hover:bg-white/15 hover:text-white',
                        )}
                      >
                        {t(`asset-library:viewer.mode.${mode}`)}
                      </button>
                    ))}
                  </div>
                ) : null}
                {toolbar === 'full' && info && info.lodLevels > 1 ? (
                  <Select
                    value={String(lodLevel)}
                    onValueChange={(value) => setLodLevel(Number(value))}
                  >
                    <SelectTrigger
                      aria-label={t('asset-library:viewer.lod')}
                      label={`LOD ${lodLevel}`}
                      className="h-9 rounded-lg border-0 bg-black/50 px-3 text-white shadow-sm backdrop-blur-md hover:bg-black/65"
                    />
                    <SelectPopup>
                      {Array.from({ length: info.lodLevels }, (_, level) => (
                        <SelectItem key={level} value={String(level)}>
                          LOD {level}
                        </SelectItem>
                      ))}
                    </SelectPopup>
                  </Select>
                ) : null}
              </div>

              <div
                role="group"
                aria-label={t('asset-library:viewer.display')}
                className={cn(VIEWER_GLASS_BAR, 'pointer-events-auto')}
              >
                <ViewerIconButton
                  label={t('asset-library:viewer.grid')}
                  pressed={showGrid}
                  onClick={() => setDisplay({ showGrid: !showGrid })}
                >
                  <Grid3x3 />
                </ViewerIconButton>
                <ViewerIconButton
                  label={t('asset-library:viewer.dimensions')}
                  pressed={showDimensions}
                  onClick={() =>
                    setDisplay({ showDimensions: !showDimensions })
                  }
                >
                  <Ruler />
                </ViewerIconButton>
                <ViewerIconButton
                  label={t('asset-library:viewer.turntable')}
                  pressed={turntable}
                  onClick={() => setDisplay({ turntable: !turntable })}
                >
                  <Rotate3d />
                </ViewerIconButton>
                <span aria-hidden className="mx-0.5 h-4 w-px bg-white/20" />
                <ViewerIconButton
                  label={t('asset-library:viewer.background', {
                    name: t(
                      `asset-library:viewer.backgroundName.${background}`,
                    ),
                  })}
                  onClick={() =>
                    setDisplay({ background: nextViewerBackground(background) })
                  }
                >
                  <SunMoon />
                </ViewerIconButton>
                {toolbar === 'full' && onSaveThumbnail ? (
                  <ViewerIconButton
                    label={t('asset-library:viewer.saveThumbnail')}
                    onClick={onSaveThumbnail}
                  >
                    <Camera />
                  </ViewerIconButton>
                ) : null}
              </div>
            </div>

            {toolbar === 'full' ? (
              <div className="pointer-events-none absolute right-3 bottom-3 z-10 flex justify-end">
                <div
                  role="group"
                  aria-label={t('asset-library:viewer.camera')}
                  className={cn(VIEWER_GLASS_BAR, 'pointer-events-auto')}
                >
                  <ViewerIconButton
                    label={t('asset-library:viewer.rotateCcw', {
                      degrees: VIEWER_ORBIT_STEP_DEG,
                    })}
                    onClick={() => rigRef.current?.orbit('ccw')}
                  >
                    <RotateCcw />
                  </ViewerIconButton>
                  <ViewerIconButton
                    label={t('asset-library:viewer.rotateCw', {
                      degrees: VIEWER_ORBIT_STEP_DEG,
                    })}
                    onClick={() => rigRef.current?.orbit('cw')}
                  >
                    <RotateCw />
                  </ViewerIconButton>
                  <span aria-hidden className="mx-0.5 h-4 w-px bg-white/20" />
                  {VIEW_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => rigRef.current?.frame(preset)}
                      className="h-7 cursor-pointer rounded-md px-2.5 text-xs font-medium text-white/75 transition-colors outline-none hover:bg-white/15 hover:text-white focus-visible:ring-2 focus-visible:ring-white/70"
                    >
                      {t(`asset-library:viewer.preset.${preset}`)}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </TooltipProvider>
        )}
      </div>
      {playbackControls ? (
        <AssetPlaybackBar
          clips={clips}
          clip={clip}
          playing={playing}
          speed={speed}
          clock={clock}
          onPlayingChange={(next) => setDisplay({ animationPlaying: next })}
          onClipChange={(name) => {
            // 새 클립은 처음부터 — 시계를 먼저 놓아야 바뀐 클립의 effect 가 0 을 읽는다.
            clock.setTime(0);
            setDisplay({ animationClip: name });
          }}
          onSpeedChange={(next) => setDisplay({ animationSpeed: next })}
          onSeek={(time) => clock.setTime(time)}
        />
      ) : null}
      {titleBlock}
    </div>
  );
}
