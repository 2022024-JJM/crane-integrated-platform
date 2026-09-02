import { useFrame } from '@react-three/fiber';
import { useRealtimeStore } from './use-realtime-store';
import { publishTagValue } from './tag-value-bus';

/**
 * 실시간 WebSocket 값을 R3F 렌더 루프(useFrame)에 동기화한다.
 *
 * useRealtimeWebSocketBridge가 수신한 값을 useRealtimeStore 버퍼에 쌓고,
 * 이 runner가 매 프레임 버퍼를 drain하여 태그 값 버스로 내보낸다. 버스 →
 * 태그 바인딩 소스 → 값 저장소 → 드라이버 순으로 노드에 닿는다.
 *
 * 이 컴포넌트는 R3F Canvas 안에서만 사용해야 한다.
 */
export function useRealtimeRunner() {
  const isRunning = useRealtimeStore((s) => s.isRunning);

  useFrame(() => {
    if (!isRunning) return;

    const entries = useRealtimeStore.getState().drainBuffer();
    if (entries.length === 0) return;

    for (const { key, value } of entries) {
      publishTagValue(key, value);
    }
  });
}
