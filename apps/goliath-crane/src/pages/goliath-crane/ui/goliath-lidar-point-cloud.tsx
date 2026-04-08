import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ScanLine, Activity } from 'lucide-react';
import { getLidarWebSocketUrl } from '@crane/core/config/network';
import {
  useLidarWebSocket,
  type LidarConnectionStatus,
} from '../model/use-lidar-websocket';

const LIDAR_WS_URL = getLidarWebSocketUrl();

// ── Three.js 포인트 클라우드 메시 ────────────────────────────────────────────
// data 포맷: [x, y, z, r, g, b, ...] (6 floats per point, RGB 0~1.0)

const toLinear = (c: number) =>
  c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

interface PointCloudProps {
  dataRef: React.MutableRefObject<Float32Array | null>;
  frameRef: React.MutableRefObject<number>;
}

function PointCloud({ dataRef, frameRef }: PointCloudProps) {
  const geometry = useMemo(() => new THREE.BufferGeometry(), []);
  const material = useMemo(
    () =>
      new THREE.PointsMaterial({
        size: 0.1,
        vertexColors: true,
        sizeAttenuation: true,
      }),
    [],
  );

  const lastFrameRef = useRef(-1);
  const fittedRef = useRef(false);
  const capacityRef = useRef(0);
  const positionAttributeRef = useRef<THREE.BufferAttribute | null>(null);
  const colorAttributeRef = useRef<THREE.BufferAttribute | null>(null);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  const ensureCapacity = (nextPointCount: number) => {
    if (nextPointCount <= capacityRef.current) {
      return;
    }

    const nextCapacity = 2 ** Math.ceil(Math.log2(Math.max(1, nextPointCount)));
    const positionAttribute = new THREE.BufferAttribute(
      new Float32Array(nextCapacity * 3),
      3,
    );
    const colorAttribute = new THREE.BufferAttribute(
      new Float32Array(nextCapacity * 3),
      3,
    );

    geometry.setAttribute('position', positionAttribute);
    geometry.setAttribute('color', colorAttribute);
    positionAttributeRef.current = positionAttribute;
    colorAttributeRef.current = colorAttribute;
    capacityRef.current = nextCapacity;
  };

  useFrame(({ camera }) => {
    const frame = frameRef.current;
    if (frame === lastFrameRef.current) return;
    lastFrameRef.current = frame;

    const data = dataRef.current;
    if (!data || data.length === 0) return;

    const pointCount = Math.floor(data.length / 6);
    ensureCapacity(pointCount);

    const positionAttribute = positionAttributeRef.current;
    const colorAttribute = colorAttributeRef.current;
    if (!positionAttribute || !colorAttribute) return;

    const positions = positionAttribute.array as Float32Array;
    const colors = colorAttribute.array as Float32Array;

    for (let i = 0; i < pointCount; i++) {
      const base = i * 6;
      positions[i * 3]     = data[base];
      positions[i * 3 + 1] = data[base + 1];
      positions[i * 3 + 2] = data[base + 2];
      colors[i * 3]        = toLinear(data[base + 3]);
      colors[i * 3 + 1]    = toLinear(data[base + 4]);
      colors[i * 3 + 2]    = toLinear(data[base + 5]);
    }

    geometry.setDrawRange(0, pointCount);
    positionAttribute.needsUpdate = true;
    colorAttribute.needsUpdate = true;
    geometry.computeBoundingSphere();

    // 첫 프레임에만 카메라를 포인트 클라우드 전체가 보이도록 자동 fit
    if (!fittedRef.current && geometry.boundingSphere) {
      fittedRef.current = true;
      const { center, radius } = geometry.boundingSphere;
      const fov = (camera as THREE.PerspectiveCamera).fov * (Math.PI / 180);
      const dist = (radius / Math.sin(fov / 2)) * 1.2;
      camera.position.set(
        center.x + dist * 0.6,
        center.y + dist * 0.5,
        center.z + dist * 0.6,
      );
      camera.lookAt(center);
    }
  });

  return <points geometry={geometry} material={material} />;
}

// ── 스캔 라인 링 ───────────────────────────────────────────────────────────────
function ScanRing() {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.z += delta * 1.4;
  });

  return (
    <mesh ref={ref} position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.5, 0.02, 8, 48]} />
      <meshBasicMaterial color="#00ffee" transparent opacity={0.5} />
    </mesh>
  );
}

