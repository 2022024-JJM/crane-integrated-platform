import { parse } from '@foxglove/rosmsg';
import { MessageReader } from '@foxglove/rosmsg2-serialization';
import {
  FoxgloveClient,
  type IWebSocket,
  type MessageData,
  type SubscriptionId,
} from '@foxglove/ws-protocol';
import {
  GizmoHelper,
  GizmoViewport,
  Html,
  OrbitControls,
} from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

const BRIDGE_SUBPROTOCOL = 'foxglove.sdk.v1';
const TOPICS = {
  camera: '/detections/image',
  lidar: '/lidar/roi_alarm',
  lidarMarker: '/lidar/roi_marker',
  lidarPoints: '/lidar/points_preprocessed',
  alarms: '/monitoring/alarms',
} as const;

const LIDAR_VIEW = {
  range: 50,
  fov: (Math.PI * 140) / 180,
  initialRange: 18,
};

type ConnectionState = 'connecting' | 'connected' | 'closed' | 'error';

type RosImage = {
  width: number;
  height: number;
  encoding: string;
  step: number;
  data: Uint8Array | number[];
};

type RosPointField = {
  name: string;
  offset: number;
  datatype: number;
};

type RosPointCloud2 = {
  width: number;
  height: number;
  is_bigendian: boolean;
  point_step: number;
  fields: RosPointField[];
  data: Uint8Array | number[];
};

type RosVector3 = {
  x: number;
  y: number;
  z: number;
};

type RoiAlarm = {
  name: string;
  alarm: boolean;
  point_count: number;
  threshold: number;
};

type RoiAlarmArray = {
  alarms: RoiAlarm[];
};

type RoiMarker = {
  id: number;
  pose: {
    position: RosVector3;
  };
  scale: RosVector3;
  color: {
    r: number;
    g: number;
    b: number;
    a: number;
  };
};

type RoiMarkerArray = {
  markers: RoiMarker[];
};

type MonitoringAlarm = {
  alarm: boolean;
  level: 'green' | 'yellow' | 'red' | string;
  status: string;
  age_seconds: number;
  active_rois: RoiAlarm[];
  matched_detections: Array<{
    label: string;
    score: number;
  }>;
};

type TopicState<T> = {
  data: T | null;
  receivedAt: number | null;
};

type Subscription = {
  topic: string;
  reader: MessageReader;
};

export function CabinMonitoringView({ regionId }: { regionId: string }) {
  return <CabinMonitoringViewContent key={regionId} />;
}

