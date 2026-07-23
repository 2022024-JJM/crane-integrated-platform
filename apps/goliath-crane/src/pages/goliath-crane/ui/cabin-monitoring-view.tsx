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
import { Bell } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
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
  const bridgeUrl = useMemo(getCabinBridgeUrl, []);
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
  const [now, setNow] = useState(() => Date.now());
  const [alarmEvents, setAlarmEvents] = useState<AlarmEvent[]>([]);
  const [alarmStartedAt, setAlarmStartedAt] = useState<number | null>(null);
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
        if (level === 'red') toast.error(title, { description });
        else toast.warning(title, { description });
        if (!prevActive) setAlarmStartedAt(receivedAt);
        setAlarmEvents((events) =>
          [{ receivedAt, level, title, description }, ...events].slice(0, 100),
        );
        return;
      }

      if (current.alarm !== true && prevActive) {
        toast.success('정상 복귀', { description: current.status });
        setAlarmStartedAt(null);
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
        setImageReceivedAt,
        setLidar,
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

  const roiAlarms = lidar.data?.alarms ?? [];
  const roiMarkers = lidarMarker.data?.markers ?? [];
  const points = lidarPoints.data ?? [];
  const alarmLevel = alarmColorLevel(alarm.data);
  const alarmActive = alarm.data?.alarm === true;

  return (
    <main
      className={
        alarmActive
          ? 'bg-background text-foreground grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-4 p-4'
          : 'bg-background text-foreground grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4 p-4'
      }
    >
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
            ? 'flex items-center justify-between gap-4 border-b border-red-500/50 pb-3'
            : alarm.data?.alarm === true && alarmLevel === 'yellow'
              ? 'flex items-center justify-between gap-4 border-b border-amber-400/40 pb-3'
              : 'flex items-center justify-between gap-4 border-b pb-3'
        }
      >
        <div>
          <p className="text-muted-foreground font-mono text-[11px] font-semibold tracking-[0.2em] uppercase">
            Goliath Crane GC-04 · Cabin Watch
          </p>
          <h1 className="text-xl font-black tracking-tight">캐빈 안전 감시</h1>
        </div>
        <div className="flex items-center gap-3">
          <AlarmStatusChip alarm={alarm.data} />
          <AlarmHistoryButton events={alarmEvents} />
          <span className="bg-border h-6 w-px" aria-hidden="true" />
          <time className="font-mono text-lg font-bold tracking-tight tabular-nums">
            {timeLabel(now)}
          </time>
          <ConnectionBadge connection={connection} url={bridgeUrl} />
        </div>
      </header>

      {alarmActive ? (
        <AlarmBanner
          alarm={alarm.data}
          level={alarmLevel}
          now={now}
          startedAt={alarmStartedAt}
        />
      ) : null}

      <section
        className="grid min-h-0 grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4 max-lg:grid-cols-1"
        aria-label="실시간 모니터링"
      >
        <CameraPanel
          canvasRef={canvasRef}
          hasImage={imageReceivedAt != null}
          now={now}
          receivedAt={imageReceivedAt}
          topic={TOPICS.camera}
        />
        <LidarPanel
          markers={roiMarkers}
          now={now}
          pointCloudLabel={timeLabel(lidarPoints.receivedAt)}
          points={points}
          receivedAt={lidar.receivedAt}
          rois={roiAlarms}
          topic={TOPICS.lidar}
        />
      </section>
    </main>
  );
}

