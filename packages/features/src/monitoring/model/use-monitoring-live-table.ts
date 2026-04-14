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
import { monitoringWebSocketClient } from './monitoring-websocket-client';

interface UseMonitoringLiveTableParams {
  cranes: MonitoringLiveCrane[];
  tagDefinitionIds?: number[];
  regionId: string;
}

interface MonitoringLiveRowState {
  lastUpdated: string | null;
  values: Partial<Record<string, MonitoringLiveCell>>;
}

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
      monitoringWebSocketClient.getState(),
    );

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

  useEffect(() => {
    const unsubscribeState =
      monitoringWebSocketClient.subscribeState(setConnectionState);
    const unsubscribeMessages = monitoringWebSocketClient.subscribeAll(
      (message) => {
        handleMessage(message.payload);
      },
    );

    monitoringWebSocketClient.connect();

    return () => {
      unsubscribeMessages();
      unsubscribeState();
      monitoringWebSocketClient.disconnect();
    };
  }, []);

  return {
    columns,
    rows,
    connectionState,
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
