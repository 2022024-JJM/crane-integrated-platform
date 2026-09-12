import { useSyncExternalStore } from 'react';
import { cranesLiteWebSocketClient } from '@crane/core/ws';
import type { WebSocketConnectionState } from '@crane/core/ws';
import { useRealtimeStore } from './use-realtime-store';
import { useVirtualTagStore } from './use-virtual-tag-store';

export type SceneConnectionMode = 'simulation' | 'realtime' | 'replay';

/**
 * 관제 HUD "연결" 칸의 상태 키와 색조. 키는 i18n `monitoring:hud.linkState.*`
 * 에 그대로 대응한다.
 * - simulation: 가상 태그 러너 재생 여부(simulationRunning / simulationPaused)
 * - realtime: cranes-lite WebSocket 연결 상태(open·connecting·closed…)에
 *   화면 반영 보류(held)를 덧입힌다 — 연결돼 있어도 보류 중이면 그걸 보여야
 *   "값이 안 오는 게 서버 탓인지 정지 탓인지" 를 HUD 에서 구분한다.
 * - replay: 항상 replay.
 */
export interface SceneConnectionView {
  state:
    | 'simulationRunning'
    | 'simulationPaused'
    | 'open'
    | 'connecting'
    | 'closed'
    | 'held'
    | 'replay';
  tone: 'good' | 'warn' | 'bad' | 'muted';
}

export function resolveConnectionView(
  mode: SceneConnectionMode,
  socket: WebSocketConnectionState,
  held: boolean,
  simulationRunning: boolean,
): SceneConnectionView {
  if (mode === 'replay') return { state: 'replay', tone: 'muted' };
  if (mode === 'simulation') {
    return simulationRunning
      ? { state: 'simulationRunning', tone: 'good' }
      : { state: 'simulationPaused', tone: 'muted' };
  }
  if (held) return { state: 'held', tone: 'warn' };
  switch (socket) {
    case 'open':
      return { state: 'open', tone: 'good' };
    case 'connecting':
      return { state: 'connecting', tone: 'warn' };
    default:
      return { state: 'closed', tone: 'bad' };
  }
}

function subscribeSocket(onChange: () => void): () => void {
  return cranesLiteWebSocketClient.subscribeState(() => onChange());
}

function readSocket(): WebSocketConnectionState {
  return cranesLiteWebSocketClient.getState();
}

/**
 * 연결 칸 상태 — WebSocket 상태는 useSyncExternalStore 로(effect 안 setState
 * 없이), 실시간 보류·가상 태그 재생은 각 스토어 구독으로 모아 바뀔 때만
 * 리렌더한다.
 */
export function useRealtimeConnectionState(
  mode: SceneConnectionMode,
): SceneConnectionView {
  const socket = useSyncExternalStore(subscribeSocket, readSocket, readSocket);
  const held = useRealtimeStore((s) => s.held);
  const simulationRunning = useVirtualTagStore((s) => s.isRunning);
  return resolveConnectionView(mode, socket, held, simulationRunning);
}