function FloorGrid() {
  return (
    <gridHelper args={[120, 24, '#1a3a3a', '#0d2020']} position={[0, -0.05, 0]} />
  );
}

// ── HUD 오버레이 ──────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<LidarConnectionStatus, string> = {
  connecting: 'CONNECTING',
  open: 'LIVE',
  closed: 'DISCONNECTED',
  error: 'ERROR',
};

const STATUS_COLOR: Record<LidarConnectionStatus, string> = {
  connecting: 'text-yellow-400/70',
  open: 'text-green-400',
  closed: 'text-red-400/70',
  error: 'text-red-400/70',
};

const BADGE_STYLE: Record<LidarConnectionStatus, string> = {
  connecting: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400/70',
  open: 'border-green-500/30 bg-green-500/10 text-green-400',
  closed: 'border-red-500/30 bg-red-500/10 text-red-400/70',
  error: 'border-red-500/30 bg-red-500/10 text-red-400/70',
};

const BADGE_TEXT: Record<LidarConnectionStatus, string> = {
  connecting: 'CONNECTING — 서버 연결 중...',
  open: 'LIVE — 실시간 데이터 수신 중',
  closed: 'DISCONNECTED — 재연결 대기 중',
  error: 'ERROR — 연결 오류',
};

function LidarHud({
  dataRef,
  status,
  isLive,
}: {
  dataRef: React.MutableRefObject<Float32Array | null>;
  status: LidarConnectionStatus;
  isLive: boolean;
}) {
  const pointCount = dataRef.current ? Math.floor(dataRef.current.length / 6) : 0;

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div className="absolute top-3 left-4 flex items-center gap-2">
        <span className="relative flex size-2">
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
              isLive ? 'bg-green-400' : 'bg-cyan-400'
            }`}
          />
          <span
            className={`relative inline-flex size-2 rounded-full ${
              isLive ? 'bg-green-500' : 'bg-cyan-500'
            }`}
          />
        </span>
        <ScanLine className="size-3 text-cyan-400" />
        <span className="font-mono text-[10px] font-bold tracking-wider text-cyan-400">
          LiDAR POINT CLOUD
        </span>
      </div>
      <div className="absolute top-3 right-4 flex items-center gap-2 font-mono text-[10px] text-white/40">
        <Activity className="size-2.5 text-cyan-500/60" />
        <span>{pointCount.toLocaleString()} pts</span>
      </div>

      <div className="absolute right-4 bottom-3 flex flex-col items-end gap-0.5 font-mono">
        {[
          { label: 'RANGE', value: '30 m' },
          { label: 'STATUS', value: STATUS_LABEL[status] },
        ].map((row) => (
          <div key={row.label} className="flex items-center gap-2">
            <span className="text-[8px] text-white/25">{row.label}</span>
            <span
              className={`text-[9px] font-bold ${
                row.label === 'STATUS' ? STATUS_COLOR[status] : 'text-cyan-400/60'
              }`}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>

      <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
        <span
          className={`rounded-full border px-2 py-0.5 text-[8px] font-semibold ${BADGE_STYLE[status]}`}
        >
          {BADGE_TEXT[status]}
        </span>
      </div>
    </div>
  );
}

// ── 최종 컴포넌트 ─────────────────────────────────────────────────────────────
export function GoliathLidarPointCloud() {
  const { status, dataRef, frameRef } = useLidarWebSocket(LIDAR_WS_URL);

  return (
    <div className="relative h-full w-full overflow-hidden bg-zinc-950">
      <LidarHud dataRef={dataRef} status={status} isLive={status === 'open'} />
      <Canvas gl={{ outputColorSpace: THREE.SRGBColorSpace }}>
        <PerspectiveCamera makeDefault position={[5, 3, 5]} fov={50} />
        <OrbitControls
          enableDamping
          dampingFactor={0.08}
          minDistance={0.5}
          maxDistance={50}
        />
        <ambientLight intensity={0.1} />
        <FloorGrid />
        <PointCloud dataRef={dataRef} frameRef={frameRef} />
        <ScanRing />
      </Canvas>
    </div>
  );
}
