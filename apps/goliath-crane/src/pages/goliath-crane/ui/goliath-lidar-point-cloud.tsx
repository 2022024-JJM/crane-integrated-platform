import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ScanLine, Activity } from 'lucide-react';

// ── 골리앗 크레인 환경을 모사한 LiDAR 포인트 클라우드 목업 데이터 생성 ──────────

/**
 * 포인트 클라우드 생성 전략:
 * - 지면 (ground plane) : y = 0 부근, 크레인 레일 폭(~120m) 내
 * - 크레인 거더(girder) : 수평 빔, y = 40m 부근
 * - 트롤리           : 거더 위를 이동하는 박스 형태
 * - 훅(hook) 케이블  : 수직 라인, 거더에서 지면으로
 * - 주변 구조물      : 창고 벽면, 기둥
 * 실제 LiDAR는 수백만 포인트이지만 WebGL 성능을 위해 ~8000포인트 사용
 */
function generateCranePointCloud(): Float32Array {
  const points: number[] = [];

  const rand = (min: number, max: number) => Math.random() * (max - min) + min;
  const noise = (scale = 0.05) => (Math.random() - 0.5) * scale;

  // 1. 지면 (Ground) — 노이즈 포함 평면
  for (let i = 0; i < 1800; i++) {
    const x = rand(-60, 60);
    const z = rand(-25, 25);
    points.push(x, noise(0.15), z);
  }

  // 2. 크레인 레일 (두 줄 — 좌/우)
  for (let i = 0; i < 400; i++) {
    const x = rand(-55, 55);
    const railZ = i < 200 ? -12 : 12;
    points.push(x, 0.12 + noise(0.03), railZ + noise(0.08));
  }

  // 3. 거더(Girder) 빔 — y=38m, z=0 수평
  for (let i = 0; i < 600; i++) {
    const x = rand(-55, 55);
    const y = 38 + noise(0.12);
    const z = noise(0.3);
    points.push(x, y, z);
  }

  // 4. 거더 양쪽 엔드 기둥(다리)
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 400; i++) {
      const x = side * (52 + noise(0.2));
      const y = rand(0, 38);
      const z = (Math.random() < 0.5 ? -12 : 12) + noise(0.15);
      points.push(x, y, z);
    }
  }

  // 5. 트롤리 박스 (거더 위 이동체) — x=15 ~ 20 구간
  for (let i = 0; i < 300; i++) {
    const face = Math.floor(Math.random() * 6);
    let x, y, z;
    switch (face) {
      case 0:
        x = rand(12, 20);
        y = 38 + noise(0.1);
        z = noise(1.2);
        break; // bottom
      case 1:
        x = rand(12, 20);
        y = 40 + noise(0.1);
        z = noise(1.2);
        break; // top
      case 2:
        x = 12 + noise(0.1);
        y = rand(38, 40);
        z = noise(1.2);
        break; // left
      case 3:
        x = 20 + noise(0.1);
        y = rand(38, 40);
        z = noise(1.2);
        break; // right
      case 4:
        x = rand(12, 20);
        y = rand(38, 40);
        z = -1.2 + noise(0.1);
        break; // front
      default:
        x = rand(12, 20);
        y = rand(38, 40);
        z = 1.2 + noise(0.1);
        break; // back
    }
    points.push(x!, y!, z!);
  }

  // 6. 훅 & 케이블 (트롤리에서 아래로)
  for (let i = 0; i < 350; i++) {
    const x = 16 + noise(0.2);
    const y = rand(0, 38); // 지면까지 내려온 상태
    const z = noise(0.2);
    points.push(x, y, z);
  }

  // 7. 화물 박스 (지면 위 적재)
  for (let bx = -40; bx <= 40; bx += 18) {
    if (Math.random() < 0.4) continue;
    const bh = rand(2, 5);
    for (let i = 0; i < 120; i++) {
      const face = Math.floor(Math.random() * 5);
      let x, y, z;
      switch (face) {
        case 0:
          x = rand(bx - 4, bx + 4);
          y = bh + noise(0.1);
          z = noise(4);
          break;
        case 1:
          x = bx - 4 + noise(0.1);
          y = rand(0, bh);
          z = noise(4);
          break;
        case 2:
          x = bx + 4 + noise(0.1);
          y = rand(0, bh);
          z = noise(4);
          break;
        case 3:
          x = rand(bx - 4, bx + 4);
          y = rand(0, bh);
          z = -4 + noise(0.1);
          break;
        default:
          x = rand(bx - 4, bx + 4);
          y = rand(0, bh);
          z = 4 + noise(0.1);
          break;
      }
      points.push(x!, y!, z!);
    }
  }

  // 8. 창고 벽면 (배경)
  for (let i = 0; i < 500; i++) {
    const x = rand(-58, 58);
    const y = rand(0, 20);
    const z = (Math.random() < 0.5 ? -22 : 22) + noise(0.1);
    points.push(x, y, z);
  }

  return new Float32Array(points);
}