function AlarmBanner({
  alarm,
  level,
  now,
  startedAt,
}: {
  alarm: MonitoringAlarm | null;
  level: 'green' | 'yellow' | 'red';
  now: number;
  startedAt: number | null;
}) {
  const durationSeconds =
    startedAt == null ? null : Math.max(0, Math.floor((now - startedAt) / 1000));

  return (
    <section
      role="alert"
      className={
        level === 'red'
          ? 'flex min-h-16 items-center gap-4 rounded-xl border border-red-500/60 bg-red-500/15 px-5 py-3 shadow-[0_0_36px_-8px_rgba(239,68,68,0.6)]'
          : 'flex min-h-16 items-center gap-4 rounded-xl border border-amber-400/50 bg-amber-400/10 px-5 py-3 shadow-[0_0_36px_-10px_rgba(251,191,36,0.5)]'
      }
    >
      <span
        className={
          level === 'red'
            ? 'size-3 shrink-0 animate-pulse rounded-full bg-red-500 shadow-[0_0_12px_2px_rgba(239,68,68,0.9)] motion-reduce:animate-none'
            : 'size-3 shrink-0 animate-pulse rounded-full bg-amber-400 shadow-[0_0_12px_2px_rgba(251,191,36,0.8)] motion-reduce:animate-none'
        }
        aria-hidden="true"
      />
      <strong
        className={
          level === 'red'
            ? 'text-2xl font-black tracking-tight whitespace-nowrap text-red-600 dark:text-red-300'
            : 'text-2xl font-black tracking-tight whitespace-nowrap text-amber-600 dark:text-amber-200'
        }
      >
        {alarmTitle(alarm)}
      </strong>
      <span className="min-w-0 truncate text-sm font-semibold">
        {alarmDescription(alarm)}
      </span>
      {durationSeconds != null ? (
        <span className="text-muted-foreground ml-auto shrink-0 font-mono text-sm font-semibold tabular-nums">
          {durationSeconds}초 지속
        </span>
      ) : null}
    </section>
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
  return (
    <div
      className="bg-card flex items-center gap-2.5 rounded-full border py-1.5 pr-4 pl-3"
      title={url}
    >
      <span
        className={
          isConnected
            ? 'size-2 rounded-full bg-emerald-400 shadow-[0_0_8px_1px_rgba(52,211,153,0.8)]'
            : isError
              ? 'size-2 rounded-full bg-red-400 shadow-[0_0_8px_1px_rgba(248,113,113,0.8)]'
              : 'bg-muted-foreground size-2 animate-pulse rounded-full'
        }
      />
      <span className="text-sm font-bold whitespace-nowrap">
        {connectionLabel(connection)}
      </span>
      <span className="text-muted-foreground hidden font-mono text-[11px] whitespace-nowrap xl:inline">
        {url}
      </span>
    </div>
  );
}

function CameraPanel({
  canvasRef,
  hasImage,
  now,
  receivedAt,
  topic,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  hasImage: boolean;
  now: number;
  receivedAt: number | null;
  topic: string;
}) {
  return (
    <section className="bg-card grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-xl border p-4">
      <PanelHead
        kicker="Camera · Detection"
        title="객체 검출 영상"
        topic={topic}
        now={now}
        receivedAt={receivedAt}
      />
      <div className="relative grid min-h-0 place-items-center overflow-hidden rounded-lg bg-black">
        <canvas
          ref={canvasRef}
          className="h-full w-full object-contain"
          aria-label="객체 검출 카메라 영상"
        />
        <CornerBrackets />
        {hasImage ? (
          <span className="absolute top-3 left-3 flex items-center gap-1.5 rounded-md border border-slate-700/60 bg-black/70 px-2 py-1 font-mono text-[10px] font-bold tracking-[0.15em] text-red-300">
            <span className="size-1.5 animate-pulse rounded-full bg-red-500 shadow-[0_0_6px_1px_rgba(239,68,68,0.8)] motion-reduce:animate-none" />
            LIVE
          </span>
        ) : (
          <WaitingNotice label="영상 수신 대기중" />
        )}
      </div>
    </section>
  );
}

function CornerBrackets() {
  return (
    <div className="pointer-events-none absolute inset-2" aria-hidden="true">
      <span className="absolute top-0 left-0 h-4 w-4 border-t border-l border-sky-300/40" />
      <span className="absolute top-0 right-0 h-4 w-4 border-t border-r border-sky-300/40" />
      <span className="absolute bottom-0 left-0 h-4 w-4 border-b border-l border-sky-300/40" />
      <span className="absolute right-0 bottom-0 h-4 w-4 border-r border-b border-sky-300/40" />
    </div>
  );
}

function WaitingNotice({ label }: { label: string }) {
  return (
    <p className="absolute inset-0 grid place-items-center">
      <span className="flex items-center gap-2 rounded-full border border-slate-700/60 bg-black/60 px-4 py-1.5 font-mono text-xs font-semibold text-slate-400">
        <span className="size-1.5 animate-pulse rounded-full bg-slate-500 motion-reduce:animate-none" />
        {label}
      </span>
    </p>
  );
}

function LidarPanel({
  markers,
  now,
  pointCloudLabel,
  points,
  receivedAt,
  rois,
  topic,
}: {
  markers: RoiMarker[];
  now: number;
  pointCloudLabel: string;
  points: RosVector3[];
  receivedAt: number | null;
  rois: RoiAlarm[];
  topic: string;
}) {
  return (
    <section className="bg-card grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-xl border p-4">
      <PanelHead
        kicker="LiDAR · ROI"
        title="위험구역 포인트 감시"
        topic={topic}
        now={now}
        receivedAt={receivedAt}
      />
      <LidarCanvas
        markers={markers}
        pointCloudLabel={pointCloudLabel}
        points={points}
      />
      {rois.length > 0 ? (
        <div className="mt-3 grid max-h-56 grid-cols-2 gap-2 overflow-auto max-xl:grid-cols-1">
          {rois.map((roi) => (
            <RoiCard key={roi.name} roi={roi} />
          ))}
        </div>
      ) : null}
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
  const hasLidarData = markers.length > 0 || points.length > 0;

  return (
    <div className="relative min-h-0 overflow-hidden rounded-lg bg-[#04070d]">
      {hasLidarData ? (
        <>
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
            <OrbitControls
              makeDefault
              enableDamping={false}
              target={[0, 0, 0]}
            />
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
          <span
            className="pointer-events-none absolute inset-x-0 top-0 h-full animate-[lidar-sweep_5s_linear_infinite] border-t border-sky-300/50 bg-gradient-to-b from-sky-400/10 to-transparent to-15% motion-reduce:animate-none"
            aria-hidden="true"
          />
        </>
      ) : null}
      <CornerBrackets />
      <span className="absolute top-3 left-3 rounded-md border border-slate-700/60 bg-black/70 px-2 py-1 font-mono text-xs font-semibold text-sky-200/90 tabular-nums">
        PCD {pointCloudLabel} · {points.length.toLocaleString()} pts
      </span>
      {!hasLidarData ? <WaitingNotice label="ROI/PCD 수신 대기중" /> : null}
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
  const sceneSize = useMemo(
    () => rosSizeToSceneSize({ x: scaleX, y: scaleY, z: scaleZ }),
    [scaleX, scaleY, scaleZ],
  );
  const geometry = useMemo(() => {
    const box = new THREE.BoxGeometry(...sceneSize);
    return new THREE.EdgesGeometry(box);
  }, [sceneSize]);
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

function PanelHead({
  kicker,
  title,
  topic,
  now,
  receivedAt,
}: {
  kicker: string;
  title: string;
  topic: string;
  now: number;
  receivedAt: number | null;
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-muted-foreground font-mono text-[10px] font-semibold tracking-[0.18em] uppercase">
          {kicker}
        </p>
        <h2 className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-base font-extrabold">{title}</span>
          <code className="text-muted-foreground/70 truncate font-mono text-[11px]">
            {topic}
          </code>
        </h2>
      </div>
      <StatusPill now={now} receivedAt={receivedAt} />
    </div>
  );
}

const STALE_AFTER_MS = 5000;

function isStale(receivedAt: number | null, now: number) {
  return receivedAt != null && now - receivedAt > STALE_AFTER_MS;
}

function staleLabel(receivedAt: number, now: number) {
  return `${Math.floor((now - receivedAt) / 1000)}초 전`;
}

function StatusPill({
  now,
  receivedAt,
}: {
  now: number;
  receivedAt: number | null;
}) {
  const stale = isStale(receivedAt, now);
  return (
    <span
      className={
        receivedAt == null
          ? 'bg-muted text-muted-foreground flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-xs font-semibold whitespace-nowrap'
          : stale
            ? 'flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-1 font-mono text-xs font-semibold whitespace-nowrap text-amber-600 tabular-nums dark:text-amber-300'
            : 'flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-mono text-xs font-semibold whitespace-nowrap text-emerald-600 tabular-nums dark:text-emerald-300'
      }
    >
      <span
        className={
          receivedAt == null
            ? 'bg-muted-foreground/60 size-1.5 rounded-full'
            : stale
              ? 'size-1.5 rounded-full bg-amber-400'
              : 'size-1.5 rounded-full bg-emerald-400'
        }
      />
      {receivedAt == null
        ? '대기중'
        : stale
          ? staleLabel(receivedAt, now)
          : timeLabel(receivedAt)}
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
          ? 'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-lg border border-red-500/50 bg-red-500/10 p-3 shadow-[0_0_18px_-6px_rgba(239,68,68,0.5)]'
          : 'bg-muted/40 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-lg border p-3'
      }
    >
      <div className="min-w-0">
        <h3 className="truncate text-base font-bold">{roi.name}</h3>
        <p
          className={
            roi.alarm
              ? 'font-mono text-[11px] font-bold tracking-[0.15em] text-red-600 dark:text-red-300'
              : 'font-mono text-[11px] font-bold tracking-[0.15em] text-emerald-600 dark:text-emerald-400/90'
          }
        >
          {roi.alarm ? 'ALARM' : 'NORMAL'}
        </p>
      </div>
      <strong className="font-mono text-2xl leading-none font-bold tabular-nums">
        {roi.point_count}
        <span className="text-muted-foreground text-sm font-semibold">
          {' '}
          / {roi.threshold}
        </span>
      </strong>
      <div className="bg-muted col-span-2 h-1.5 overflow-hidden rounded-full">
        <span
          className={
            roi.alarm
              ? 'block h-full rounded-full bg-red-400'
              : 'block h-full rounded-full bg-emerald-400'
          }
          style={{ width: `${ratio}%` }}
        />
      </div>
    </article>
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
