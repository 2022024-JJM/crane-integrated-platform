// Fusion 풀스크린 전용 HUD. monitoring_web/src/main.js 와 동등한 정보를
// 모두 제공한다 (Connection / Endpoint / Last Receive / Refit / 메트릭 그리드
// / 센서 카드(toggle/메타/Transform/Reset)).
//
// store mutation 은 set 을 통과하지 않는 in-place 패턴이므로 React 가 자동
// 리렌더하지 않는다. 그러나 store 가 한 bundle 당 한 번 globalFrameCounter 를
// +1 시켜주므로, subscribe 만 하면 매 bundle 마다 React 가 리렌더된다.
// 추가로 "Age" 표시(초/분) 가 메시지 사이에도 흘러가야 하므로 1Hz tick 만 유지.

import { useEffect, useMemo, useState } from 'react';
import {
  usePointCloudStreamStore,
  type PointCloudConnectionStatus,
} from '../../../model/point-cloud-stream-store';
import { STALE_SENSOR_MS } from '../../../lib/point-cloud/config';
import { MetricsStrip } from './metrics-strip';
import { SensorCard } from './sensor-card';

interface FusionHudProps {
  status: PointCloudConnectionStatus;
  onRefit: () => void;
}

export function FusionHud({ status, onRefit }: FusionHudProps) {
  // 1Hz tick — Age / Last Receive 같은 시간 기반 표시가 메시지 사이에도
  // 흘러가도록. 500ms 였던 이전 값에서 1초로 낮춤 (시각적 차이 없음).
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const [panelOpen, setPanelOpen] = useState(true);

  // 한 번에 reactive 한 값 셋만 subscribe — frameCounter 가 +1 될 때 한 컴포넌트
  // 만 리렌더된다.
  const lastError = usePointCloudStreamStore((s) => s.lastError);
  const frameCounter = usePointCloudStreamStore((s) => s.globalFrameCounter);
  const sensors = usePointCloudStreamStore.getState().sensors;
  const bundle = usePointCloudStreamStore.getState().bundle;

  // sensors Map 은 in-place mutate 되므로 frameCounter 변경 시 entries 를 재평가.
  const sensorEntries = useMemo(
    () =>
      Array.from(sensors.entries()).sort(([a], [b]) => a.localeCompare(b)),
    [sensors, frameCounter],
  );

  const now = Date.now();
  const activeCount = sensorEntries.filter(
    ([, s]) => now - s.lastUpdatedAtMs < STALE_SENSOR_MS,
  ).length;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 font-mono text-cyan-100">
      <MetricsStrip
        status={status}
        bundle={bundle}
        lastError={lastError}
        onRefit={onRefit}
      />

      <aside
        className={`pointer-events-auto absolute top-4 bottom-4 left-4 z-0 flex flex-col rounded-2xl border border-white/10 bg-slate-950/80 shadow-2xl transition-[width] ${
          panelOpen ? 'w-[min(420px,calc(100vw-32px))]' : 'w-50'
        }`}
      >
        <header className="flex items-center justify-between border-b border-white/5 px-4 py-3">
          <div>
            <div className="text-[9px] tracking-[0.16em] text-white/40 uppercase">
              Sensors
            </div>
            <div className="mt-0.5 text-[12px] font-bold text-white/90">
              {activeCount} active
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPanelOpen((v) => !v)}
            className="cursor-pointer rounded-full border border-white/15 bg-slate-900/70 px-2.5 py-1 text-[9px] font-bold tracking-[0.16em] text-white/70 uppercase transition hover:border-cyan-300 hover:text-cyan-200"
          >
            {panelOpen ? 'Collapse' : 'Expand'}
          </button>
        </header>

        {panelOpen && (
          <div className="flex-1 overflow-auto px-3 py-3">
            {sensorEntries.length === 0 ? (
              <p className="rounded-xl border border-dashed border-white/10 bg-slate-900/40 px-4 py-6 text-center text-[11px] text-white/40">
                No sensor frames received yet.
              </p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {sensorEntries.map(([key, sensor]) => (
                  <SensorCard
                    key={key}
                    sensorKey={key}
                    sensor={sensor}
                    now={now}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
