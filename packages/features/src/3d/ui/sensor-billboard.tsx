import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Camera as CameraIcon, Radar as RadarIcon } from 'lucide-react';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Vector3, type Group } from 'three';
import type { Vector3Tuple } from '@crane/core/types/math';

/**
 * 빌보드 형제들 간 호버 상태 공유. 호버한 빌보드의 world position과 ID를
 * ref 한 곳에 보관해 다른 빌보드가 매 프레임 거리 비교로 자기를 흐리게 처리한다.
 * React 리렌더 없이 ref 기반으로 동작.
 */
interface BillboardHoverState {
  /** 호버 중인 빌보드의 channelId. null이면 호버 없음 */
  activeId: string | null;
  /** 호버 중인 빌보드의 world position */
  activePos: Vector3 | null;
}

interface BillboardHoverStore {
  state: { current: BillboardHoverState };
  setActive: (id: string, pos: Vector3) => void;
  clearActive: (id: string) => void;
}

const BillboardHoverContext = createContext<BillboardHoverStore | null>(null);

export function BillboardHoverProvider({ children }: { children: ReactNode }) {
  const stateRef = useRef<BillboardHoverState>({
    activeId: null,
    activePos: null,
  });
  const store = useMemo<BillboardHoverStore>(
    () => ({
      state: stateRef,
      setActive: (id, pos) => {
        stateRef.current = { activeId: id, activePos: pos };
      },
      clearActive: (id) => {
        // 다른 빌보드로 호버가 옮겨간 경우 race를 막기 위해 자기 ID일 때만 비움
        if (stateRef.current.activeId === id) {
          stateRef.current = { activeId: null, activePos: null };
        }
      },
    }),
    [],
  );
  return (
    <BillboardHoverContext.Provider value={store}>
      {children}
    </BillboardHoverContext.Provider>
  );
}

/**
 * 빌보드 미니 썸네일/PiP 등 비전 피드를 렌더할 때 호출되는 컨텍스트.
 * features 패키지는 실제 스트림 컴포넌트를 모르며, app 레이어가 이 시그니처로
 * 외부에서 비디오/포인트클라우드 컴포넌트를 주입한다.
 */
export interface SensorFeedContext {
  channelId: string;
  sensorType: 'camera' | 'lidar';
  /** 풀 라벨 (예: "CAM 1", "LiDAR") */
  label: string;
  /** 호스트가 어떤 사이즈로 표시할지 힌트. 'thumbnail' = 빌보드 미니, 'full' = PiP */
  size: 'thumbnail' | 'full';
}

export type SensorFeedRenderer = (ctx: SensorFeedContext) => ReactNode;

const FULL_DISTANCE = 25;
const MID_DISTANCE = 60;
const HIDE_DISTANCE = 110;
const MID_SCALE = 0.75;
const FAR_SCALE = 0.5;

/**
 * 호버한 빌보드를 기준으로 이 거리(world units) 안에 있는 다른 빌보드는
 * 시각적으로 흐려진다(opacity 낮춤). 너무 좁으면 효과 없고 너무 넓으면 무관한
 * 빌보드까지 흐려져 부자연스러움. 골리앗 크레인 씬에서 인접 카메라들이
 * ~1m 내외에 모여있으므로 그 정도를 커버하는 값.
 */
const DIM_RADIUS = 4;
const DIM_OPACITY = 0.18;

const CAMERA_OFFSET_Y = 0.45;
const LIDAR_OFFSET_Y = 0.55;

interface SensorBillboardProps {
  position: Vector3Tuple;
  channelId: string;
  sensorType: 'camera' | 'lidar';
  /** 호버 시 미니 썸네일에 표시되는 풀 라벨 (예: "CAM 1", "LiDAR") */
  label: string;
  onSelect: (channelId: string, sensorType: 'camera' | 'lidar') => void;
  /**
   * 호버 시 미니 썸네일 안에 렌더할 비전 피드. app 레이어가 채널 → 실제
   * 스트림으로 매핑하는 컴포넌트를 반환한다. 미지정 시 placeholder 표시.
   */
  renderFeed?: SensorFeedRenderer;
}

function getShortLabel(
  channelId: string,
  sensorType: 'camera' | 'lidar',
): string {
  if (sensorType === 'camera') {
    return channelId.replace('cam-', '') || '?';
  }
  return 'L';
}

function getChannelBadge(
  channelId: string,
  sensorType: 'camera' | 'lidar',
): string {
  if (sensorType === 'camera') {
    const num = channelId.replace('cam-', '');
    return `CH ${num.padStart(2, '0')}`;
  }
  return 'LDR';
}

interface MiniThumbnailProps {
  sensorType: 'camera' | 'lidar';
  label: string;
  channelId: string;
  accentColor: string;
  renderFeed?: SensorFeedRenderer;
}

