// LiDAR ProcessedPointCloudBundle 스트림을 React Three Fiber 위에서
// monitoring_web/src/viewer.js + main.js 와 동일한 결과로 렌더링한다.
// 서버 vendor (SOSLAB/OUSTER/SICK 등) 와 무관하게 동일한 포맷이므로
// 본 viewer 는 vendor 중립이다.
//
// - 한 컴포넌트(<PointCloudViewer>) = 한 Canvas. 그리드에 SOSLAB1/SOSLAB2/
//   Fusion 3개 타일이 있으면 Canvas 도 3개지만, 데이터 소스(WebSocket) 는
//   point-cloud-stream-store 에서 단일하게 공유된다.
// - mode 에 따라 SOSLAB1 / SOSLAB2 의 가시성을 토글. fusion = 두 센서 모두 visible.
// - intensity 가 있으면 HSL 그래디언트 (0.63→0, 0.95, 0.55), 없으면 SENSOR_COLORS
//   고정색. 점 크기/그리드/축은 viewer.js 와 동일.
// - mode === 'fusion' 이고 compact 가 아니면 레퍼런스(main.js) 와 동일한
//   상단 메트릭 그리드 + 우측 센서 패널(Transform/Reset) HUD 를 노출한다.

import { Activity, ScanLine } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  STALE_SENSOR_MS,
} from '../lib/point-cloud/config';
import {
  usePointCloudStreamStore,
  type PointCloudConnectionStatus,
  type PointCloudSensorMode,
} from '../model/point-cloud-stream-store';

const DEG_TO_RAD = Math.PI / 180;
const tempColor = new THREE.Color();

interface SensorPointsProps {
  sensorKey: string;
  fallbackColorHex: string;
  /** mode 기반의 강제 hide. 사용자가 패널 체크박스로 끄면 store 의 isVisible 도 false 가 된다. */
  modeVisible: boolean;
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
  modeVisible,
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
  const lastSeenTransform = useRef(-1);
  const pointsRef = useRef<THREE.Points>(null);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame(() => {
    const buffer = usePointCloudStreamStore.getState().sensors.get(sensorKey);
    if (!buffer) return;
    const points = pointsRef.current;

    // 사용자 토글이 꺼져 있거나 mode 가 이 센서를 숨길 때는 mesh 자체를 hide.
    const effectiveVisible = modeVisible && buffer.isVisible;
    if (points) {
      points.visible = effectiveVisible && Boolean(buffer.parsed?.ok);
    }
    if (!effectiveVisible) return;

    // Transform 변경 시 mesh position/rotation 갱신.
    if (lastSeenTransform.current !== buffer.transformRevision && points) {
      lastSeenTransform.current = buffer.transformRevision;
      const t = buffer.transform;
      points.position.set(t.position.x, t.position.y, t.position.z);
      points.rotation.set(
        t.rotation.x * DEG_TO_RAD,
        t.rotation.y * DEG_TO_RAD,
        t.rotation.z * DEG_TO_RAD,
      );
      points.updateMatrix();
      points.updateMatrixWorld(true);
    }

    if (!buffer.parsed || !buffer.parsed.ok) return;
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

    if (points) {
      points.visible = effectiveVisible && count > 0;
    }
  });

