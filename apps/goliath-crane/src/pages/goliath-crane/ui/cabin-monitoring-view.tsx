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
import { Canvas, useThree } from '@react-three/fiber';
import {
  Popover,
  PopoverPopup,
  PopoverTrigger,
} from '@crane/ui/molecules/popover';
import { Bell, LoaderCircle, Wifi, WifiOff } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

const BRIDGE_SUBPROTOCOL = 'foxglove.sdk.v1';
const TOPICS = {
  camera: '/detections/image',
  lidarMarker: '/lidar/roi_marker',
  lidarPoints: '/lidar/points_preprocessed',
  alarms: '/monitoring/alarms',
} as const;

const LIDAR_VIEW = {
  range: 50,
  fov: (Math.PI * 140) / 180,
  initialRange: 18,
};
const MAX_POINT_CLOUD_POINTS = 12000;
const EMPTY_POINT_CLOUD = new Float32Array(0);

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

type AlarmEvent = {
  receivedAt: number;
  level: 'green' | 'yellow' | 'red';
  title: string;
  description: string;
};

type Subscription = {
  topic: string;
  reader: MessageReader;
};

function toWebSocketUrl(value: string) {
  if (/^wss?:\/\//i.test(value)) return value;
  if (/^https?:\/\//i.test(value)) {
    return value.replace(/^http/i, 'ws');
  }

  const origin =
    window.location.protocol === 'https:'
      ? `wss://${window.location.host}`
      : `ws://${window.location.host}`;
  return `${origin}/${value.replace(/^\/+/, '')}`;
}

function getCabinBridgeUrl() {
  const url = import.meta.env.VITE_CABIN_BRIDGE_URL;
  return toWebSocketUrl(url || `ws://${window.location.hostname}:8765`);
}

export function CabinMonitoringView({ regionId }: { regionId: string }) {
  return <CabinMonitoringViewContent key={regionId} />;
}

function CabinMonitoringViewContent() {
  const bridgeUrl = useMemo(() => getCabinBridgeUrl(), []);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const subscriptionsRef = useRef(new Map<SubscriptionId, Subscription>());
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [lidarMarker, setLidarMarker] = useState<TopicState<RoiMarkerArray>>({
    data: null,
    receivedAt: null,
  });
  const [lidarPoints, setLidarPoints] = useState<TopicState<Float32Array>>({
    data: null,
    receivedAt: null,
  });
  const [alarm, setAlarm] = useState<TopicState<MonitoringAlarm>>({
    data: null,
    receivedAt: null,
  });
  const [now, setNow] = useState(() => Date.now());
  const [alarmEvents, setAlarmEvents] = useState<AlarmEvent[]>([]);
  const prevAlarmRef = useRef<MonitoringAlarm | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const ws = new WebSocket(bridgeUrl, [BRIDGE_SUBPROTOCOL]);
    const client = new FoxgloveClient({ ws: ws as unknown as IWebSocket });
    const subscriptions = subscriptionsRef.current;

    const handleAlarmUpdate = (state: TopicState<MonitoringAlarm>) => {
      setAlarm(state);

      const current = state.data;
      if (!current) return;

      const prev = prevAlarmRef.current;
      prevAlarmRef.current = current;

      const level = alarmColorLevel(current);
      const prevActive = prev?.alarm === true;
      const prevLevel = prev ? alarmColorLevel(prev) : null;
      const receivedAt = state.receivedAt ?? Date.now();

      if (current.alarm === true && (!prevActive || prevLevel !== level)) {
        const title = alarmTitle(current);
        const description = alarmDescription(current);
        setAlarmEvents((events) =>
          [{ receivedAt, level, title, description }, ...events].slice(0, 100),
        );
        return;
      }

      if (current.alarm !== true && prevActive) {
        setAlarmEvents((events) =>
          [
            {
              receivedAt,
              level: 'green' as const,
              title: '정상 복귀',
              description: current.status,
            },
            ...events,
          ].slice(0, 100),
        );
      }
    };

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
        setLidarMarker,
        setLidarPoints,
        setAlarm: handleAlarmUpdate,
      });
    });

    return () => {
      client.close();
      subscriptions.clear();
    };
  }, [bridgeUrl]);

  const roiMarkers = lidarMarker.data?.markers ?? [];
  const points = lidarPoints.data ?? EMPTY_POINT_CLOUD;
  const alarmLevel = alarmColorLevel(alarm.data);

  return (
    <main className="bg-background text-foreground grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4 p-4">
      {alarm.data?.alarm === true ? (
        <div
          className={
            alarmLevel === 'red'
              ? 'pointer-events-none fixed inset-0 z-20 animate-pulse shadow-[inset_0_0_140px_36px_rgba(239,68,68,0.45)] motion-reduce:animate-none'
              : 'pointer-events-none fixed inset-0 z-20 animate-pulse shadow-[inset_0_0_140px_36px_rgba(251,191,36,0.35)] motion-reduce:animate-none'
          }
          aria-hidden="true"
        />
      ) : null}
      <header
        className={
          alarm.data?.alarm === true && alarmLevel === 'red'
            ? 'flex items-center justify-between gap-3 border-b border-red-500/50 pb-2'
            : alarm.data?.alarm === true && alarmLevel === 'yellow'
              ? 'flex items-center justify-between gap-3 border-b border-amber-400/40 pb-2'
              : 'flex items-center justify-between gap-3 border-b pb-2'
        }
      >
        <AlarmStatusChip alarm={alarm.data} />
        <div className="flex items-center gap-3">
          <time className="font-mono text-lg font-bold tracking-tight tabular-nums">
            {timeLabel(now)}
          </time>
          <ConnectionBadge connection={connection} url={bridgeUrl} />
          <AlarmHistoryButton events={alarmEvents} />
        </div>
      </header>

      <section
        className="grid min-h-0 grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 max-lg:grid-cols-1"
        aria-label="실시간 모니터링"
      >
        <CameraPanel canvasRef={canvasRef} />
        <LidarPanel
          markers={roiMarkers}
          points={points}
        />
      </section>
    </main>
  );
}