// 포인트별 강도(intensity) → 색상 매핑
function generateIntensity(positions: Float32Array): Float32Array {
  const count = positions.length / 3;
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const y = positions[i * 3 + 1];

    // 높이 기반 색상 (LiDAR 기본 팔레트)
    // 지면: 청록색 → 중간: 녹색/황색 → 상단(크레인): 주황/빨강
    const t = Math.min(y / 40, 1);
    let r, g, b;
    if (t < 0.05) {
      // 지면 — 시안
      r = 0.0;
      g = 0.9;
      b = 0.85;
    } else if (t < 0.3) {
      // 낮은 구조물 — 초록
      r = 0.1 + t;
      g = 0.85;
      b = 0.2;
    } else if (t < 0.7) {
      // 중간 — 황색
      r = 0.9;
      g = 0.8 - t * 0.5;
      b = 0.05;
    } else {
      // 크레인 상단 — 주황/빨강
      r = 1.0;
      g = 0.4 - (t - 0.7) * 0.8;
      b = 0.0;
    }

    // 약간의 랜덤 노이즈로 반짝이는 느낌
    const jitter = 0.85 + Math.random() * 0.15;
    colors[i * 3] = Math.min(r * jitter, 1);
    colors[i * 3 + 1] = Math.min(g * jitter, 1);
    colors[i * 3 + 2] = Math.min(b * jitter, 1);
  }
  return colors;
}

// ── Three.js 포인트 클라우드 메시 ────────────────────────────────────────────
const BASE_POSITIONS = generateCranePointCloud();
const BASE_COLORS = generateIntensity(BASE_POSITIONS);

function PointCloud() {
  const ref = useRef<THREE.Points>(null);
  const timeRef = useRef(0);

  // geometry는 한 번만 생성
  const { geometry, originalPositions } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pos = BASE_POSITIONS.slice(); // copy
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute(
      'color',
      new THREE.BufferAttribute(BASE_COLORS.slice(), 3),
    );
    return { geometry: geo, originalPositions: pos };
  }, []);

  const material = useMemo(
    () =>
      new THREE.PointsMaterial({
        size: 0.35,
        vertexColors: true,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
      }),
    [],
  );

  // 매 프레임: 훅/트롤리 포인트에 미세 진동 + 전체 천천히 회전
  useFrame((_, delta) => {
    timeRef.current += delta;
    const t = timeRef.current;

    if (!ref.current) return;

    const pos = geometry.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;

    for (let i = 0; i < arr.length / 3; i++) {
      const oy = originalPositions[i * 3 + 1];
      // 케이블/훅 구간(y 0~38, x ~16) 에 진동
      if (oy > 0 && oy < 38 && Math.abs(originalPositions[i * 3] - 16) < 1) {
        arr[i * 3] = originalPositions[i * 3] + Math.sin(t * 1.2 + i) * 0.04;
        arr[i * 3 + 2] =
          originalPositions[i * 3 + 2] + Math.cos(t * 0.9 + i) * 0.04;
      }
      // 트롤리 구간(y 38~40) — 수평 이동 시뮬
      if (
        oy >= 38 &&
        oy <= 40 &&
        originalPositions[i * 3] > 10 &&
        originalPositions[i * 3] < 22
      ) {
        arr[i * 3] = originalPositions[i * 3] + Math.sin(t * 0.3) * 4;
      }
    }
    pos.needsUpdate = true;

    // 극히 느린 Y축 회전으로 "스캔 중" 느낌
    ref.current.rotation.y = Math.sin(t * 0.08) * 0.18;
  });

  return <points ref={ref} geometry={geometry} material={material} />;
}