function MiniThumbnail({
  sensorType,
  label,
  channelId,
  accentColor,
  renderFeed,
}: MiniThumbnailProps) {
  const isCamera = sensorType === 'camera';
  const feedNode = renderFeed
    ? renderFeed({ channelId, sensorType, label, size: 'thumbnail' })
    : null;
  return (
    <div
      className="pointer-events-none relative flex flex-col overflow-hidden rounded-md border bg-zinc-900/95 shadow-[0_8px_24px_rgba(0,0,0,0.55)] backdrop-blur-md"
      style={{
        width: 148,
        borderColor: `${accentColor}66`,
      }}
    >
      {/* 16:9 미디어 영역 */}
      <div
        className="relative w-full overflow-hidden bg-zinc-950"
        style={{ aspectRatio: '16 / 9' }}
      >
        {/* 스캔라인 */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(255,255,255,0.6) 2px,rgba(255,255,255,0.6) 3px)',
          }}
        />
        {/* 비네팅 */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at center, transparent 40%, rgba(0,0,0,0.55) 100%)',
          }}
        />
        {/* 모서리 마커 */}
        {(
          [
            'top-1 left-1 border-t border-l',
            'top-1 right-1 border-t border-r',
            'bottom-1 left-1 border-b border-l',
            'bottom-1 right-1 border-b border-r',
          ] as const
        ).map((cls, i) => (
          <span
            key={i}
            aria-hidden
            className={`absolute size-1.5 ${cls}`}
            style={{ borderColor: `${accentColor}99` }}
          />
        ))}
        {/* 상단 HUD: 채널 배지 + LIVE */}
        <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-linear-to-b from-black/70 to-transparent px-1.5 py-1">
          <span
            className="rounded-sm bg-white/10 px-1 font-mono text-[7px] font-bold tracking-wider text-white/80"
          >
            {getChannelBadge(channelId, sensorType)}
          </span>
          <div className="flex items-center gap-1">
            <span className="relative flex size-1">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex size-1 rounded-full bg-red-500" />
            </span>
            <span className="font-mono text-[7px] font-bold tracking-widest text-red-400">
              REC
            </span>
          </div>
        </div>
        {/* 중앙 컨텐츠: 외부 주입 피드가 있으면 그걸로, 없으면 placeholder */}
        {feedNode ? (
          <div className="absolute inset-0">{feedNode}</div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
            {isCamera ? (
              <>
                <div className="relative">
                  <CameraIcon
                    className="size-5"
                    style={{ color: `${accentColor}cc` }}
                  />
                  <div
                    className="absolute inset-0 flex items-center justify-center"
                    aria-hidden
                  >
                    <div className="h-px w-full rotate-45 bg-white/60" />
                  </div>
                </div>
                <span className="font-mono text-[7px] font-bold tracking-[0.2em] text-white/80">
                  NO IMAGE
                </span>
              </>
            ) : (
              <>
                <RadarIcon
                  className="size-5"
                  style={{ color: `${accentColor}cc` }}
                />
                <span className="font-mono text-[7px] font-bold tracking-[0.2em] text-white/80">
                  POINT CLOUD
                </span>
              </>
            )}
          </div>
        )}
      </div>
      {/* 하단 풋터: 라벨 */}
      <div
        className="flex items-center justify-between border-t bg-black/60 px-1.5 py-0.5"
        style={{ borderColor: `${accentColor}33` }}
      >
        <span
          className="font-mono text-[8px] font-semibold tracking-[0.18em] uppercase"
          style={{ color: accentColor }}
        >
          {label}
        </span>
        <span className="font-mono text-[7px] tracking-wider text-white/40">
          GC-04
        </span>
      </div>
    </div>
  );
}

interface HoverThumbnailCardProps extends MiniThumbnailProps {}

function HoverThumbnailCard(props: HoverThumbnailCardProps) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      className="absolute left-1/2 transition-all duration-150 ease-out"
      style={{
        bottom: 'calc(100% + 14px)',
        pointerEvents: 'none',
        zIndex: 10,
        opacity: shown ? 1 : 0,
        transform: shown
          ? 'translate(-50%, 0) scale(1)'
          : 'translate(-50%, 6px) scale(0.96)',
      }}
    >
      <MiniThumbnail {...props} />
      {/* 카드 → 도트 연결선 */}
      <span
        aria-hidden
        className="absolute left-1/2 block w-px -translate-x-1/2"
        style={{
          top: '100%',
          height: '10px',
          background: `linear-gradient(to bottom, ${props.accentColor}99, ${props.accentColor}00)`,
        }}
      />
    </div>
  );
}

