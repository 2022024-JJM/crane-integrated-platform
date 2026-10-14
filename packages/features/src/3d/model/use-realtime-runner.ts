import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { resolveRealtimeSmoothTime } from '../lib/realtime-smoothing';
import { useRealtimeStore } from './use-realtime-store';
import { publishTagValue, type TagPublishOptions } from './tag-value-bus';

/**
 * 실시간 WebSocket 값을 R3F 렌더 루프(useFrame)에 동기화한다.
 *
 * useRealtimeWebSocketBridge가 수신한 값을 useRealtimeStore 버퍼(키당
 * 최신값 Map)에 쌓고, 이 runner가 매 프레임 버퍼를 drain하여 태그 값
 * 버스로 내보낸다. 버스 → 태그 바인딩 소스 → 값 저장소 → 드라이버 순으로
 * 노드에 닿는다. 한 프레임에 같은 키가 여러 번 왔어도 publish 는 한 번이다.
 *
 * `held`(충돌 정지·기록 복원) 중에는 drain 만 하고 내보내지 않는다 — 버퍼가
 * 보류 동안 무한히 쌓이지 않고, 풀리면 다음 수신 값부터 반영된다.
 *
 * 스무딩 시간은 **키별 수신 간격**이다(lib/realtime-smoothing.ts) — 1초마다
 * 오는 값은 1초 동안 미끄러져 다음 값에 닿고, 첫 값은 소비자 기본. 간격은
 * 이 러너가 그 키를 마지막으로 내보낸 시각 기준이라 보류·정지 뒤 첫 값은
 * 상한으로 잘린다. 시작·정지 때 시각 표를 비운다.
 *
 * 이 컴포넌트는 R3F Canvas 안에서만 사용해야 한다.
 */
export function useRealtimeRunner() {
  const isRunning = useRealtimeStore((s) => s.isRunning);
  const lastPublishAtRef = useRef(new Map<string, number>());
  // publish 옵션 객체는 재사용한다 — 초당 수백 publish 에서 할당을 피한다.
  const optionsRef = useRef<TagPublishOptions>({ smoothTime: undefined });

  useEffect(() => {
    lastPublishAtRef.current.clear();
  }, [isRunning]);

  useFrame(() => {
    if (!isRunning) return;

    const store = useRealtimeStore.getState();
    const entries = store.drainBuffer();
    if (entries.size === 0 || store.held) return;

    const now = performance.now();
    const lastAt = lastPublishAtRef.current;
    const options = optionsRef.current;
    for (const [key, value] of entries) {
      const last = lastAt.get(key);
      lastAt.set(key, now);
      const smoothTime = resolveRealtimeSmoothTime(
        last === undefined ? undefined : now - last,
      );
      if (smoothTime === undefined) {
        publishTagValue(key, value);
      } else {
        options.smoothTime = smoothTime;
        publishTagValue(key, value, options);
      }
    }
  });
}