// ── 스캔 라인 링 (LiDAR 회전 표현) ───────────────────────────────────────────
function ScanRing() {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.z += delta * 1.4;
  });

  return (
    <mesh ref={ref} position={[16, 39, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[2, 0.04, 8, 48]} />
      <meshBasicMaterial color="#00ffee" transparent opacity={0.5} />
    </mesh>
  );
}

// 바닥 그리드
function FloorGrid() {
  return (
    <gridHelper
      args={[120, 24, '#1a3a3a', '#0d2020']}
      position={[0, -0.05, 0]}
    />
  );
}

// ── HUD 오버레이 ──────────────────────────────────────────────────────────────
function LidarHud({ pointCount }: { pointCount: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {/* 상단 */}
      <div className="absolute top-3 left-4 flex items-center gap-2">
        <span className="relative flex size-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-cyan-500" />
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

      {/* 좌측 컬러 범례 */}
      <div className="absolute bottom-10 left-4 flex flex-col gap-0.5">
        {[
          { color: 'bg-red-400', label: '크레인 (38m+)' },
          { color: 'bg-yellow-400', label: '중간 구조물' },
          { color: 'bg-green-400', label: '저층 구조물' },
          { color: 'bg-cyan-400', label: '지면' },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span className={`size-2 rounded-full ${item.color} opacity-80`} />
            <span className="text-[8px] text-white/40">{item.label}</span>
          </div>
        ))}
      </div>

      {/* 우측 하단 스캔 파라미터 */}
      <div className="absolute right-4 bottom-3 flex flex-col items-end gap-0.5 font-mono">
        {[
          { label: 'RANGE', value: '120 m' },
          { label: 'FREQ', value: '10 Hz' },
          { label: 'CH', value: '32 ch' },
          { label: 'STATUS', value: 'MOCK' },
        ].map((row) => (
          <div key={row.label} className="flex items-center gap-2">
            <span className="text-[8px] text-white/25">{row.label}</span>
            <span className="text-[9px] text-cyan-400/60">{row.value}</span>
          </div>
        ))}
      </div>

      {/* 하단 중앙 — MOCK 배지 */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[8px] font-semibold text-amber-400/70">
          MOCK DATA — 백엔드 연결 후 실데이터로 교체
        </span>
      </div>
    </div>
  );
}

// ── 최종 컴포넌트 ─────────────────────────────────────────────────────────────
export function GoliathLidarPointCloud() {
  const pointCount = BASE_POSITIONS.length / 3;

  return (
    <div className="relative h-full w-full overflow-hidden bg-zinc-950">
      <LidarHud pointCount={pointCount} />
      <Canvas>
        <PerspectiveCamera makeDefault position={[80, 55, 80]} fov={50} />
        <OrbitControls
          enableDamping
          dampingFactor={0.08}
          minDistance={20}
          maxDistance={200}
          autoRotate
          autoRotateSpeed={0.4}
        />
        <ambientLight intensity={0.1} />
        <FloorGrid />
        <PointCloud />
        <ScanRing />
      </Canvas>
    </div>
  );
}
