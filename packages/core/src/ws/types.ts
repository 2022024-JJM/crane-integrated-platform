export type WebSocketConnectionState =
  | 'idle'
  | 'connecting'
  | 'open'
  | 'closed';

export type WebSocketStateListener = (state: WebSocketConnectionState) => void;
