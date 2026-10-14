import { getCraneById } from '../../shared';
import type {
  MonitoringReplayLiteQuery,
  OperationIntervalResponse,
  PlaybackFrameResponse,
  PlaybackSiteResponse,
  ReplayLiteCraneSnapshot,
  ReplayLiteFrame,
  ReplayLiteResponse,
  ReplayLiteValue,
  ReplayLiteValueMap,
  ReplayTagSchema,
  ReplayTagSchemaItem,
} from '../model/types';

interface NormalizedPlaybackStream {
  craneId: string;
  craneNo: string;
  tagSchema: ReplayTagSchema | null;
  timeline: OperationIntervalResponse[];
  events: PlaybackEvent[];
}

interface PlaybackEvent {
  order: number;
  time: string;
  values: ReplayLiteValueMap;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeReplayValue(value: unknown): ReplayLiteValue {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number' || typeof value === 'string') {
    return value;
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  return String(value);
}

function normalizeValueMap(value: unknown): ReplayLiteValueMap {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [
      key,
      normalizeReplayValue(entryValue),
    ]),
  );
}

function normalizeTagSchemaItem(value: unknown): ReplayTagSchemaItem | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    displayName:
      typeof value.displayName === 'string' ? value.displayName : '',
    category: typeof value.category === 'string' ? value.category : 'status',
    dataType: typeof value.dataType === 'string' ? value.dataType : null,
    unit: typeof value.unit === 'string' ? value.unit : null,
    alarm: Boolean(value.alarm),
    slot: typeof value.slot === 'number' ? value.slot : null,
  };
}

function normalizeTagSchema(value: unknown): ReplayTagSchema | null {
  if (!isRecord(value)) {
    return null;
  }

  const entries = Object.entries(value)
    .map(([tagCode, item]) => [tagCode, normalizeTagSchemaItem(item)] as const)
    .filter((entry): entry is [string, ReplayTagSchemaItem] => entry[1] !== null);

  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

function normalizePlaybackFrame(value: unknown): PlaybackFrameResponse | null {
  if (!isRecord(value) || typeof value.time !== 'string') {
    return null;
  }

  return {
    time: value.time,
    values: isRecord(value.values) ? value.values : {},
  };
}

function normalizeTimeline(value: unknown): OperationIntervalResponse[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (
      !isRecord(entry) ||
      typeof entry.onAt !== 'string' ||
      typeof entry.offAt !== 'string'
    ) {
      return [];
    }

    return [{ onAt: entry.onAt, offAt: entry.offAt }];
  });
}

function normalizePlaybackStream(
  value: unknown,
  orderSeed: number,
): NormalizedPlaybackStream | null {
  if (!isRecord(value) || typeof value.craneId !== 'string') {
    return null;
  }

  const crane = getCraneById(value.craneId);
  const baseline = normalizePlaybackFrame(value.baseline);
  const frames = Array.isArray(value.frames)
    ? value.frames
        .map((frame) => normalizePlaybackFrame(frame))
        .filter((frame): frame is PlaybackFrameResponse => frame !== null)
    : [];

  const events: PlaybackEvent[] = [];

  if (baseline) {
    events.push({
      order: orderSeed,
      time: baseline.time,
      values: normalizeValueMap(baseline.values),
    });
  }

  frames.forEach((frame, index) => {
    events.push({
      order: orderSeed + index + 1,
      time: frame.time,
      values: normalizeValueMap(frame.values),
    });
  });

  return {
    craneId: value.craneId,
    craneNo: crane?.craneNo ?? value.craneId,
    tagSchema: normalizeTagSchema(value.tagSchema),
    timeline: normalizeTimeline(value.timeline),
    events,
  };
}

function buildReplayFrames(streams: NormalizedPlaybackStream[]): ReplayLiteFrame[] {
  const currentStates = new Map<string, ReplayLiteValueMap>();
  const currentSnapshotAt = new Map<string, string | null>();
  const allEvents = streams
    .flatMap((stream) =>
      stream.events.map((event) => ({
        ...event,
        craneId: stream.craneId,
      })),
    )
    .sort(
      (left, right) =>
        left.time.localeCompare(right.time) || left.order - right.order,
    );

  const frames: ReplayLiteFrame[] = [];
  let eventIndex = 0;

  while (eventIndex < allEvents.length) {
    const timestamp = allEvents[eventIndex]!.time;

    while (
      eventIndex < allEvents.length &&
      allEvents[eventIndex]!.time === timestamp
    ) {
      const event = allEvents[eventIndex]!;
      const previousValues = currentStates.get(event.craneId) ?? {};
      currentStates.set(event.craneId, {
        ...previousValues,
        ...event.values,
      });
      currentSnapshotAt.set(event.craneId, timestamp);
      eventIndex += 1;
    }

    const cranes = streams.flatMap<ReplayLiteCraneSnapshot>((stream) => {
      const values = currentStates.get(stream.craneId);

      if (!values) {
        return [];
      }

      return [
        {
          craneId: stream.craneId,
          craneNo: stream.craneNo,
          snapshotAt: currentSnapshotAt.get(stream.craneId) ?? timestamp,
          tagSchema: stream.tagSchema,
          values: { ...values },
        },
      ];
    });

    if (cranes.length > 0) {
      frames.push({
        timestamp,
        cranes,
      });
    }
  }

  return frames;
}

export function normalizePlaybackResponse(
  response: PlaybackSiteResponse | unknown,
  query: Pick<MonitoringReplayLiteQuery, 'from' | 'to'>,
): ReplayLiteResponse {
  if (!Array.isArray(response)) {
    return {
      from: query.from,
      to: query.to,
      craneIds: [],
      frames: [],
    };
  }

  const streams = response
    .map((entry, index) => normalizePlaybackStream(entry, index * 10_000))
    .filter((stream): stream is NormalizedPlaybackStream => stream !== null);

  return {
    from: query.from,
    to: query.to,
    craneIds: streams.map((stream) => stream.craneId),
    frames: buildReplayFrames(streams),
  };
}