function CabinMonitoringViewContent() {
  const bridgeUrl = useMemo(
    () =>
      import.meta.env.VITE_CABIN_BRIDGE_URL ||
      `ws://${window.location.hostname}:8765`,
    [],
  );
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const subscriptionsRef = useRef(new Map<SubscriptionId, Subscription>());
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [imageReceivedAt, setImageReceivedAt] = useState<number | null>(null);
  const [lidar, setLidar] = useState<TopicState<RoiAlarmArray>>({
    data: null,
    receivedAt: null,
  });
  const [lidarMarker, setLidarMarker] = useState<TopicState<RoiMarkerArray>>({
    data: null,
    receivedAt: null,
  });
  const [lidarPoints, setLidarPoints] = useState<TopicState<RosVector3[]>>({
    data: null,
    receivedAt: null,
  });
  const [alarm, setAlarm] = useState<TopicState<MonitoringAlarm>>({
    data: null,
    receivedAt: null,
  });

  useEffect(() => {
    const ws = new WebSocket(bridgeUrl, [BRIDGE_SUBPROTOCOL]);
    const client = new FoxgloveClient({ ws: ws as unknown as IWebSocket });
    const subscriptions = subscriptionsRef.current;

    client.on('open', () => setConnection('connected'));
    client.on('close', () => setConnection('closed'));
    client.on('error', () => setConnection('error'));
    client.on('advertise', (advertisedChannels) => {
      for (const channel of advertisedChannels) {
        if (!isRequiredTopic(channel.topic) || channel.encoding !== 'cdr') {
          continue;
        }

        const subscriptionId = client.subscribe(channel.id);
        subscriptions.set(subscriptionId, {
          topic: channel.topic,
          reader: new MessageReader(parse(channel.schema, { ros2: true })),
        });
      }
    });
    client.on('message', (message) => {
      const subscription = subscriptions.get(message.subscriptionId);
      if (!subscription) return;

      handleMessage(subscription, message, canvasRef.current, {
        setImageReceivedAt,
        setLidar,
        setLidarMarker,
        setLidarPoints,
        setAlarm,
      });
    });

    return () => {
      client.close();
      subscriptions.clear();
    };
  }, [bridgeUrl]);

  const roiAlarms = lidar.data?.alarms ?? [];
  const roiMarkers = lidarMarker.data?.markers ?? [];
  const points = lidarPoints.data ?? [];

  return (
    <main className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-3 bg-zinc-950 p-4 text-zinc-100">
      <header className="flex min-h-20 items-center justify-between gap-4 border border-zinc-700 bg-zinc-900 p-4">
        <div>
          <p className="text-xs font-bold tracking-widest text-zinc-400 uppercase">
            Crane cabin monitoring
          </p>
          <h1 className="text-3xl font-black">Cabin Watch</h1>
        </div>
        <ConnectionBadge connection={connection} url={bridgeUrl} />
      </header>

      <section
        className="grid min-h-0 grid-cols-2 gap-3 max-lg:grid-cols-1"
        aria-label="실시간 모니터링"
      >
        <CameraPanel
          canvasRef={canvasRef}
          hasImage={imageReceivedAt != null}
          receivedLabel={timeLabel(imageReceivedAt)}
          topic={TOPICS.camera}
        />
        <LidarPanel
          markers={roiMarkers}
          pointCloudLabel={timeLabel(lidarPoints.receivedAt)}
          points={points}
          received={lidar.receivedAt != null}
          receivedLabel={timeLabel(lidar.receivedAt)}
          rois={roiAlarms}
          topic={TOPICS.lidar}
        />
      </section>

      <AlarmStrip
        alarm={alarm.data}
        receivedLabel={timeLabel(alarm.receivedAt)}
        topic={TOPICS.alarms}
      />
    </main>
  );
}

function ConnectionBadge({
  connection,
  url,
}: {
  connection: ConnectionState;
  url: string;
}) {
  const isConnected = connection === 'connected';
  const isError = connection === 'closed' || connection === 'error';
  return (
    <div className="flex items-center gap-2 border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-bold whitespace-nowrap text-zinc-300">
      <span
        className={
          isConnected
            ? 'size-2.5 rounded-full bg-emerald-400'
            : isError
              ? 'size-2.5 rounded-full bg-red-400'
              : 'size-2.5 rounded-full bg-zinc-500'
        }
      />
      {connectionLabel(connection)} · {url}
    </div>
  );
}

function CameraPanel({
  canvasRef,
  receivedLabel,
  hasImage,
  topic,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  receivedLabel: string;
  hasImage: boolean;
  topic: string;
}) {
  return (
    <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden border border-zinc-700 bg-zinc-900 p-3">
      <PanelHead
        kicker="Camera"
        title={topic}
        active={hasImage}
        status={receivedLabel}
      />
      <div className="relative grid min-h-0 place-items-center overflow-hidden border border-zinc-800 bg-black">
        <canvas
          ref={canvasRef}
          className="h-full w-full object-contain"
          aria-label="객체 검출 카메라 영상"
        />
        {!hasImage ? (
          <p className="absolute text-sm font-bold text-zinc-500">
            영상 수신 대기
          </p>
        ) : null}
      </div>
    </section>
  );
}

function LidarPanel({
  markers,
  pointCloudLabel,
  points,
  received,
  receivedLabel,
  rois,
  topic,
}: {
  markers: RoiMarker[];
  pointCloudLabel: string;
  points: RosVector3[];
  received: boolean;
  receivedLabel: string;
  rois: RoiAlarm[];
  topic: string;
}) {
  return (
    <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden border border-zinc-700 bg-zinc-900 p-3">
      <PanelHead
        kicker="LiDAR ROI"
        title={topic}
        active={received}
        status={receivedLabel}
      />
      <LidarCanvas
        markers={markers}
        pointCloudLabel={pointCloudLabel}
        points={points}
      />
      <div className="mt-3 grid max-h-36 gap-2 overflow-auto">
        {rois.map((roi) => (
          <RoiCard key={roi.name} roi={roi} />
        ))}
      </div>
    </section>
  );
}