  return (
    <points
      ref={pointsRef}
      geometry={geometry}
      material={material}
      visible={modeVisible}
    />
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

interface CameraControllerProps {
  /** parent 가 호출하면 강제로 fit 을 다시 수행 (Refit 버튼 용도). */
  refitToken: number;
}

/**
 * 첫 프레임에 한해 모든 visible 센서의 bounds 합집합으로 카메라를 fit.
 * OrbitControls 가 한 번이라도 조작되면 fit 을 멈춘다 (참조 viewer.js 와 동일).
 * Refit 버튼이 누르면 userDirty 를 무시하고 한 번 더 fit.
 */
function CameraController({ refitToken }: CameraControllerProps) {
  const { camera, controls } = useThree();
  const fittedRef = useRef(false);
  const userDirtyRef = useRef(false);
  const lastSeenFrameRef = useRef(-1);
  const lastRefitTokenRef = useRef(refitToken);

  useEffect(() => {
    const c = controls as unknown as
      | {
          addEventListener?: (type: string, fn: () => void) => void;
          removeEventListener?: (type: string, fn: () => void) => void;
        }
      | null;
    if (!c?.addEventListener) return;
    const onStart = () => {
      userDirtyRef.current = true;
    };
    c.addEventListener('start', onStart);
    return () => c.removeEventListener?.('start', onStart);
  }, [controls]);

  const tryFit = useCallback(
    (force: boolean) => {
      const sensors = usePointCloudStreamStore.getState().sensors;
      const box = new THREE.Box3();
      let hasPoints = false;
      const corner = new THREE.Vector3();

      for (const buf of sensors.values()) {
        if (!buf.isVisible) continue;
        if (!buf.parsed || !buf.parsed.ok || !buf.parsed.bounds) continue;
        // Transform 이 적용된 world bounds 를 사용.
        const matrix = new THREE.Matrix4().compose(
          new THREE.Vector3(
            buf.transform.position.x,
            buf.transform.position.y,
            buf.transform.position.z,
          ),
          new THREE.Quaternion().setFromEuler(
            new THREE.Euler(
              buf.transform.rotation.x * DEG_TO_RAD,
              buf.transform.rotation.y * DEG_TO_RAD,
              buf.transform.rotation.z * DEG_TO_RAD,
            ),
          ),
          new THREE.Vector3(1, 1, 1),
        );
        const { min, max } = buf.parsed.bounds;
        for (const x of [min[0], max[0]]) {
          for (const y of [min[1], max[1]]) {
            for (const z of [min[2], max[2]]) {
              corner.set(x, y, z).applyMatrix4(matrix);
              box.expandByPoint(corner);
              hasPoints = true;
            }
          }
        }
      }
      if (!hasPoints) return false;

      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const dominant = Math.max(size.x, size.y, size.z, 1);
      const offset = new THREE.Vector3(1, 1, 1)
        .normalize()
        .multiplyScalar(dominant * 1.6);

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
      if (force) {
        userDirtyRef.current = false;
      }
      return true;
    },
    [camera, controls],
  );

  // 외부 Refit 트리거.
  useEffect(() => {
    if (refitToken === lastRefitTokenRef.current) return;
    lastRefitTokenRef.current = refitToken;
    const ok = tryFit(true);
    if (ok) fittedRef.current = true;
  }, [refitToken, tryFit]);

  // 첫 프레임 auto-fit.
  useFrame(() => {
    if (fittedRef.current || userDirtyRef.current) return;
    const counter = usePointCloudStreamStore.getState().globalFrameCounter;
    if (counter === lastSeenFrameRef.current) return;
    lastSeenFrameRef.current = counter;

    if (tryFit(false)) {
      fittedRef.current = true;
    }
  });

  return null;
}

const STATUS_LABEL: Record<PointCloudConnectionStatus, string> = {
  idle: 'IDLE',
  connecting: 'CONNECTING',
  connected: 'LIVE',
  error: 'ERROR',
  closed: 'DISCONNECTED',
};

const STATUS_COLOR: Record<PointCloudConnectionStatus, string> = {
  idle: 'text-white/40',
  connecting: 'text-yellow-400/70',
  connected: 'text-green-400',
  error: 'text-red-400/70',
  closed: 'text-red-400/70',
};

interface CompactHudProps {
  mode: PointCloudSensorMode;
  status: PointCloudConnectionStatus;
}

/** 단일/2번/썸네일 모드용 가벼운 HUD. 기존 디자인 유지. */
function CompactHud({ mode, status }: CompactHudProps) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(id);
  }, []);

  const sensors = usePointCloudStreamStore.getState().sensors;
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

function formatBigInt(value: bigint | null): string {
  if (value === null) return 'n/a';
  const abs = value < 0n ? -value : value;
  const grouped = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return value < 0n ? `-${grouped}` : grouped;
}

function formatRelativeTime(timestampMs: number): string {
  if (!timestampMs) return 'n/a';
  const delta = Math.max(0, Date.now() - timestampMs);
  if (delta < 1000) return 'just now';
  if (delta < 60_000) return `${Math.floor(delta / 1000)}s ago`;
  return `${Math.floor(delta / 60_000)}m ago`;
}

function formatTransformValue(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return Object.is(value, -0) ? '0' : String(value);
}

interface FusionHudProps {
  status: PointCloudConnectionStatus;
  onRefit: () => void;
}

