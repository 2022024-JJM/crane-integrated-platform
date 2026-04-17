import { useEffect, useEffectEvent, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { WebSocketConnectionState } from '@crane/core/ws';
import {
  getMonitoringTags,
  isRealtimeCraneLiteMessage,
  selectMonitoringLiveTableColumns,
  type MonitoringLiveCell,
  type MonitoringLiveCrane,
  type MonitoringLiveTableDisplayColumn,
  type MonitoringLiveRow,
} from '@crane/domain/monitoring';
import { cranesLiteWebSocketClient } from '@crane/core/ws';

interface UseMonitoringLiveTableParams {
  cranes: MonitoringLiveCrane[];
  tagDefinitionIds?: number[];
  regionId: string;
}

interface MonitoringLiveRowState {
  lastUpdated: string | null;
  values: Partial<Record<string, MonitoringLiveCell>>;
}

const MONITORING_DISCONNECT_TIMEOUT_MS = 10 * 60 * 1_000;
const MONITORING_CONNECTION_CHECK_INTERVAL_MS = 30_000;

export type MonitoringRealtimeBadgeState =
  | 'connected'
  | 'connecting'
  | 'closed';

export function useMonitoringLiveTable({
  cranes,
  tagDefinitionIds,
  regionId,
}: UseMonitoringLiveTableParams) {
  const [rowStateByCraneId, setRowStateByCraneId] = useState<
    Record<string, MonitoringLiveRowState>
  >({});
  const [connectionState, setConnectionState] =
    useState<WebSocketConnectionState>(() =>
      cranesLiteWebSocketClient.getState(),
    );
  const [lastActivityAtMs, setLastActivityAtMs] = useState<number | null>(() =>
    cranesLiteWebSocketClient.getState() === 'open' ? Date.now() : null,
  );
  const [nowMs, setNowMs] = useState(() => Date.now());

  const tagsQuery = useQuery({
    queryKey: ['monitoring', 'tags'],
    queryFn: getMonitoringTags,
    staleTime: 5 * 60 * 1000,
  });

  const columns = useMemo<MonitoringLiveTableDisplayColumn[]>(
    () =>
      selectMonitoringLiveTableColumns(
        tagsQuery.data ?? [],
        regionId,
        tagDefinitionIds,
      ),
    [regionId, tagDefinitionIds, tagsQuery.data],
  );

  const allowedCraneIds = useMemo(
    () => new Set(cranes.map((crane) => crane.craneId)),
    [cranes],
  );

  const rows = useMemo<MonitoringLiveRow[]>(
    () =>
      cranes.map((crane) => {
        const rowState = rowStateByCraneId[crane.craneId];

        return {
          craneId: crane.craneId,
          craneNo: crane.craneNo,
          craneName: crane.craneName,
          lastUpdated: rowState?.lastUpdated ?? null,
          values: rowState?.values ?? {},
        };
      }),
    [cranes, rowStateByCraneId],
  );

  const handleMessage = useEffectEvent((payload: unknown) => {
    if (!isRealtimeCraneLiteMessage(payload)) {
      return;
    }

    setLastActivityAtMs(Date.now());

    if (!allowedCraneIds.has(payload.craneId)) {
      return;
    }

    setRowStateByCraneId((currentState) => {
      const currentRow = currentState[payload.craneId];
      const nextUpdatedAt =
        currentRow?.lastUpdated &&
        currentRow.lastUpdated.localeCompare(payload.timestamp) > 0
          ? currentRow.lastUpdated
          : payload.timestamp;

      return {
        ...currentState,
        [payload.craneId]: {
          lastUpdated: nextUpdatedAt,
          values: {
            ...(currentRow?.values ?? {}),
            [payload.tagCode]: {
              value: payload.value,
              timestamp: payload.timestamp,
              occurredAt: payload.occurredAt,
              quality: payload.quality,
              changed: payload.changed,
            },
          },
        },
      };
    });
  });

  const realtimeBadgeState = useMemo<MonitoringRealtimeBadgeState>(() => {
    switch (connectionState) {
      case 'open': {
        if (
          lastActivityAtMs !== null &&
          nowMs - lastActivityAtMs < MONITORING_DISCONNECT_TIMEOUT_MS
        ) {
          return 'connected';
        }

        return 'closed';
      }
      case 'connecting':
        return 'connecting';
      case 'closing':
      case 'closed':
      case 'idle':
      default:
        return 'closed';
    }
  }, [connectionState, lastActivityAtMs, nowMs]);

  useEffect(() => {
    const unsubscribeState = cranesLiteWebSocketClient.subscribeState(
      (state) => {
        setConnectionState(state);

        if (state === 'open') {
          setLastActivityAtMs(Date.now());
          return;
        }

        setLastActivityAtMs(null);
      },
    );
    const unsubscribeMessages = cranesLiteWebSocketClient.subscribeAll(
      (message) => {
        handleMessage(message.payload);
      },
    );

    cranesLiteWebSocketClient.connect();

    return () => {
      unsubscribeMessages();
      unsubscribeState();
      cranesLiteWebSocketClient.disconnect();
    };
  }, []);

  useEffect(() => {
    setNowMs(Date.now());

    if (connectionState !== 'open') {
      return;
    }

    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, MONITORING_CONNECTION_CHECK_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [connectionState]);

  return {
    columns,
    rows,
    connectionState,
    realtimeBadgeState,
    isMetaLoading: tagsQuery.isLoading,
    isError: tagsQuery.isError,
    errorMessage:
      tagsQuery.error instanceof Error
        ? tagsQuery.error.message
        : tagsQuery.error
          ? String(tagsQuery.error)
          : null,
    isEmpty: cranes.length === 0 || columns.length === 0,
  };
}
