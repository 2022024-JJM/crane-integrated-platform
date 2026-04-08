import { useEffect, useRef, useState } from 'react';

export type LidarConnectionStatus = 'connecting' | 'open' | 'closed' | 'error';

interface UseLidarWebSocketResult {
  status: LidarConnectionStatus;
  dataRef: React.MutableRefObject<Float32Array | null>;
  frameRef: React.MutableRefObject<number>;
}

const RECONNECT_DELAY_MS = 3_000;

export function useLidarWebSocket(url: string): UseLidarWebSocketResult {
  const [status, setStatus] = useState<LidarConnectionStatus>('connecting');

  // React state 대신 ref로 데이터 보관 — 리렌더 없이 최신 프레임 유지
  const dataRef = useRef<Float32Array | null>(null);
  // 새 프레임이 왔음을 useFrame에서 감지하기 위한 카운터
  const frameRef = useRef(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);

  useEffect(() => {
    unmountedRef.current = false;

    function connect() {
      if (unmountedRef.current) return;

      setStatus('connecting');
      const ws = new WebSocket(url);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => {
        if (unmountedRef.current) return;
        setStatus('open');
      };

      ws.onmessage = (event: MessageEvent<ArrayBuffer>) => {
        if (unmountedRef.current) return;
        if (event.data instanceof ArrayBuffer) {
          // 복사 없이 view만 생성
          dataRef.current = new Float32Array(event.data);
          frameRef.current += 1;
        }
      };

      ws.onerror = () => {
        if (unmountedRef.current) return;
        setStatus('error');
      };

      ws.onclose = () => {
        if (unmountedRef.current) return;
        setStatus('closed');
        wsRef.current = null;
        reconnectTimerRef.current = setTimeout(connect, RECONNECT_DELAY_MS);
      };
    }

    connect();

    return () => {
      unmountedRef.current = true;
      if (reconnectTimerRef.current !== null) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [url]);

  return { status, dataRef, frameRef };
}