const CONNECTION_PILL_CLASS: Record<PointCloudConnectionStatus, string> = {
  idle: 'border-white/20 text-white/50',
  connecting: 'border-amber-400/40 text-amber-300',
  connected: 'border-emerald-400/40 text-emerald-300',
  error: 'border-rose-400/40 text-rose-300',
  closed: 'border-rose-400/40 text-rose-300',
};

const TRANSFORM_AXES: ReadonlyArray<{
  group: 'position' | 'rotation';
  axis: 'x' | 'y' | 'z';
  label: string;
}> = [
  { group: 'position', axis: 'x', label: 'Pos X' },
  { group: 'position', axis: 'y', label: 'Pos Y' },
  { group: 'position', axis: 'z', label: 'Pos Z' },
  { group: 'rotation', axis: 'x', label: 'Rot X' },
  { group: 'rotation', axis: 'y', label: 'Rot Y' },
  { group: 'rotation', axis: 'z', label: 'Rot Z' },
];

/**
 * Fusion 풀스크린 전용 HUD. monitoring_web/src/main.js 와 동등한 정보를
 * 모두 제공한다 (Connection / Endpoint / Last Receive / Refit / 메트릭 그리드
 * / 센서 카드(toggle/메타/Transform/Reset)).
 */
function FusionHud({ status, onRefit }: FusionHudProps) {
  // store mutation 은 set 을 통과하지 않는 in-place 패턴이므로 React 가
  // 자동 리렌더하지 않는다. 500ms tick 으로 강제 갱신.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(id);
  }, []);

  const [panelOpen, setPanelOpen] = useState(true);

  const bundle = usePointCloudStreamStore.getState().bundle;
  const lastError = usePointCloudStreamStore((s) => s.lastError);
  const sensors = usePointCloudStreamStore.getState().sensors;
  const frameCounter = usePointCloudStreamStore((s) => s.globalFrameCounter);
  const setSensorVisible = usePointCloudStreamStore((s) => s.setSensorVisible);
  const setSensorTransformAxis = usePointCloudStreamStore(
    (s) => s.setSensorTransformAxis,
  );
  const resetSensorTransform = usePointCloudStreamStore(
    (s) => s.resetSensorTransform,
  );

  // sensors Map 은 in-place mutate 되어 참조가 바뀌지 않는다. 새 센서가
  // 추가되거나 visibility/transform 이 바뀌면 store 가 globalFrameCounter 를
  // 올리므로 그것을 deps 에 포함해 entries 를 다시 평가한다.
  const sensorEntries = useMemo(
    () =>
      Array.from(sensors.entries()).sort(([a], [b]) => a.localeCompare(b)),
    [sensors, frameCounter],
  );

  const now = Date.now();
  const activeCount = sensorEntries.filter(
    ([, s]) => now - s.lastUpdatedAtMs < STALE_SENSOR_MS,
  ).length;

  const metrics: Array<[string, string]> = [
    ['Sequence', formatBigInt(bundle.lastSequence)],
    [
      'Drop Gap',
      bundle.lastGap > 0n ? `${formatBigInt(bundle.lastGap)} dropped` : 'None',
    ],
    ['Processor', bundle.processorName],
    ['Rendered Points', formatBigInt(BigInt(bundle.totalRenderedPoints))],
    ['Bundle Window', bundle.windowSizeMs ? `${bundle.windowSizeMs} ms` : 'n/a'],
    ['Decode Error', lastError || 'None'],
  ];

  return (
    <div className="pointer-events-none absolute inset-0 z-10 font-mono text-cyan-100">
      {/* 우상단: 상태 strip + 메트릭 */}
      <div className="absolute top-4 right-4 flex max-w-[68vw] flex-col items-end gap-3">
        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full border bg-slate-900/70 px-3 py-1.5 text-[10px] font-bold tracking-[0.18em] uppercase backdrop-blur ${CONNECTION_PILL_CLASS[status]}`}
          >
            {STATUS_LABEL[status]}
          </span>
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 px-3 py-2 text-[10px] backdrop-blur">
            <div className="tracking-[0.16em] text-white/40 uppercase">
              Last Receive
            </div>
            <div className="mt-0.5 text-[12px] font-bold text-white/90">
              {formatRelativeTime(bundle.lastBundleAtMs)}
            </div>
          </div>
          <button
            type="button"
            onClick={onRefit}
            className="cursor-pointer rounded-full border border-cyan-400/40 bg-cyan-500/10 px-3 py-1.5 text-[10px] font-bold tracking-[0.18em] text-cyan-200 uppercase backdrop-blur transition hover:border-cyan-300 hover:bg-cyan-500/20"
          >
            Refit View
          </button>
        </div>

        <div className="pointer-events-auto grid w-[min(40vw,520px)] grid-cols-3 gap-2">
          {metrics.map(([label, value]) => (
            <div
              key={label}
              className="rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 backdrop-blur"
            >
              <div className="text-[9px] tracking-[0.14em] text-white/40 uppercase">
                {label}
              </div>
              <div className="mt-0.5 truncate text-[11px] font-bold text-white/90">
                {value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 좌측 센서 패널 */}
      <aside
        className={`pointer-events-auto absolute top-4 bottom-4 left-4 z-0 flex flex-col rounded-2xl border border-white/10 bg-slate-950/80 shadow-2xl transition-[width] ${
          panelOpen ? 'w-[min(420px,calc(100vw-32px))]' : 'w-50'
        }`}
      >
        <header className="flex items-center justify-between border-b border-white/5 px-4 py-3">
          <div>
            <div className="text-[9px] tracking-[0.16em] text-white/40 uppercase">
              Sensors
            </div>
            <div className="mt-0.5 text-[12px] font-bold text-white/90">
              {activeCount} active
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPanelOpen((v) => !v)}
            className="cursor-pointer rounded-full border border-white/15 bg-slate-900/70 px-2.5 py-1 text-[9px] font-bold tracking-[0.16em] text-white/70 uppercase transition hover:border-cyan-300 hover:text-cyan-200"
          >
            {panelOpen ? 'Collapse' : 'Expand'}
          </button>
        </header>

        {panelOpen && (
          <div className="flex-1 overflow-auto px-3 py-3">
            {sensorEntries.length === 0 ? (
              <p className="rounded-xl border border-dashed border-white/10 bg-slate-900/40 px-4 py-6 text-center text-[11px] text-white/40">
                No sensor frames received yet.
              </p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {sensorEntries.map(([key, sensor]) => {
                  const isStale =
                    sensor.lastUpdatedAtMs > 0 &&
                    now - sensor.lastUpdatedAtMs >= STALE_SENSOR_MS;
                  const parsed = sensor.parsed;
                  const healthLabel = !parsed
                    ? 'Waiting'
                    : !parsed.ok
                      ? 'Parse error'
                      : isStale
                        ? 'Stale'
                        : 'Live';
                  const healthClass = !parsed
                    ? 'text-white/40'
                    : !parsed.ok
                      ? 'text-rose-300'
                      : isStale
                        ? 'text-amber-300'
                        : 'text-emerald-300';
                  const rendered =
                    parsed && parsed.ok ? parsed.sampledPointCount : 0;
                  const raw = parsed && parsed.ok ? parsed.pointCount : 0;
                  const hasIntensity =
                    parsed && parsed.ok ? parsed.hasIntensity : false;
                  const skipped =
                    parsed && parsed.ok ? parsed.skippedPointCount : 0;
                  const errorMessage =
                    parsed && !parsed.ok ? parsed.error : '';

                  return (
                    <article
                      key={key}
                      className={`rounded-xl border bg-slate-900/60 px-3 py-3 ${
                        errorMessage
                          ? 'border-rose-400/30'
                          : 'border-white/10'
                      }`}
                    >
                      <label className="flex cursor-pointer items-center gap-2 text-[12px] font-bold text-white/90">
                        <input
                          type="checkbox"
                          checked={sensor.isVisible}
                          onChange={(e) =>
                            setSensorVisible(key, e.target.checked)
                          }
                          className="size-3.5 cursor-pointer accent-cyan-400"
                        />
                        <span
                          aria-hidden
                          className="size-2.5 rounded-full"
                          style={{
                            background: sensor.colorHex,
                            boxShadow: `0 0 10px ${sensor.colorHex}`,
                          }}
                        />
                        <span className="flex-1 truncate">
                          {sensor.sensorName}
                        </span>
                      </label>

                      <div
                        className={`mt-2 inline-flex rounded-full bg-white/5 px-2 py-0.5 text-[9px] font-bold tracking-[0.14em] uppercase ${healthClass}`}
                      >
                        {healthLabel}
                      </div>

                      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
                        <SensorMetaRow
                          label="Rendered"
                          value={rendered.toLocaleString()}
                        />
                        <SensorMetaRow
                          label="Raw"
                          value={raw.toLocaleString()}
                        />
                        <SensorMetaRow
                          label="Intensity"
                          value={hasIntensity ? 'Yes' : 'No'}
                        />
                        <SensorMetaRow
                          label="Age"
                          value={formatRelativeTime(sensor.lastUpdatedAtMs)}
                        />
                        <SensorMetaRow label="Frame" value={sensor.frameId} />
                        <SensorMetaRow label="Vendor" value={sensor.vendor} />
                      </dl>

                      <section className="mt-3 border-t border-white/5 pt-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-[9px] tracking-[0.16em] text-white/40 uppercase">
                            Transform
                          </span>
                          <button
                            type="button"
                            onClick={() => resetSensorTransform(key)}
                            className="cursor-pointer rounded-full border border-white/15 bg-slate-900/70 px-2 py-0.5 text-[9px] font-bold tracking-[0.14em] text-white/60 uppercase transition hover:border-cyan-300 hover:text-cyan-200"
                          >
                            Reset
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {TRANSFORM_AXES.map(({ group, axis, label }) => (
                            <label
                              key={`${group}-${axis}`}
                              className="flex flex-col gap-1"
                            >
                              <span className="text-[9px] tracking-[0.12em] text-white/40 uppercase">
                                {label}
                              </span>
                              <input
                                type="number"
                                step={0.1}
                                value={formatTransformValue(
                                  sensor.transform[group][axis],
                                )}
                                onChange={(e) => {
                                  const next = Number.parseFloat(
                                    e.target.value,
                                  );
                                  if (!Number.isFinite(next)) return;
                                  setSensorTransformAxis(
                                    key,
                                    group,
                                    axis,
                                    next,
                                  );
                                }}
                                className="rounded-md border border-white/15 bg-slate-950/80 px-2 py-1 text-[11px] text-white/90 focus:border-cyan-400 focus:outline-none"
                              />
                            </label>
                          ))}
                        </div>
                      </section>

                      <p className="mt-3 truncate text-[10px] text-white/50">
                        {sensor.sourceTopic}
                      </p>

                      {errorMessage ? (
                        <p className="mt-2 text-[10px] text-rose-300">
                          {errorMessage}
                        </p>
                      ) : skipped > 0 ? (
                        <p className="mt-2 text-[10px] text-white/40">
                          {skipped.toLocaleString()} points skipped during
                          sampling or validation.
                        </p>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

function SensorMetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[9px] tracking-[0.12em] text-white/40 uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 truncate font-bold text-white/85">{value}</dd>
    </div>
  );
}

export interface PointCloudViewerProps {
  /** 어떤 센서를 보여줄지. fusion = 둘 다 visible 합성. */
  mode: PointCloudSensorMode;
  /** 좁은 썸네일용. HUD 와 OrbitControls 를 끄고 자동 회전. */
  compact?: boolean;
}

export function PointCloudViewer({
  mode,
  compact = false,
}: PointCloudViewerProps) {
  // 단일 WebSocket 공유: 마운트마다 acquire, 언마운트마다 release.
  useEffect(() => {
    const { acquire, release } = usePointCloudStreamStore.getState();
    acquire();
    return () => release();
  }, []);

  const status = usePointCloudStreamStore((s) => s.status);
  const [refitToken, setRefitToken] = useState(0);
  const showFusionHud = !compact && mode === 'fusion';

  return (
    <div className="relative h-full w-full overflow-hidden bg-zinc-950">
      {!compact && !showFusionHud && <CompactHud mode={mode} status={status} />}
      {showFusionHud && (
        <FusionHud
          status={status}
          onRefit={() => setRefitToken((t) => t + 1)}
        />
      )}
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
          modeVisible={mode === 'soslab1' || mode === 'fusion'}
        />
        <SensorPoints
          sensorKey="soslab2"
          fallbackColorHex={SENSOR_COLORS[1]}
          modeVisible={mode === 'soslab2' || mode === 'fusion'}
        />
        <CameraController refitToken={refitToken} />
      </Canvas>
    </div>
  );
}
