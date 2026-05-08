// SOSLAB ProcessedPointCloudBundle 스트림을 React Three Fiber 위에서
// monitoring_web/src/viewer.js 와 동일한 결과로 렌더링한다.
//
// - 한 컴포넌트(<SoslabPointCloud>) = 한 Canvas. 그리드에 SOSLAB1/SOSLAB2/
//   Fusion 3개 타일이 있으면 Canvas 도 3개지만, 데이터 소스(WebSocket) 는
//   soslab-stream-store 에서 단일하게 공유된다.
// - mode 에 따라 SOSLAB1 / SOSLAB2 의 가시성을 토글. fusion = 두 센서 모두 visible.
// - intensity 가 있으면 HSL 그래디언트 (0.63→0, 0.95, 0.55), 없으면 SENSOR_COLORS
//   고정색. 점 크기 2.5px, sizeAttenuation 끔 — viewer.js 와 동일.

import { Activity, ScanLine } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import {
  AMBIENT,
  AXES_HELPER_SIZE,
  CAMERA,
  GRID_HELPER,
  INTENSITY_COLOR_RANGE,
  POINT_SIZE_PX,
  SCENE_BG,
  SENSOR_COLORS,
} from '../lib/soslab/config';
import {
  useSoslabStreamStore,
  type SoslabConnectionStatus,
  type SoslabSensorMode,
} from '../model/soslab-stream-store';

const tempColor = new THREE.Color();

interface SensorPointsProps {
  sensorKey: string;
  fallbackColorHex: string;
  visible: boolean;
}

function buildColorBuffer(
  intensities: Float32Array | null,
  count: number,
  fallbackHex: string,
): Float32Array {
  const colors = new Float32Array(count * 3);

  if (intensities) {
    const min = INTENSITY_COLOR_RANGE.min;
    const range = Math.max(1, INTENSITY_COLOR_RANGE.max - min);
    for (let index = 0; index < count; index += 1) {
      const normalized = Math.min(
        Math.max((intensities[index] - min) / range, 0),
        1,
      );
      tempColor.setHSL(0.63 - normalized * 0.63, 0.95, 0.55);
      const colorIndex = index * 3;
      colors[colorIndex] = tempColor.r;
      colors[colorIndex + 1] = tempColor.g;
      colors[colorIndex + 2] = tempColor.b;
    }
    return colors;
  }

  tempColor.set(fallbackHex);
  for (let index = 0; index < count; index += 1) {
    const colorIndex = index * 3;
    colors[colorIndex] = tempColor.r;
    colors[colorIndex + 1] = tempColor.g;
    colors[colorIndex + 2] = tempColor.b;
  }
  return colors;
}

function SensorPoints({
  sensorKey,
  fallbackColorHex,
  visible,
}: SensorPointsProps) {
  const geometry = useMemo(() => new THREE.BufferGeometry(), []);
  const material = useMemo(
    () =>
      new THREE.PointsMaterial({
        size: POINT_SIZE_PX,
        vertexColors: true,
        sizeAttenuation: false,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      }),
    [],
  );

  const lastSeenFrame = useRef(-1);
  const pointsRef = useRef<THREE.Points>(null);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame(() => {
    const buffer = useSoslabStreamStore.getState().sensors.get(sensorKey);
    if (!buffer || !buffer.parsed || !buffer.parsed.ok) return;
    const frameId = buffer.frameCounter;
    if (frameId === lastSeenFrame.current) return;
    lastSeenFrame.current = frameId;

    const parsed = buffer.parsed;
    const count = parsed.sampledPointCount;

    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(parsed.positions, 3),
    );
    geometry.setAttribute(
      'color',
      new THREE.BufferAttribute(
        buildColorBuffer(parsed.intensities, count, fallbackColorHex),
        3,
      ),
    );
    geometry.computeBoundingSphere();

    const points = pointsRef.current;
    if (points) {
      points.visible = visible && count > 0;
    }
  });

  return (
    <points ref={pointsRef} geometry={geometry} material={material} visible={visible} />
  );
}