function LidarCanvas({
  markers,
  pointCloudLabel,
  points,
}: {
  markers: RoiMarker[];
  pointCloudLabel: string;
  points: RosVector3[];
}) {
  const camera = cameraForScene(markers, points);

  return (
    <div className="relative min-h-0 overflow-hidden border border-zinc-800 bg-[#080d0b]">
      <Canvas
        orthographic
        camera={{
          position: [0, camera.height, 0],
          rotation: [-Math.PI / 2, 0, 0],
          up: [0, 0, 1],
          zoom: camera.zoom,
        }}
      >
        <FovGuide />
        <LidarOrigin />
        <PointCloud points={points} />
        <OrbitControls makeDefault enableDamping={false} target={[0, 0, 0]} />
        <GizmoHelper alignment="bottom-right" margin={[54, 54]}>
          <GizmoViewport
            axisColors={['#ff5c5c', '#23d77a', '#5c8dff']}
            labels={['Y', 'Z', 'X']}
            labelColor="#f7fffb"
          />
        </GizmoHelper>
        {markers.map((marker) => (
          <RoiBox key={marker.id} marker={marker} />
        ))}
      </Canvas>
      <span className="absolute top-3 left-3 border border-zinc-700 bg-black/70 px-2 py-1 text-xs font-bold text-zinc-300">
        PCD {pointCloudLabel} · {points.length} pts
      </span>
      {markers.length === 0 && points.length === 0 ? (
        <p className="absolute inset-0 grid place-items-center text-sm font-bold text-zinc-500">
          ROI/PCD 수신 대기
        </p>
      ) : null}
    </div>
  );
}

function FovGuide() {
  const geometries = useMemo(() => {
    const edge = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.01, 0),
      guidePoint(-LIDAR_VIEW.fov / 2, LIDAR_VIEW.range),
      new THREE.Vector3(0, 0.01, 0),
      guidePoint(LIDAR_VIEW.fov / 2, LIDAR_VIEW.range),
    ]);
    const rings = [10, 20, 30, 40, 50].map((range) =>
      new THREE.BufferGeometry().setFromPoints(arcPoints(range)),
    );
    return { edge, rings };
  }, []);

  return (
    <group>
      <lineSegments geometry={geometries.edge}>
        <lineBasicMaterial color="#4fa087" transparent opacity={0.62} />
      </lineSegments>
      {geometries.rings.map((geometry, index) => (
        <group key={index}>
          <lineSegments geometry={geometry}>
            <lineBasicMaterial color="#2f6f62" transparent opacity={0.55} />
          </lineSegments>
          <Html position={guidePoint(0, (index + 1) * 10)} center>
            <span className="border border-emerald-900/80 bg-black/70 px-1.5 py-0.5 text-[11px] font-bold whitespace-nowrap text-emerald-100">
              {(index + 1) * 10}m
            </span>
          </Html>
        </group>
      ))}
    </group>
  );
}

function LidarOrigin() {
  const heading = useMemo(
    () =>
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0.12, 0),
        new THREE.Vector3(0, 0.12, 0.55),
      ]),
    [],
  );

  return (
    <group>
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.16, 24]} />
        <meshBasicMaterial color="#f7fffb" />
      </mesh>
      <lineSegments geometry={heading}>
        <lineBasicMaterial color="#f7fffb" />
      </lineSegments>
    </group>
  );
}

function PointCloud({ points }: { points: RosVector3[] }) {
  const geometry = useMemo(() => {
    const maxPoints = 12000;
    // ponytail: canvas cap only; raise it when profiling says the browser can afford more.
    const step = Math.max(1, Math.ceil(points.length / maxPoints));
    const positions = new Float32Array(Math.ceil(points.length / step) * 3);
    let offset = 0;

    for (let i = 0; i < points.length; i += step) {
      const [sceneX, sceneY, sceneZ] = rosToScenePoint(points[i]);
      positions[offset] = sceneX;
      positions[offset + 1] = sceneY;
      positions[offset + 2] = sceneZ;
      offset += 3;
    }

    return new THREE.BufferGeometry().setAttribute(
      'position',
      new THREE.BufferAttribute(positions, 3),
    );
  }, [points]);

  return (
    <points geometry={geometry}>
      <pointsMaterial
        color="#f2d06b"
        depthTest={false}
        size={2}
        sizeAttenuation={false}
      />
    </points>
  );
}