function AlarmStatusChip({ alarm }: { alarm: MonitoringAlarm | null }) {
  const level = alarmColorLevel(alarm);
  const waiting = alarm == null;
  return (
    <div
      className={
        waiting
          ? 'bg-card/60 flex items-center gap-2 rounded-full border border-dashed py-1.5 pr-3.5 pl-2'
          : level === 'red'
            ? 'flex items-center gap-2 rounded-full border border-red-500/50 bg-red-500/10 py-1.5 pr-3.5 pl-2 shadow-[0_0_18px_-4px_rgba(239,68,68,0.6)]'
            : level === 'yellow'
              ? 'flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/10 py-1.5 pr-3.5 pl-2'
              : 'flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 py-1.5 pr-3.5 pl-2'
      }
    >
      <StackLight level={level} waiting={waiting} />
      <span
        className={
          waiting
            ? 'text-muted-foreground text-sm font-bold whitespace-nowrap'
            : level === 'red'
              ? 'text-sm font-bold whitespace-nowrap text-red-600 dark:text-red-300'
              : level === 'yellow'
                ? 'text-sm font-bold whitespace-nowrap text-amber-600 dark:text-amber-200'
                : 'text-sm font-bold whitespace-nowrap text-emerald-600 dark:text-emerald-200'
        }
      >
        {alarmTitle(alarm)}
      </span>
    </div>
  );
}