function SceneHelpers() {
  const gridRef = useRef<THREE.GridHelper>(null);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const mat = grid.material;
    if (Array.isArray(mat)) {
      for (const m of mat) {
        m.transparent = true;
        m.opacity = GRID_HELPER.opacity;
      }
    } else {
      mat.transparent = true;
      mat.opacity = GRID_HELPER.opacity;
    }
  }, []);

  return (
    <>
      <ambientLight color={AMBIENT.color} intensity={AMBIENT.intensity} />
      <gridHelper
        ref={gridRef}
        args={[
          GRID_HELPER.size,
          GRID_HELPER.divisions,
          GRID_HELPER.color1,
          GRID_HELPER.color2,
        ]}
      />
      <axesHelper args={[AXES_HELPER_SIZE]} />
    </>
  );
}

interface CameraAutoFitProps {
  enabled: boolean;
}

/**
 * 첫 프레임에 한해 모든 visible 센서의 bounds 합집합으로 카메라를 fit.
 * OrbitControls 가 한 번이라도 조작되면 fit 을 멈춘다 (참조 viewer.js 와 동일).
 */
function CameraAutoFit({ enabled }: CameraAutoFitProps) {
  const { camera, controls } = useThree();
  const fittedRef = useRef(false);
  const userDirtyRef = useRef(false);
  const lastSeenFrameRef = useRef(-1);

  useEffect(() => {
    const c = controls as unknown as
      | { addEventListener?: (type: string, fn: () => void) => void; removeEventListener?: (type: string, fn: () => void) => void }
      | null;
    if (!c?.addEventListener) return;
    const onStart = () => {
      userDirtyRef.current = true;
    };
    c.addEventListener('start', onStart);
    return () => c.removeEventListener?.('start', onStart);
  }, [controls]);

  useFrame(() => {
    if (!enabled) return;
    if (fittedRef.current || userDirtyRef.current) return;

    const counter = useSoslabStreamStore.getState().globalFrameCounter;
    if (counter === lastSeenFrameRef.current) return;
    lastSeenFrameRef.current = counter;

    const sensors = useSoslabStreamStore.getState().sensors;
    const box = new THREE.Box3();
    let hasPoints = false;
    const tmp = new THREE.Vector3();
    for (const buf of sensors.values()) {
      if (!buf.parsed || !buf.parsed.ok || !buf.parsed.bounds) continue;
      const { min, max } = buf.parsed.bounds;
      for (const x of [min[0], max[0]]) {
        for (const y of [min[1], max[1]]) {
          for (const z of [min[2], max[2]]) {
            tmp.set(x, y, z);
            box.expandByPoint(tmp);
            hasPoints = true;
          }
        }
      }
    }
    if (!hasPoints) return;

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const dominant = Math.max(size.x, size.y, size.z, 1);
    const offset = new THREE.Vector3(1, 1, 1).normalize().multiplyScalar(dominant * 1.6);

    camera.position.copy(center.clone().add(offset));
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.near = Math.max(0.1, dominant / 200);
      camera.far = Math.max(CAMERA.far, dominant * 50);
      camera.updateProjectionMatrix();
    }
    const ctrl = controls as unknown as
      | { target?: THREE.Vector3; update?: () => void }
      | null;
    if (ctrl?.target) {
      ctrl.target.copy(center);
      ctrl.update?.();
    } else {
      camera.lookAt(center);
    }
    fittedRef.current = true;
  });

  return null;
}

const STATUS_LABEL: Record<SoslabConnectionStatus, string> = {
  idle: 'IDLE',
  connecting: 'CONNECTING',
  connected: 'LIVE',
  error: 'ERROR',
  closed: 'DISCONNECTED',
};

const STATUS_COLOR: Record<SoslabConnectionStatus, string> = {
  idle: 'text-white/40',
  connecting: 'text-yellow-400/70',
  connected: 'text-green-400',
  error: 'text-red-400/70',
  closed: 'text-red-400/70',
};