function guidePoint(angle: number, range: number) {
  return new THREE.Vector3(
    Math.sin(angle) * range,
    0.01,
    Math.cos(angle) * range,
  );
}

function arcPoints(range: number) {
  const points: THREE.Vector3[] = [];
  const segments = 40;
  let previous = guidePoint(-LIDAR_VIEW.fov / 2, range);
  for (let i = 1; i <= segments; i += 1) {
    const angle = -LIDAR_VIEW.fov / 2 + (LIDAR_VIEW.fov * i) / segments;
    const current = guidePoint(angle, range);
    points.push(previous, current);
    previous = current;
  }
  return points;
}

function RoiBox({ marker }: { marker: RoiMarker }) {
  const { position } = marker.pose;
  const { scale } = marker;
  const { x: scaleX, y: scaleY, z: scaleZ } = scale;
  const geometry = useMemo(() => {
    const box = new THREE.BoxGeometry(
      ...rosSizeToSceneSize({ x: scaleX, y: scaleY, z: scaleZ }),
    );
    return new THREE.EdgesGeometry(box);
  }, [scaleX, scaleY, scaleZ]);
  const color = useMemo(
    () => new THREE.Color(marker.color.r, marker.color.g, marker.color.b),
    [marker.color.b, marker.color.g, marker.color.r],
  );

  return (
    <group position={rosToScenePoint(position)}>
      <lineSegments geometry={geometry}>
        <lineBasicMaterial color={color} />
      </lineSegments>
      <Html position={[0, scaleZ / 2 + 0.12, 0]} center>
        <span className="border border-zinc-600 bg-black/75 px-1.5 py-0.5 text-[11px] font-bold whitespace-nowrap text-zinc-100">
          x {formatMeter(position.x - scaleX / 2)}-
          {formatMeter(position.x + scaleX / 2)}m · 폭 {formatMeter(scaleY)}m
        </span>
      </Html>
    </group>
  );
}

function cameraForScene(markers: RoiMarker[], points: RosVector3[]) {
  const range =
    markers.length === 0 && points.length === 0 ? LIDAR_VIEW.initialRange : 1;
  let minX = -Math.sin(LIDAR_VIEW.fov / 2) * range;
  let maxX = Math.sin(LIDAR_VIEW.fov / 2) * range;
  let minZ = 0;
  let maxZ = range;

  for (const marker of markers) {
    const { position } = marker.pose;
    const { scale } = marker;
    minX = Math.min(minX, position.y - scale.y / 2);
    maxX = Math.max(maxX, position.y + scale.y / 2);
    minZ = Math.min(minZ, position.x - scale.x / 2);
    maxZ = Math.max(maxZ, position.x + scale.x / 2);
  }

  const width = Math.max(maxX - minX, maxZ - minZ, 1);

  return {
    height: 10,
    x: (minX + maxX) / 2,
    z: (minZ + maxZ) / 2,
    zoom: 110 / width,
  };
}

function PanelHead({
  kicker,
  title,
  active,
  status,
}: {
  kicker: string;
  title: string;
  active: boolean;
  status: string;
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-bold tracking-widest text-zinc-400 uppercase">
          {kicker}
        </p>
        <h2 className="truncate text-base font-extrabold text-zinc-50">
          {title}
        </h2>
      </div>
      <StatusPill active={active} label={status} />
    </div>
  );
}

function StatusPill({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={
        active
          ? 'border border-emerald-700 bg-emerald-950 px-2 py-1 text-xs font-bold whitespace-nowrap text-emerald-300'
          : 'border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs font-bold whitespace-nowrap text-zinc-400'
      }
    >
      {label}
    </span>
  );
}

function RoiCard({ roi }: { roi: RoiAlarm }) {
  const ratio = Math.min(
    100,
    (roi.point_count / Math.max(roi.threshold, 1)) * 100,
  );
  return (
    <article
      className={
        roi.alarm
          ? 'grid grid-cols-[minmax(0,1fr)_auto] gap-2 border border-red-500/70 bg-red-950/50 p-3'
          : 'grid grid-cols-[minmax(0,1fr)_auto] gap-2 border border-zinc-700 bg-zinc-950/60 p-3'
      }
    >
      <div className="min-w-0">
        <h3 className="truncate text-sm font-extrabold">{roi.name}</h3>
        <p
          className={
            roi.alarm
              ? 'text-xs font-bold text-red-300'
              : 'text-xs font-bold text-emerald-300'
          }
        >
          {roi.alarm ? 'ALARM' : 'NORMAL'}
        </p>
      </div>
      <strong className="text-xl leading-none">
        {roi.point_count}
        <span className="text-xs text-zinc-500"> / {roi.threshold}</span>
      </strong>
      <div className="col-span-2 h-1.5 bg-zinc-800">
        <span
          className={
            roi.alarm
              ? 'block h-full bg-red-400'
              : 'block h-full bg-emerald-400'
          }
          style={{ width: `${ratio}%` }}
        />
      </div>
    </article>
  );
}

