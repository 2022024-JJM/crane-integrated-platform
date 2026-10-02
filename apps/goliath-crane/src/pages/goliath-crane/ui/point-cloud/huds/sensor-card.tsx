import {
  type SensorBuffer,
  usePointCloudStreamStore,
} from '../../../model/point-cloud-stream-store';
import { STALE_SENSOR_MS } from '../../../lib/point-cloud/config';
import {
  formatRelativeTime,
  formatTransformValue,
} from '../formatters';

const TRANSFORM_AXES: ReadonlyArray<{
  group: 'position' | 'rotation';
  axis: 'x' | 'y' | 'z';
  label: string;
}> = [
  { group: 'position', axis: 'x', label: 'Pos X' },
  { group: 'position', axis: 'y', label: 'Pos Y' },
  { group: 'position', axis: 'z', label: 'Pos Z' },
  { group: 'rotation', axis: 'x', label: 'Rot X' },
  { group: 'rotation', axis: 'y', label: 'Rot Y' },
  { group: 'rotation', axis: 'z', label: 'Rot Z' },
];

interface SensorCardProps {
  sensorKey: string;
  sensor: SensorBuffer;
  now: number;
}

export function SensorCard({ sensorKey, sensor, now }: SensorCardProps) {
  const setSensorVisible = usePointCloudStreamStore((s) => s.setSensorVisible);
  const setSensorTransformAxis = usePointCloudStreamStore(
    (s) => s.setSensorTransformAxis,
  );
  const resetSensorTransform = usePointCloudStreamStore(
    (s) => s.resetSensorTransform,
  );

  const isStale =
    sensor.lastUpdatedAtMs > 0 &&
    now - sensor.lastUpdatedAtMs >= STALE_SENSOR_MS;
  const parsed = sensor.parsed;
  const healthLabel = !parsed
    ? 'Waiting'
    : !parsed.ok
      ? 'Parse error'
      : isStale
        ? 'Stale'
        : 'Live';
  const healthClass = !parsed
    ? 'text-white/40'
    : !parsed.ok
      ? 'text-rose-300'
      : isStale
        ? 'text-amber-300'
        : 'text-emerald-300';
  const rendered = parsed && parsed.ok ? parsed.sampledPointCount : 0;
  const raw = parsed && parsed.ok ? parsed.pointCount : 0;
  const hasIntensity = parsed && parsed.ok ? parsed.hasIntensity : false;
  const skipped = parsed && parsed.ok ? parsed.skippedPointCount : 0;
  const errorMessage = parsed && !parsed.ok ? parsed.error : '';

  return (
    <article
      className={`rounded-xl border bg-slate-900/60 px-3 py-3 ${
        errorMessage ? 'border-rose-400/30' : 'border-white/10'
      }`}
    >
      <label className="flex cursor-pointer items-center gap-2 text-[12px] font-bold text-white/90">
        <input
          type="checkbox"
          checked={sensor.isVisible}
          onChange={(e) => setSensorVisible(sensorKey, e.target.checked)}
          aria-label={`Toggle ${sensor.sensorName}`}
          className="size-3.5 cursor-pointer accent-cyan-400"
        />
        <span
          aria-hidden
          className="size-2.5 rounded-full"
          style={{
            background: sensor.colorHex,
            boxShadow: `0 0 10px ${sensor.colorHex}`,
          }}
        />
        <span className="flex-1 truncate">{sensor.sensorName}</span>
      </label>

      <div
        className={`mt-2 inline-flex rounded-full bg-white/5 px-2 py-0.5 text-[9px] font-bold tracking-[0.14em] uppercase ${healthClass}`}
      >
        {healthLabel}
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
        <SensorMetaRow label="Rendered" value={rendered.toLocaleString()} />
        <SensorMetaRow label="Raw" value={raw.toLocaleString()} />
        <SensorMetaRow label="Intensity" value={hasIntensity ? 'Yes' : 'No'} />
        <SensorMetaRow
          label="Age"
          value={formatRelativeTime(sensor.lastUpdatedAtMs)}
        />
        <SensorMetaRow label="Frame" value={sensor.frameId} />
        <SensorMetaRow label="Vendor" value={sensor.vendor} />
      </dl>

      <section className="mt-3 border-t border-white/5 pt-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[9px] tracking-[0.16em] text-white/40 uppercase">
            Transform
          </span>
          <button
            type="button"
            onClick={() => resetSensorTransform(sensorKey)}
            className="cursor-pointer rounded-full border border-white/15 bg-slate-900/70 px-2 py-0.5 text-[9px] font-bold tracking-[0.14em] text-white/60 uppercase transition hover:border-cyan-300 hover:text-cyan-200"
          >
            Reset
          </button>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {TRANSFORM_AXES.map(({ group, axis, label }) => (
            <label key={`${group}-${axis}`} className="flex flex-col gap-1">
              <span className="text-[9px] tracking-[0.12em] text-white/40 uppercase">
                {label}
              </span>
              <input
                type="number"
                step={0.1}
                value={formatTransformValue(sensor.transform[group][axis])}
                aria-label={`${sensor.sensorName} ${label}`}
                onChange={(e) => {
                  const next = Number.parseFloat(e.target.value);
                  if (!Number.isFinite(next)) return;
                  setSensorTransformAxis(sensorKey, group, axis, next);
                }}
                className="rounded-md border border-white/15 bg-slate-950/80 px-2 py-1 text-[11px] text-white/90 focus:border-cyan-400 focus:outline-none"
              />
            </label>
          ))}
        </div>
      </section>

      <p className="mt-3 truncate text-[10px] text-white/50">
        {sensor.sourceTopic}
      </p>

      {errorMessage ? (
        <p className="mt-2 text-[10px] text-rose-300">{errorMessage}</p>
      ) : skipped > 0 ? (
        <p className="mt-2 text-[10px] text-white/40">
          {skipped.toLocaleString()} points skipped during sampling or
          validation.
        </p>
      ) : null}
    </article>
  );
}

function SensorMetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[9px] tracking-[0.12em] text-white/40 uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 truncate font-bold text-white/85">{value}</dd>
    </div>
  );
}