function AlarmHistoryButton({ events }: { events: AlarmEvent[] }) {
  return (
    <Popover>
      <PopoverTrigger className="bg-card hover:bg-muted relative grid size-9 place-items-center rounded-full border transition-colors">
        <Bell className="size-4" aria-hidden="true" />
        {events.length > 0 ? (
          <span className="absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 font-mono text-[10px] leading-none font-bold text-white tabular-nums">
            {events.length > 99 ? '99+' : events.length}
          </span>
        ) : null}
        <span className="sr-only">알람 이력</span>
      </PopoverTrigger>
      <PopoverPopup className="w-96 p-0">
        <div className="flex items-baseline justify-between border-b px-4 py-3">
          <p className="text-sm font-bold">알람 이력</p>
          <span className="text-muted-foreground font-mono text-xs tabular-nums">
            {events.length}건
          </span>
        </div>
        {events.length === 0 ? (
          <p className="text-muted-foreground px-4 py-10 text-center font-mono text-xs">
            알람 이력 없음
          </p>
        ) : (
          <ul className="grid max-h-96 gap-0.5 overflow-y-auto p-2">
            {events.map((event, index) => (
              <li
                key={`${event.receivedAt}-${index}`}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2.5 rounded-md px-2 py-2"
              >
                <span
                  className={
                    event.level === 'red'
                      ? 'mt-1.5 size-2 rounded-full bg-red-500'
                      : event.level === 'yellow'
                        ? 'mt-1.5 size-2 rounded-full bg-amber-400'
                        : 'mt-1.5 size-2 rounded-full bg-emerald-400'
                  }
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{event.title}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {event.description}
                  </p>
                </div>
                <time className="text-muted-foreground mt-0.5 font-mono text-[11px] tabular-nums">
                  {timeLabel(event.receivedAt)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </PopoverPopup>
    </Popover>
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
  const Icon = isConnected ? Wifi : isError ? WifiOff : LoaderCircle;

  return (
    <Popover>
      <PopoverTrigger
        className={
          isConnected
            ? 'bg-card hover:bg-muted grid size-9 place-items-center rounded-full border text-emerald-500 transition-colors'
            : isError
              ? 'bg-card hover:bg-muted grid size-9 place-items-center rounded-full border text-red-500 transition-colors'
              : 'bg-card hover:bg-muted text-muted-foreground grid size-9 place-items-center rounded-full border transition-colors'
        }
        title={url}
      >
        <Icon
          className={connection === 'connecting' ? 'size-4 animate-spin' : 'size-4'}
          aria-hidden="true"
        />
        <span className="sr-only">웹소켓 연결 정보</span>
      </PopoverTrigger>
      <PopoverPopup className="w-80 p-0">
        <div className="grid gap-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-bold">웹소켓 연결</p>
            <span
              className={
                isConnected
                  ? 'rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-300'
                  : isError
                    ? 'rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-xs font-bold text-red-600 dark:text-red-300'
                    : 'text-muted-foreground rounded-full border px-2 py-0.5 text-xs font-bold'
              }
            >
              {connectionLabel(connection)}
            </span>
          </div>
          <p className="text-muted-foreground break-all font-mono text-xs">
            {url}
          </p>
        </div>
      </PopoverPopup>
    </Popover>
  );
}

function CameraPanel({
  canvasRef,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}) {
  return (
    <section className="bg-card min-h-0 overflow-hidden rounded-xl border">
      <div className="grid h-full min-h-0 place-items-center overflow-hidden bg-black">
        <canvas
          ref={canvasRef}
          className="h-full w-full object-contain"
          aria-label="객체 검출 카메라 영상"
        />
      </div>
    </section>
  );
}

function LidarPanel({
  markers,
  points,
}: {
  markers: RoiMarker[];
  points: Float32Array;
}) {
  return (
    <section className="bg-card min-h-0 overflow-hidden rounded-xl border">
      <LidarCanvas markers={markers} points={points} />
    </section>
  );
}

function LidarCanvas({
  markers,
  points,
}: {
  markers: RoiMarker[];
  points: Float32Array;
}) {
  const pointCount = points.length / 3;

  return (
    <div className="relative h-full min-h-0 overflow-hidden bg-[#04070d]">
      <Canvas
        orthographic
        camera={{
          position: [0, 10, 0],
          rotation: [-Math.PI / 2, 0, 0],
          up: [0, 0, 1],
          zoom: 20,
        }}
      >
        <FitCamera markers={markers} />
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
      <span className="absolute top-3 right-3 rounded-md border border-slate-700/60 bg-black/70 px-2 py-1 font-mono text-xs font-semibold text-sky-200/90 tabular-nums">
        {pointCount.toLocaleString()} pts
      </span>
    </div>
  );
}

function FitCamera({ markers }: { markers: RoiMarker[] }) {
  const getThree = useThree((state) => state.get);
  const size = useThree((state) => state.size);
  const hasControls = useThree((state) => state.controls != null);

  // 위험구역(ROI) + 원점 기준으로 화면 맞춤. 같은 ROI가 계속 재수신되는 동안에는
  // 키가 변하지 않으므로 사용자의 수동 줌/이동을 덮어쓰지 않는다.
  const boundsKey = useMemo(() => {
    let minX = 0;
    let maxX = 0;
    let minZ = 0;
    let maxZ = 0;

    if (markers.length === 0) {
      const range = LIDAR_VIEW.initialRange;
      const halfWidth = Math.sin(LIDAR_VIEW.fov / 2) * range;
      minX = -halfWidth;
      maxX = halfWidth;
      maxZ = range;
    } else {
      for (const marker of markers) {
        const { position } = marker.pose;
        const { scale } = marker;
        minX = Math.min(minX, position.y - scale.y / 2);
        maxX = Math.max(maxX, position.y + scale.y / 2);
        minZ = Math.min(minZ, position.x - scale.x / 2);
        maxZ = Math.max(maxZ, position.x + scale.x / 2);
      }
      const padX = Math.max((maxX - minX) * 0.15, 2);
      const padZ = Math.max((maxZ - minZ) * 0.15, 2);
      minX -= padX;
      maxX += padX;
      minZ -= padZ;
      maxZ += padZ;
    }

    return [minX, maxX, minZ, maxZ]
      .map((value) => value.toFixed(1))
      .join(':');
  }, [markers]);

  useEffect(() => {
    const [minX, maxX, minZ, maxZ] = boundsKey.split(':').map(Number);
    const width = Math.max(maxX - minX, 1);
    const depth = Math.max(maxZ - minZ, 1);
    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;

    const { camera, controls } = getThree();
    camera.zoom = Math.min(size.width / width, size.height / depth) * 0.9;
    camera.position.set(centerX, camera.position.y, centerZ);
    camera.updateProjectionMatrix();

    const orbit = controls as unknown as {
      target: THREE.Vector3;
      update: () => void;
    } | null;
    if (orbit) {
      orbit.target.set(centerX, 0, centerZ);
      orbit.update();
    }
  }, [boundsKey, size.width, size.height, getThree, hasControls]);

  return null;
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

  useEffect(
    () => () => {
      geometries.edge.dispose();
      for (const geometry of geometries.rings) {
        geometry.dispose();
      }
    },
    [geometries],
  );

  return (
    <group>
      <lineSegments geometry={geometries.edge}>
        <lineBasicMaterial color="#7dd3fc" transparent opacity={0.85} />
      </lineSegments>
      {geometries.rings.map((geometry, index) => (
        <group key={index}>
          <lineSegments geometry={geometry}>
            <lineBasicMaterial color="#4d94c4" transparent opacity={0.75} />
          </lineSegments>
          <Html position={guidePoint(0, (index + 1) * 10)} center>
            <span className="rounded border border-sky-900/80 bg-black/70 px-1.5 py-0.5 font-mono text-[10px] font-semibold whitespace-nowrap text-sky-200">
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

  useEffect(() => () => heading.dispose(), [heading]);

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

function PointCloud({ points }: { points: Float32Array }) {
  const geometry = useMemo(() => {
    return new THREE.BufferGeometry().setAttribute(
      'position',
      new THREE.BufferAttribute(points, 3),
    );
  }, [points]);

  useEffect(() => () => geometry.dispose(), [geometry]);

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
  const sceneSize = useMemo(
    () => rosSizeToSceneSize({ x: scaleX, y: scaleY, z: scaleZ }),
    [scaleX, scaleY, scaleZ],
  );
  const geometry = useMemo(() => {
    const box = new THREE.BoxGeometry(...sceneSize);
    const edges = new THREE.EdgesGeometry(box);
    box.dispose();
    return edges;
  }, [sceneSize]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const color = useMemo(
    () => new THREE.Color(marker.color.r, marker.color.g, marker.color.b),
    [marker.color.b, marker.color.g, marker.color.r],
  );
  const edgeColor = useMemo(
    () => color.clone().lerp(new THREE.Color('#ffffff'), 0.35),
    [color],
  );

  return (
    <group position={rosToScenePoint(position)}>
      <mesh>
        <boxGeometry args={sceneSize} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.14}
          depthWrite={false}
        />
      </mesh>
      <lineSegments geometry={geometry}>
        <lineBasicMaterial color={edgeColor} />
      </lineSegments>
      <Html position={[0, scaleZ / 2 + 0.12, 0]} center>
        <span className="rounded border border-slate-600/80 bg-black/75 px-1.5 py-0.5 font-mono text-[10px] font-semibold whitespace-nowrap text-slate-100 tabular-nums">
          x {formatMeter(position.x - scaleX / 2)}-
          {formatMeter(position.x + scaleX / 2)}m · 폭 {formatMeter(scaleY)}m
        </span>
      </Html>
    </group>
  );
}

function StackLight({
  level,
  waiting,
}: {
  level: 'green' | 'yellow' | 'red';
  waiting: boolean;
}) {
  const lamps = [
    {
      key: 'red',
      active: !waiting && level === 'red',
      on: 'bg-red-500 shadow-[0_0_14px_2px_rgba(239,68,68,0.85)] animate-pulse motion-reduce:animate-none',
      off: 'bg-red-500/15',
    },
    {
      key: 'yellow',
      active: !waiting && level === 'yellow',
      on: 'bg-amber-400 shadow-[0_0_14px_2px_rgba(251,191,36,0.75)]',
      off: 'bg-amber-400/15',
    },
    {
      key: 'green',
      active: !waiting && level === 'green',
      on: 'bg-emerald-400 shadow-[0_0_14px_2px_rgba(52,211,153,0.75)]',
      off: 'bg-emerald-400/15',
    },
  ];

  return (
    <div
      className="bg-muted/50 grid shrink-0 gap-0.5 rounded-md border p-1"
      aria-hidden="true"
    >
      {lamps.map((lamp) => (
        <span
          key={lamp.key}
          className={`h-1.5 w-2.5 rounded-[2px] ${lamp.active ? lamp.on : lamp.off}`}
        />
      ))}
    </div>
  );
}

function handleMessage(
  subscription: Subscription,
  message: MessageData,
  canvas: HTMLCanvasElement | null,
  setters: {
    setLidarMarker: (state: TopicState<RoiMarkerArray>) => void;
    setLidarPoints: (state: TopicState<Float32Array>) => void;
    setAlarm: (state: TopicState<MonitoringAlarm>) => void;
  },
) {
  const receivedAt = timestampToMs(message.timestamp);
  const decoded = subscription.reader.readMessage(message.data);

  if (subscription.topic === TOPICS.camera) {
    drawImage(canvas, decoded as RosImage);
    return;
  }

  if (subscription.topic === TOPICS.lidarMarker) {
    setters.setLidarMarker({ data: decoded as RoiMarkerArray, receivedAt });
    return;
  }

  if (subscription.topic === TOPICS.lidarPoints) {
    setters.setLidarPoints({
      data: pointCloudToScenePositions(decoded as RosPointCloud2),
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

  if (canvas.width !== image.width) canvas.width = image.width;
  if (canvas.height !== image.height) canvas.height = image.height;
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

function pointCloudToScenePositions(cloud: RosPointCloud2) {
  const x = cloud.fields.find((field) => field.name === 'x');
  const y = cloud.fields.find((field) => field.name === 'y');
  const z = cloud.fields.find((field) => field.name === 'z');
  if (!x || !y || !z || cloud.point_step <= 0) return new Float32Array(0);

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
  const step = Math.max(1, Math.ceil(count / MAX_POINT_CLOUD_POINTS));
  const positions = new Float32Array(Math.ceil(count / step) * 3);
  let positionOffset = 0;

  for (let i = 0; i < count; i += step) {
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
      positions[positionOffset] = point.y;
      positions[positionOffset + 1] = point.z;
      positions[positionOffset + 2] = point.x;
      positionOffset += 3;
    }
  }

  return positions.length === positionOffset
    ? positions
    : positions.slice(0, positionOffset);
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

function alarmColorLevel(
  alarm: MonitoringAlarm | null,
): 'green' | 'yellow' | 'red' {
  if (alarm?.level === 'red') return 'red';
  if (alarm?.level === 'yellow') return 'yellow';
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
