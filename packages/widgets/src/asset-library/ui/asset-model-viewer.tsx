import {
  Grid,
  Html,
  OrbitControls,
  useGLTF,
  useProgress,
} from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import {
  Box as BoxIcon,
  Camera,
  Grid3x3,
  Loader2,
  Maximize,
  Rotate3d,
  Ruler,
  SunMoon,
} from 'lucide-react';
import {
  Component,
  Suspense,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box3,
  PMREMGenerator,
  type Object3D,
  type PerspectiveCamera,
} from 'three';
import {
  RoomEnvironment,
  SkeletonUtils,
} from 'three/examples/jsm/Addons.js';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { Vector3Tuple } from '@crane/core/types/math';
import { cn } from '@crane/core/lib/utils';
import { extendGltfLoaderWithKtx2 } from '@crane/domain/3d';
import {
  formatMeters,
  pickGridStep,
  type AssetStats,
} from '@crane/domain/asset-library';
import { renderThumbnail } from '../lib/thumbnail-crop';
import {
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
  createViewModeMaterials,
  disposeViewModeMaterials,
  fromRelativeCameraPose,
  toRelativeCameraPose,
  VIEW_PRESETS,
  type AssetViewMode,
  type FramingBounds,
  type OriginalMaterialMap,
  type ViewerCameraSync,
  type ViewPreset,
} from '@crane/features/asset-library';
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
} from '@crane/ui/molecules/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@crane/ui/molecules/tooltip';

/**
 * 자산 한 개를 살펴보는 3D 뷰어.
 *
 * 모니터링 씬 뷰어(ThreeSceneViewer)와 따로 둔 이유: 그쪽은 지도 위를 날아
 * 다니는 카메라(표면 기준 줌·이동 범위 제한)이고, 여기는 물체 하나를 돌려
 * 보는 카메라다. 캔버스는 `frameloop="demand"` 이고 턴테이블을 켠 동안만
 * 계속 그린다.
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
  url: string;
  /** 고유 단위 → m 환산 배율(자산의 기본 스케일). 치수 표기에 쓴다. */
  defaultScale: Vector3Tuple;
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
   * 표시 토글과 맞추기만, `none` 은 없음(나란히 보기의 오른쪽).
   */
  toolbar?: 'full' | 'compact' | 'none';
  /** 표시 상태를 바깥이 들 때(나란히 보기). 없으면 뷰어가 직접 든다. */
  display?: ViewerDisplay;
  onDisplayChange?: (patch: Partial<ViewerDisplay>) => void;
  /** 다른 뷰어와 카메라를 맞물린다. `id` 는 통로 안에서 이 뷰어의 이름. */
  cameraSync?: { bus: ViewerCameraSync; id: string };
  /** 뷰어 왼쪽 아래에 놓이는 꼬리표(어느 버전인지 등). */
  cornerLabel?: ReactNode;
}

interface ModelInfo {
  stats: AssetStats;
  bounds: Box3;
  lodLevels: number;
}

class ViewerErrorBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.error('[asset-viewer] 모델을 불러오지 못했습니다.', error);
    this.props.onError();
  }

  render() {
    // Canvas 안이라 DOM 을 돌려줄 수 없다 — 안내는 바깥 오버레이가 맡는다.
    return this.state.failed ? null : this.props.children;
  }
}

function ViewerModel({
  url,
  viewMode,
  lodLevel,
  wireColor,
  onInfo,
}: {
  url: string;
  viewMode: AssetViewMode;
  lodLevel: number;
  wireColor: string;
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
  // 뒤에 재면 교체된 머티리얼과 숨겨진 LOD 가 수치에 섞인다.
  useEffect(() => {
    onInfo({
      stats: computeObjectStats(object, gltf.animations.length),
      bounds: computeRenderBounds(object),
      lodLevels: countLodLevels(object),
    });
  }, [gltf.animations.length, object, onInfo]);

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

  return <primitive object={object} />;
}

interface ViewerRigHandle extends AssetViewerHandle {
  frame: (preset: ViewPreset) => void;
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
      // 감쇠를 잠시 끄고 update — 켠 채면 직전 드래그의 관성이 방금 맞춘
      // 포즈를 흘려 보낸다(ThreeSceneViewer 와 같은 이유).
      const damping = controls.enableDamping;
      controls.enableDamping = false;
      controls.update();
      controls.enableDamping = damping;
      invalidate();
    },
    [bounds, getState, invalidate],
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
      const damping = controls.enableDamping;
      controls.enableDamping = false;
      controls.update();
      controls.enableDamping = damping;
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
    [frame, getState, invalidate],
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
  defaultScale,
  showGrid,
  showDimensions,
  background,
}: {
  bounds: Box3;
  defaultScale: Vector3Tuple;
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
          <box3Helper
            key={background}
            args={[dimensionBox, tone.dimension]}
          />
          <DimensionLabel
            className={tone.dimensionLabel}
            axis="W"
            position={[(min.x + max.x) / 2, min.y, max.z]}
            meters={sizeX * defaultScale[0]}
          />
          <DimensionLabel
            className={tone.dimensionLabel}
            axis="D"
            position={[max.x, min.y, (min.z + max.z) / 2]}
            meters={sizeZ * defaultScale[2]}
          />
          <DimensionLabel
            className={tone.dimensionLabel}
            axis="H"
            // 폭·깊이 꼬리표는 앞·오른쪽 바닥 모서리의 가운데에 있다. 높이는
            // 둘에서 가장 먼 앞-왼쪽 세로 모서리에 둔다 — 납작하고 긴 물체에서
            // 오른쪽 모서리에 두면 깊이 꼬리표와 겹친다.
            position={[min.x, (min.y + max.y) / 2, max.z]}
            meters={sizeY * defaultScale[1]}
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

/** 뷰어 위 조작 버튼 — 배경이 무엇이든 읽히는 어두운 유리판 위의 아이콘. */
function ViewerIconButton({
  label,
  pressed,
  side = 'bottom',
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  side?: 'top' | 'bottom';
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={label}
            aria-pressed={pressed}
            className={cn(
              'flex size-7 cursor-pointer items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/70 [&_svg]:size-4',
              pressed
                ? 'bg-white text-zinc-900'
                : 'text-white/75 hover:bg-white/15 hover:text-white',
            )}
          />
        }
        onClick={onClick}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  );
}

