import { useEffect, useState } from 'react';
import { cn } from '@crane/core/lib/utils';
import { cranesLiteIngestClient } from '@crane/domain/monitoring';
import {
  formatIngestLine,
  formatPerfLine,
  type IngestLineSample,
} from '../lib/perf-stats';
import {
  isScenePerfHudEnabled,
  scenePerfStore,
} from '../model/scene-perf-store';

/**
 * dev 전용 3D 성능 HUD — 캔버스 좌하단 오버레이.
 * `154 calls · 2.50M tris · 16.7ms (worst 41) · 512MB`
 * 실시간 수신이 있으면 둘째 줄 `rx 27.1k/s · drop 99% · worker 34%` —
 * 수신 Worker 가 받은 메시지/초, 관심 밖이라 버린 비율, Worker 사용률
 * (cranesLiteIngestClient.getStats, 수치 계산은 lib/perf-stats).
 *
 * 켜는 법: dev 서버에서 콘솔 `localStorage.setItem('crane:perf-hud','1')` 후
 * 새로고침 (조건 판정은 model/scene-perf-store 의 isScenePerfHudEnabled).
 *
 * 값은 ScenePerfProbe 가 useFrame 에서 scenePerfStore 에 기록한 것을 500ms
 * 주기로 폴링해 setState 한다 — 초당 React 커밋 2회는 무해하고, 프레임
 * 속도의 커밋(useFrame 내 setState)은 금지 규약이다. 수치→문자열 변환은
 * 전부 lib/perf-stats 가 한다(ui 수치 계산 금지).
 *
 * calls/tris 는 gl.info 실측 — three(r183)는 shadow pass **뒤에**
 * info.reset() 을 하므로 그림자 드로우콜은 빠지고, 바다 미러 패스(OceanWater
 * 가 중첩 render 동안 info.autoReset 을 꺼 둔다)는 더해진다. 정적 리포트
 * (scripts/scene-perf-report.mjs)와 다르게 나오는 것이 정상이다. title
 * 속성에도 같은 안내를 둔다.
 */
const HUD_POLL_MS = 500;
/**
 * 수신 통계 창 — 폴링 4회(2초). 실서버·시뮬레이터는 1초마다 한 번에 쏟아
 * 보내므로 0.5초 창으로 나누면 한 번은 2배, 다음은 0 으로 요동친다.
 */
const INGEST_WINDOW_POLLS = 4;

export function ScenePerfHud({ className }: { className?: string }) {
  const enabled = isScenePerfHudEnabled();
  const [line, setLine] = useState<string | null>(null);
  const [ingestLine, setIngestLine] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const history: Array<{ sample: IngestLineSample; at: number }> = [
      {
        sample: { ...cranesLiteIngestClient.getStats() },
        at: performance.now(),
      },
    ];
    const timer = setInterval(() => {
      setLine(formatPerfLine(scenePerfStore.read()));
      const next = {
        sample: { ...cranesLiteIngestClient.getStats() } as IngestLineSample,
        at: performance.now(),
      };
      history.push(next);
      if (history.length > INGEST_WINDOW_POLLS + 1) history.shift();
      const oldest = history[0]!;
      setIngestLine(
        formatIngestLine(oldest.sample, next.sample, next.at - oldest.at),
      );
    }, HUD_POLL_MS);
    return () => clearInterval(timer);
  }, [enabled]);

  if (!enabled || line === null) return null;

  return (
    <div
      title="gl.info 실측 — shadow pass 는 빠지고(r183 은 shadow pass 뒤 info.reset) 바다 미러 패스는 더해져 정적 리포트(scene-perf-report)와 다르다. 끄기: localStorage 'crane:perf-hud' 제거 후 새로고침"
      className={cn(
        'pointer-events-none absolute bottom-1.5 left-1.5 z-10 flex flex-col gap-0.5 rounded bg-black/60 px-2 py-1 font-mono text-xs leading-none text-white/90 tabular-nums',
        className,
      )}
    >
      <span>{line}</span>
      {ingestLine ? <span data-perf-ingest>{ingestLine}</span> : null}
    </div>
  );
}