function AlarmStrip({
  alarm,
  receivedLabel,
  topic,
}: {
  alarm: MonitoringAlarm | null;
  receivedLabel: string;
  topic: string;
}) {
  const level = alarmColorLevel(alarm);
  return (
    <>
      {alarm?.alarm === true ? (
        <div
          className={
            level === 'red'
              ? 'pointer-events-none fixed inset-0 z-20 animate-pulse bg-red-500/30'
              : 'pointer-events-none fixed inset-0 z-20 animate-pulse bg-yellow-500/25'
          }
          aria-hidden="true"
        />
      ) : null}
      <section
        className={
          level === 'red'
            ? 'flex min-h-24 items-center justify-between gap-4 border border-l-8 border-red-500/70 bg-red-950/50 p-4'
            : level === 'yellow'
              ? 'flex min-h-24 items-center justify-between gap-4 border border-l-8 border-yellow-500/70 bg-yellow-950/40 p-4'
              : 'flex min-h-24 items-center justify-between gap-4 border border-l-8 border-emerald-500/40 bg-zinc-900 p-4'
        }
      >
        <div>
          <p className="text-xs font-bold tracking-widest text-zinc-400 uppercase">
            Alarm
          </p>
          <h2 className="text-3xl font-black">{alarmTitle(alarm)}</h2>
        </div>
        <div className="grid justify-items-end gap-1 text-right text-sm font-bold text-zinc-300">
          <span>{topic}</span>
          <span>{alarmDescription(alarm)}</span>
          <span>{receivedLabel}</span>
        </div>
      </section>
    </>
  );
}

function handleMessage(
  subscription: Subscription,
  message: MessageData,
  canvas: HTMLCanvasElement | null,
  setters: {
    setImageReceivedAt: (time: number) => void;
    setLidar: (state: TopicState<RoiAlarmArray>) => void;
    setLidarMarker: (state: TopicState<RoiMarkerArray>) => void;
    setLidarPoints: (state: TopicState<RosVector3[]>) => void;
    setAlarm: (state: TopicState<MonitoringAlarm>) => void;
  },
) {
  const receivedAt = timestampToMs(message.timestamp);
  const decoded = subscription.reader.readMessage(message.data);

  if (subscription.topic === TOPICS.camera) {
    drawImage(canvas, decoded as RosImage);
    setters.setImageReceivedAt(receivedAt);
    return;
  }

  if (subscription.topic === TOPICS.lidar) {
    setters.setLidar({ data: decoded as RoiAlarmArray, receivedAt });
    return;
  }

  if (subscription.topic === TOPICS.lidarMarker) {
    setters.setLidarMarker({ data: decoded as RoiMarkerArray, receivedAt });
    return;
  }

  if (subscription.topic === TOPICS.lidarPoints) {
    setters.setLidarPoints({
      data: pointCloudToPoints(decoded as RosPointCloud2),
      receivedAt,
    });
    return;
  }

  if (subscription.topic === TOPICS.alarms) {
    const text = (decoded as { data?: string }).data;
    if (text) {
      setters.setAlarm({
        data: JSON.parse(text) as MonitoringAlarm,
        receivedAt,
      });
    }
  }
}

