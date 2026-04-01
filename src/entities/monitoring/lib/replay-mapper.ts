import { getMonitoringTagMetadata } from '../model/tag-catalog';
import type {
  MonitoringReplayRow,
  ReplayLiteCraneSnapshot,
  ReplayLiteFrame,
  ReplayLiteResponse,
} from '../model/types';

function mapReplayValueToRow(
  frameTimestamp: string,
  crane: ReplayLiteCraneSnapshot,
  tagCode: string,
  value: string | number | null,
): MonitoringReplayRow {
  const metadata = getMonitoringTagMetadata(tagCode);

  return {
    id: `${frameTimestamp}:${crane.craneId}:${tagCode}`,
    frameTimestamp,
    snapshotAt: crane.snapshotAt,
    craneId: crane.craneId,
    craneNo: crane.craneNo,
    tagCode,
    displayName: metadata.displayName,
    category: metadata.category,
    dataType: metadata.dataType,
    unit: metadata.unit,
    direction: metadata.direction,
    value,
    alarm: metadata.alarm,
    stale: value === null,
    changed: false,
  };
}

function compareRows(left: MonitoringReplayRow, right: MonitoringReplayRow) {
  return (
    left.craneNo.localeCompare(right.craneNo, undefined, { numeric: true }) ||
    left.tagCode.localeCompare(right.tagCode, undefined, { numeric: true })
  );
}

function hasReplayValue(crane: ReplayLiteCraneSnapshot) {
  return Object.values(crane.values).some((value) => value !== null);
}

function filterCraneSnapshots(
  frame: ReplayLiteFrame,
  craneIds?: string[],
) {
  const craneFilter =
    craneIds && craneIds.length > 0 ? new Set(craneIds) : null;

  return frame.cranes.filter((crane) => !craneFilter || craneFilter.has(crane.craneId));
}

export function getLatestReplayFrame(
  response: ReplayLiteResponse,
): ReplayLiteFrame | null {
  if (response.frames.length === 0) {
    return null;
  }

  return [...response.frames].sort((left, right) =>
    right.timestamp.localeCompare(left.timestamp),
  )[0]!;
}

export function getLatestReplayFrameWithValues(
  response: ReplayLiteResponse,
  craneIds?: string[],
): ReplayLiteFrame | null {
  const sortedFrames = [...response.frames].sort((left, right) =>
    right.timestamp.localeCompare(left.timestamp),
  );

  return (
    sortedFrames.find((frame) =>
      filterCraneSnapshots(frame, craneIds).some((crane) => hasReplayValue(crane)),
    ) ?? getLatestReplayFrame(response)
  );
}

function getPreviousHeartbeatValues(
  response: ReplayLiteResponse,
  latestFrame: ReplayLiteFrame,
  craneIds?: string[],
): Map<string, string | number | null> {
  const sortedFrames = [...response.frames].sort((left, right) =>
    right.timestamp.localeCompare(left.timestamp),
  );

  const previousFrame = sortedFrames.find(
    (frame) =>
      frame.timestamp < latestFrame.timestamp &&
      filterCraneSnapshots(frame, craneIds).some((crane) => hasReplayValue(crane)),
  );

  if (!previousFrame) {
    return new Map();
  }

  const result = new Map<string, string | number | null>();
  for (const crane of filterCraneSnapshots(previousFrame, craneIds)) {
    if ('heartbeat' in crane.values) {
      result.set(crane.craneId, crane.values['heartbeat'] ?? null);
    }
  }

  return result;
}

export function mapReplayResponseToRows(
  response: ReplayLiteResponse,
  craneIds?: string[],
): MonitoringReplayRow[] {
  const latestFrame = getLatestReplayFrameWithValues(response, craneIds);

  if (!latestFrame) {
    return [];
  }

  const previousHeartbeats = getPreviousHeartbeatValues(response, latestFrame, craneIds);

  return filterCraneSnapshots(latestFrame, craneIds)
    .flatMap<MonitoringReplayRow>((crane) =>
      Object.entries(crane.values).map(([tagCode, value]) => {
        const row = mapReplayValueToRow(latestFrame.timestamp, crane, tagCode, value);

        if (tagCode === 'heartbeat' && value !== null) {
          const previousValue = previousHeartbeats.get(crane.craneId);
          if (previousValue !== undefined && String(previousValue) === String(value)) {
            return { ...row, stale: true };
          }
        }

        return row;
      }),
    )
    .sort(compareRows);
}