export function SensorBillboard({
  position,
  channelId,
  sensorType,
  label,
  onSelect,
  renderFeed,
}: SensorBillboardProps) {
  const groupRef = useRef<Group>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const tempWorldPos = useRef(new Vector3());
  const lastTierRef = useRef<'full' | 'mid' | 'far' | 'hidden'>('full');
  const lastDimmedRef = useRef(false);
  const [isHover, setIsHover] = useState(false);
  const hoverStore = useContext(BillboardHoverContext);

  // 언마운트 시 호버 상태에서 사라지면 store에 자기 ID가 남아 다른 빌보드가
  // 영원히 흐려질 수 있다. 자기 ID라면 정리.
  useEffect(() => {
    return () => {
      hoverStore?.clearActive(channelId);
    };
  }, [hoverStore, channelId]);

  useFrame((state) => {
    const group = groupRef.current;
    const wrapper = wrapperRef.current;
    if (!group || !wrapper) return;

    group.getWorldPosition(tempWorldPos.current);
    const dist = state.camera.position.distanceTo(tempWorldPos.current);

    let nextTier: 'full' | 'mid' | 'far' | 'hidden';
    if (dist > HIDE_DISTANCE) nextTier = 'hidden';
    else if (dist > MID_DISTANCE) nextTier = 'far';
    else if (dist > FULL_DISTANCE) nextTier = 'mid';
    else nextTier = 'full';

    if (nextTier !== lastTierRef.current) {
      lastTierRef.current = nextTier;

      if (nextTier === 'hidden') {
        wrapper.style.display = 'none';
      } else {
        wrapper.style.display = '';
        if (nextTier === 'full') {
          wrapper.style.transform = 'scale(1)';
        } else if (nextTier === 'mid') {
          wrapper.style.transform = `scale(${MID_SCALE})`;
        } else {
          wrapper.style.transform = `scale(${FAR_SCALE})`;
        }
      }
    }

    // 호버 dimming: 다른 빌보드가 호버 중이고 그 위치가 자기 가까이 있으면 흐리게
    let shouldDim = false;
    const hoverState = hoverStore?.state.current;
    if (
      hoverState &&
      hoverState.activeId &&
      hoverState.activeId !== channelId &&
      hoverState.activePos
    ) {
      const dimDist = hoverState.activePos.distanceTo(tempWorldPos.current);
      if (dimDist < DIM_RADIUS) shouldDim = true;
    }
    if (shouldDim !== lastDimmedRef.current) {
      lastDimmedRef.current = shouldDim;
      wrapper.style.opacity = shouldDim ? String(DIM_OPACITY) : '';
    }
  });

  const offsetY = sensorType === 'camera' ? CAMERA_OFFSET_Y : LIDAR_OFFSET_Y;
  const liftedPosition: Vector3Tuple = [
    position[0],
    position[1] + offsetY,
    position[2],
  ];

  const accentColor = sensorType === 'camera' ? '#67e8f9' : '#c4b5fd';
  const accentBorder =
    sensorType === 'camera' ? 'border-cyan-300/50' : 'border-violet-300/50';
  const shortLabel = getShortLabel(channelId, sensorType);

  return (
    <group ref={groupRef} position={liftedPosition}>
      <Html center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
        <div
          ref={wrapperRef}
          className="relative transition-opacity duration-150"
          style={{ transformOrigin: 'center bottom' }}
        >
          {/* 호버 시에만 미니 썸네일 카드 마운트 — 비디오 스트림이 백그라운드에서 돌지 않게 */}
          {isHover ? (
            <HoverThumbnailCard
              sensorType={sensorType}
              label={label}
              channelId={channelId}
              accentColor={accentColor}
              renderFeed={renderFeed}
            />
          ) : null}

          {/* 도트 + 번호 (평소 모습) */}
          <button
            type="button"
            className={`pointer-events-auto relative flex cursor-pointer items-center justify-center rounded-full border bg-black/60 backdrop-blur-md transition-transform duration-150 hover:scale-110 ${accentBorder}`}
            style={{
              width: '14px',
              height: '14px',
              boxShadow: isHover
                ? `0 0 14px ${accentColor}aa, 0 0 4px ${accentColor}`
                : `0 0 4px ${accentColor}40`,
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onPointerEnter={() => {
              setIsHover(true);
              if (groupRef.current && hoverStore) {
                groupRef.current.getWorldPosition(tempWorldPos.current);
                // 자기 자신은 dim되지 않도록 자기 위치는 store에 보관 — 비교 시
                // activeId 일치 시 skip하므로 실제로 활용되는 건 다른 빌보드들
                hoverStore.setActive(channelId, tempWorldPos.current.clone());
              }
            }}
            onPointerLeave={() => {
              setIsHover(false);
              hoverStore?.clearActive(channelId);
            }}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(channelId, sensorType);
            }}
          >
            <span
              className="inline-block rounded-full"
              style={{
                width: '6px',
                height: '6px',
                background: accentColor,
                boxShadow: `0 0 4px ${accentColor}`,
              }}
            />
            <span
              className="absolute font-mono text-[7px] font-bold leading-none text-white"
              style={{
                right: '-7px',
                top: '-3px',
                textShadow: '0 0 3px rgba(0,0,0,0.9)',
              }}
            >
              {shortLabel}
            </span>
          </button>
        </div>
      </Html>
    </group>
  );
}
