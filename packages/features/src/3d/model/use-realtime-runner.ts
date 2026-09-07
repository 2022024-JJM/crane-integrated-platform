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
 * `held`(충돌 정지·기록 복원) 중에는 drain 만 하고 내보내지 않는다 — 버퍼가
 * 보류 동안 무한히 쌓이지 않고, 풀리면 다음 수신 값부터 반영된다.
 *
 * 이 컴포넌트는 R3F Canvas 안에서만 사용해야 한다.
 */
export function useRealtimeRunner() {
  const isRunning = useRealtimeStore((s) => s.isRunning);

  useFrame(() => {
    if (!isRunning) return;

    const store = useRealtimeStore.getState();
    const entries = store.drainBuffer();
    if (entries.length === 0 || store.held) return;

    for (const { key, value } of entries) {
      publishTagValue(key, value);
    }
  });
}
