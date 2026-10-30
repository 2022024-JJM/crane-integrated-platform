import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import {
  createRealtimeCadenceTracker,
  type RealtimeCadenceTracker,
} from '../lib/realtime-smoothing';
import { useRealtimeStore } from './use-realtime-store';
import {
  publishTagNull,
  publishTagValue,
  type TagPublishOptions,
} from './tag-value-bus';

/** 모든 publish 가 싣는 소스 — 버스 게이트가 실시간 화면에서만 통과시킨다. */
const REALTIME_SOURCE: TagPublishOptions = { source: 'realtime' };

/**
 * 실시간 WebSocket 값을 R3F 렌더 루프(useFrame)에 동기화한다.
 *
 * useCraneSnapshotRealtimeBridge 가 스냅샷에서 꺼낸 값을 useRealtimeStore 버퍼에 쌓고,
 * 이 runner가 매 프레임 버퍼를 drain하여 태그 값 버스로 내보낸다. 버스 →
 * 태그 바인딩 소스 → 값 저장소 → 드라이버 순으로 노드에 닿는다.
 *
 * `held`(충돌 정지·기록 복원) 중에는 drain 만 하고 내보내지 않는다 — 버퍼가
 * 보류 동안 무한히 쌓이지 않고, 풀리면 다음 수신 값부터 반영된다. 버린 값은
 * 간격 측정에도 들어가지 않는다. 값 없음(null)은 `publishTagNull` 로 내보내고
 * 간격 측정에 넣지 않는다 — 값이 아니라 수신 사실만 남긴다.
 *
 * publish 스무딩 시간은 **키별 값 변화 간격**이다(lib/realtime-smoothing.ts) —
 * 1초마다 바뀌는 값은 1초 동안 미끄러져 다음 값에 닿고, 첫 값은 소비자 기본,
 * 바뀌지 않은 재발행은 마지막 스무딩 시간을 이어받는다. 한 프레임의 항목은
 * 같은 시각으로 잰다. 시작·정지 때 간격 표를 비운다.
 *
 * 이 컴포넌트는 R3F Canvas 안에서만 사용해야 한다.
 */
export function useRealtimeRunner() {
  const isRunning = useRealtimeStore((s) => s.isRunning);
  const cadenceRef = useRef<RealtimeCadenceTracker | null>(null);

  // 시작·정지 때 비운다 — 이전 세션(끊김 전·다른 모드)의 변경 시각이 새 세션
  // 첫 변화의 간격에 섞이지 않게.
  useEffect(() => {
    cadenceRef.current?.clear();
  }, [isRunning]);

  useFrame(() => {
    if (!isRunning) return;

    const store = useRealtimeStore.getState();
    const entries = store.drainBuffer();
    if (entries.length === 0 || store.held) return;

    const cadence = (cadenceRef.current ??= createRealtimeCadenceTracker());
    const now = performance.now();
    for (const { key, value } of entries) {
      if (value === null) {
        publishTagNull(key, REALTIME_SOURCE);
        continue;
      }
      const smoothTime = cadence.observe(key, value, now);
      if (smoothTime === undefined) {
        publishTagValue(key, value, REALTIME_SOURCE);
      } else {
        publishTagValue(key, value, { smoothTime, source: 'realtime' });
      }
    }
  });
}