interface HudProps {
  mode: SoslabSensorMode;
  status: SoslabConnectionStatus;
}

function Hud({ mode, status }: HudProps) {
  const [, setTick] = useState(0);
  // 1초마다 점 카운트 갱신을 위해 가벼운 tick. (store 자체의 mutate 패턴 때문에
  // React 리렌더가 자동으로 일어나지 않으므로 여기서 강제.)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(id);
  }, []);

  const sensors = useSoslabStreamStore.getState().sensors;
  const s1 = sensors.get('soslab1');
  const s2 = sensors.get('soslab2');
  const totalPoints =
    (mode !== 'soslab2' && s1?.parsed?.ok ? s1.parsed.sampledPointCount : 0) +
    (mode !== 'soslab1' && s2?.parsed?.ok ? s2.parsed.sampledPointCount : 0);

  const label =
    mode === 'soslab1'
      ? 'SOSLAB 1'
      : mode === 'soslab2'
        ? 'SOSLAB 2'
        : 'FUSION';

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div className="absolute top-3 left-4 flex items-center gap-2">
        <span className="relative flex size-2">
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
              status === 'connected' ? 'bg-green-400' : 'bg-cyan-400'
            }`}
          />
          <span
            className={`relative inline-flex size-2 rounded-full ${
              status === 'connected' ? 'bg-green-500' : 'bg-cyan-500'
            }`}
          />
        </span>
        <ScanLine className="size-3 text-cyan-400" />
        <span className="font-mono text-[10px] font-bold tracking-wider text-cyan-400">
          {label} · POINT CLOUD
        </span>
      </div>
      <div className="absolute top-3 right-4 flex items-center gap-2 font-mono text-[10px] text-white/40">
        <Activity className="size-2.5 text-cyan-500/60" />
        <span>{totalPoints.toLocaleString()} pts</span>
      </div>
      <div className="absolute right-4 bottom-3 flex items-center gap-2 font-mono">
        <span className="text-[8px] text-white/25">STATUS</span>
        <span className={`text-[9px] font-bold ${STATUS_COLOR[status]}`}>
          {STATUS_LABEL[status]}
        </span>
      </div>
    </div>
  );
}

export interface SoslabPointCloudProps {
  /** 어떤 센서를 보여줄지. fusion = 둘 다 visible 합성. */
  mode: SoslabSensorMode;
  /** 좁은 썸네일용. HUD 와 OrbitControls 를 끄고 자동 회전. */
  compact?: boolean;
}

export function SoslabPointCloud({
  mode,
  compact = false,
}: SoslabPointCloudProps) {
  // 단일 WebSocket 공유: 마운트마다 acquire, 언마운트마다 release.
  useEffect(() => {
    const { acquire, release } = useSoslabStreamStore.getState();
    acquire();
    return () => release();
  }, []);

  const status = useSoslabStreamStore((s) => s.status);

  return (
    <div className="relative h-full w-full overflow-hidden bg-zinc-950">
      {!compact && <Hud mode={mode} status={status} />}
      <Canvas
        gl={{ outputColorSpace: THREE.SRGBColorSpace, antialias: true }}
        dpr={[1, 2]}
        style={{ background: SCENE_BG }}
      >
        <PerspectiveCamera
          makeDefault
          position={[
            CAMERA.initialPosition[0],
            CAMERA.initialPosition[1],
            CAMERA.initialPosition[2],
          ]}
          fov={CAMERA.fov}
          near={CAMERA.near}
          far={CAMERA.far}
        />
        {!compact && (
          <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
        )}
        <SceneHelpers />
        <SensorPoints
          sensorKey="soslab1"
          fallbackColorHex={SENSOR_COLORS[0]}
          visible={mode === 'soslab1' || mode === 'fusion'}
        />
        <SensorPoints
          sensorKey="soslab2"
          fallbackColorHex={SENSOR_COLORS[1]}
          visible={mode === 'soslab2' || mode === 'fusion'}
        />
        <CameraAutoFit enabled />
      </Canvas>
    </div>
  );
}
