import { useEffect, useState } from 'react';
import { cn } from '@crane/core/lib/utils';
import { formatPerfLine } from '../lib/perf-stats';
import {
  isScenePerfHudEnabled,
  scenePerfStore,
} from '../model/scene-perf-store';

/**
 * dev 전용 3D 성능 HUD — 캔버스 좌하단 한 줄 오버레이.
 * `154 calls · 2.50M tris · 16.7ms (worst 41) · 512MB`
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

export function ScenePerfHud({ className }: { className?: string }) {
  const enabled = isScenePerfHudEnabled();
  const [line, setLine] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => {
      setLine(formatPerfLine(scenePerfStore.read()));
    }, HUD_POLL_MS);
    return () => clearInterval(timer);
  }, [enabled]);

  if (!enabled || line === null) return null;

  return (
    <div
      title="gl.info 실측 — shadow pass 는 빠지고(r183 은 shadow pass 뒤 info.reset) 바다 미러 패스는 더해져 정적 리포트(scene-perf-report)와 다르다. 끄기: localStorage 'crane:perf-hud' 제거 후 새로고침"
      className={cn(
        'pointer-events-none absolute bottom-3 left-3 z-10 rounded bg-black/60 px-2 py-1 font-mono text-xs leading-none text-white/90 tabular-nums',
        className,
      )}
    >
      {line}
    </div>
  );
}