const GLASS_BAR =
  'flex h-9 items-center gap-0.5 rounded-lg bg-black/50 p-1 shadow-sm backdrop-blur-md';

function LoadingOverlay({ light }: { light: boolean }) {
  const { t } = useTranslation();
  const { progress } = useProgress();
  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2',
        light ? 'text-zinc-600' : 'text-white/80',
      )}
    >
      <Loader2 className="size-5 animate-spin" />
      <p className="text-xs tabular-nums">
        {t('asset-library:viewer.loading', { percent: Math.round(progress) })}
      </p>
    </div>
  );
}

export function AssetModelViewer({
  url,
  defaultScale,
  titleBlock,
  handleRef,
  onLoaded,
  onReady,
  onSaveThumbnail,
  toolbar = 'full',
  display: controlledDisplay,
  onDisplayChange,
  cameraSync,
  cornerLabel,
}: AssetModelViewerProps) {
  const { t } = useTranslation();
  const rigRef = useRef<ViewerRigHandle | null>(null);

  // 좁은 자리에서는 치수 꼬리표가 서로 겹친다 — 꺼 둔 채 시작한다.
  const own = useViewerDisplay(
    toolbar === 'compact' ? { showDimensions: false } : undefined,
  );
  // 캔버스가 놓이는 자리. R3F 는 만들어진 뒤 비동기로 이벤트를 이 요소에 건다 —
  // 요소를 직접 넘겨 두면, 그 사이 뷰어가 사라져도(목록을 빠르게 넘길 때)
  // 없는 요소에 걸다 던지지 않는다.
  const [surface, setSurface] = useState<HTMLDivElement | null>(null);
  const display = controlledDisplay ?? own.display;
  const setDisplay = onDisplayChange ?? own.setDisplay;
  const { viewMode, background, showGrid, showDimensions, turntable } = display;
  const [lodLevel, setLodLevel] = useState(0);
  // 로드 결과는 URL 에 묶어 둔다 — 다른 파일로 바뀌면 옛 결과가 한 프레임도
  // 보이지 않는다.
  const [loaded, setLoaded] = useState<{ url: string; info: ModelInfo } | null>(
    null,
  );
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  const info = loaded?.url === url ? loaded.info : null;
  const failed = failedUrl === url;

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
  useEffect(() => {
    onLoadedRef.current = onLoaded;
    onReadyRef.current = onReady;
  }, [onLoaded, onReady]);
  const handleFramed = useCallback(() => onReadyRef.current?.(), []);
  const handleInfo = useCallback(
    (next: ModelInfo) => {
      setLoaded({ url, info: next });
      setLodLevel(0);
      onLoadedRef.current?.({ stats: next.stats });
    },
    [url],
  );

  // 화면을 떠나면 이 파일의 파싱 결과를 캐시에서 놓는다 — 자산을 여러 개
  // 열어 볼수록 수십 MB 씩 쌓이는 것을 막는다.
  useEffect(
    () => () => {
      try {
        useGLTF.clear(url);
      } catch {
        // 캐시에 없으면 그만이다.
      }
    },
    [url],
  );

  const tone = BACKGROUND_STYLE[background];
  const light = background === 'light';

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={cn('relative min-h-0 flex-1', tone.surface)}>
        <div ref={setSurface} className="absolute inset-0">
          {surface ? (
            <Canvas
              key={url}
              eventSource={surface}
              frameloop={turntable ? 'always' : 'demand'}
              dpr={[1, 1.5]}
              gl={{ alpha: true, antialias: true }}
              camera={{ fov: FOV_DEG, near: 0.1, far: 5000, position: [6, 4, 6] }}
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
                    onInfo={handleInfo}
                  />
                </Suspense>
              </ViewerErrorBoundary>
              {info ? (
                <ViewerHelpers
                  bounds={info.bounds}
                  defaultScale={defaultScale}
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
          <LoadingOverlay light={light} />
        )}

        {cornerLabel ? (
          <div className="pointer-events-none absolute bottom-3 left-3 z-10">
            {cornerLabel}
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
                    className={GLASS_BAR}
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
                className={cn(GLASS_BAR, 'pointer-events-auto')}
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

            <div className="pointer-events-none absolute right-3 bottom-3 z-10 flex justify-end">
              <div
                role="group"
                aria-label={t('asset-library:viewer.camera')}
                className={cn(GLASS_BAR, 'pointer-events-auto')}
              >
                {toolbar === 'full' ? (
                  <>
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
                    <span aria-hidden className="mx-0.5 h-4 w-px bg-white/20" />
                  </>
                ) : null}
                <ViewerIconButton
                  label={t('asset-library:viewer.fit')}
                  side="top"
                  onClick={() => rigRef.current?.frame('iso')}
                >
                  <Maximize />
                </ViewerIconButton>
              </div>
            </div>
          </TooltipProvider>
        )}
      </div>
      {titleBlock}
    </div>
  );
}