function drawImage(canvas: HTMLCanvasElement | null, image: RosImage) {
  if (!canvas || image.width <= 0 || image.height <= 0) return;

  const context = canvas.getContext('2d');
  if (!context) return;

  const source =
    image.data instanceof Uint8Array ? image.data : Uint8Array.from(image.data);
  const rgba = new Uint8ClampedArray(image.width * image.height * 4);
  const encoding = image.encoding.toLowerCase();
  const channels =
    encoding.includes('rgba') || encoding.includes('bgra')
      ? 4
      : encoding.includes('mono')
        ? 1
        : 3;

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const sourceIndex = y * image.step + x * channels;
      const targetIndex = (y * image.width + x) * 4;
      const first = source[sourceIndex] ?? 0;
      const second = source[sourceIndex + 1] ?? first;
      const third = source[sourceIndex + 2] ?? first;
      const alpha = channels === 4 ? (source[sourceIndex + 3] ?? 255) : 255;

      rgba[targetIndex] = encoding.includes('bgr') ? third : first;
      rgba[targetIndex + 1] = second;
      rgba[targetIndex + 2] = encoding.includes('bgr') ? first : third;
      rgba[targetIndex + 3] = alpha;
    }
  }

  canvas.width = image.width;
  canvas.height = image.height;
  context.putImageData(new ImageData(rgba, image.width, image.height), 0, 0);
}

function rosToScenePoint(point: RosVector3): [number, number, number] {
  return [point.y, point.z, point.x];
}

function rosSizeToSceneSize(size: RosVector3): [number, number, number] {
  return [size.y, size.z, size.x];
}

function formatMeter(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function pointCloudToPoints(cloud: RosPointCloud2) {
  const x = cloud.fields.find((field) => field.name === 'x');
  const y = cloud.fields.find((field) => field.name === 'y');
  const z = cloud.fields.find((field) => field.name === 'z');
  if (!x || !y || !z || cloud.point_step <= 0) return [];

  const source =
    cloud.data instanceof Uint8Array ? cloud.data : Uint8Array.from(cloud.data);
  const view = new DataView(
    source.buffer,
    source.byteOffset,
    source.byteLength,
  );
  const littleEndian = !cloud.is_bigendian;
  const count = Math.min(
    cloud.width * cloud.height,
    Math.floor(source.length / cloud.point_step),
  );
  const points: RosVector3[] = [];

  for (let i = 0; i < count; i += 1) {
    const offset = i * cloud.point_step;
    const point = {
      x: readPointField(view, offset + x.offset, x.datatype, littleEndian),
      y: readPointField(view, offset + y.offset, y.datatype, littleEndian),
      z: readPointField(view, offset + z.offset, z.datatype, littleEndian),
    };
    if (
      Number.isFinite(point.x) &&
      Number.isFinite(point.y) &&
      Number.isFinite(point.z)
    ) {
      points.push(point);
    }
  }

  return points;
}

function readPointField(
  view: DataView,
  offset: number,
  datatype: number,
  littleEndian: boolean,
) {
  if (datatype === 7) return view.getFloat32(offset, littleEndian);
  if (datatype === 8) return view.getFloat64(offset, littleEndian);
  return NaN;
}

function isRequiredTopic(
  topic: string,
): topic is (typeof TOPICS)[keyof typeof TOPICS] {
  return Object.values(TOPICS).includes(
    topic as (typeof TOPICS)[keyof typeof TOPICS],
  );
}

function timestampToMs(timestamp: bigint) {
  return Number(timestamp / 1_000_000n);
}

function timeLabel(time: number | null) {
  return time == null
    ? '대기중'
    : new Date(time).toLocaleTimeString('ko-KR', { hour12: false });
}

function connectionLabel(connection: ConnectionState) {
  return {
    connecting: '연결 중',
    connected: '연결됨',
    closed: '연결 종료',
    error: '연결 오류',
  }[connection];
}

function alarmColorLevel(alarm: MonitoringAlarm | null) {
  if (alarm?.level === 'red' || alarm?.level === 'yellow') return alarm.level;
  return 'green';
}

function alarmTitle(alarm: MonitoringAlarm | null) {
  if (!alarm) return '알람 수신 대기';
  if (alarm.level === 'red') return '위험 감지';
  if (alarm.level === 'yellow') return '주의 감지';
  return '정상 감시 중';
}

function alarmDescription(alarm: MonitoringAlarm | null) {
  if (!alarm) return '최종 알람 이벤트가 아직 도착하지 않았습니다.';

  const labels = alarm.matched_detections
    .map((detection) => detection.label)
    .join(', ');
  const rois = alarm.active_rois.map((roi) => roi.name).join(', ');
  return [
    alarm.status,
    rois || 'active ROI 없음',
    labels || 'matching detection 없음',
  ].join(' · ');
}
