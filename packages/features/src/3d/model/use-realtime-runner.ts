import { useFrame } from '@react-three/fiber';
import { useRealtimeStore } from './use-realtime-store';
import { useValueMapperStore } from './use-value-mapper-store';

/**
 * 실시간 WebSocket 값을 R3F 렌더 루프(useFrame)에 동기화한다.
 *
 * useRealtimeWebSocketBridge가 수신한 값을 useRealtimeStore 버퍼에 쌓고,
 * 이 runner가 매 프레임 버퍼를 drain하여 useValueMapperStore.applyValue()를 호출한다.
 * Object3D를 직접 mutate하므로 React 리렌더가 발생하지 않는다.
 *
 * 이 컴포넌트는 R3F Canvas 안에서만 사용해야 한다.
 */
export function useRealtimeRunner() {
  const isRunning = useRealtimeStore((s) => s.isRunning);

  useFrame(() => {
    if (!isRunning) return;

    const entries = useRealtimeStore.getState().drainBuffer();
    if (entries.length === 0) return;

    const applyValue = useValueMapperStore.getState().applyValue;
    for (const { key, value } of entries) {
      applyValue(key, value);
    }
  });
}
