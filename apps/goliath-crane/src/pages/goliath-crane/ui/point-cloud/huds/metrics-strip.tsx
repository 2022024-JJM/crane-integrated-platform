import type {
  BundleMeta,
  PointCloudConnectionStatus,
} from '../../../model/point-cloud-stream-store';
import { formatBigInt, formatRelativeTime } from '../formatters';
import { CONNECTION_PILL_CLASS, STATUS_LABEL } from './status-labels';

interface MetricsStripProps {
  status: PointCloudConnectionStatus;
  bundle: BundleMeta;
  lastError: string;
  onRefit: () => void;
}

export function MetricsStrip({
  status,
  bundle,
  lastError,
  onRefit,
}: MetricsStripProps) {
  const metrics: Array<[string, string]> = [
    ['Sequence', formatBigInt(bundle.lastSequence)],
    [
      'Drop Gap',
      bundle.lastGap > 0n ? `${formatBigInt(bundle.lastGap)} dropped` : 'None',
    ],
    ['Processor', bundle.processorName],
    ['Rendered Points', formatBigInt(BigInt(bundle.totalRenderedPoints))],
    [
      'Bundle Window',
      bundle.windowSizeMs ? `${bundle.windowSizeMs} ms` : 'n/a',
    ],
    ['Decode Error', lastError || 'None'],
  ];

  return (
    <div className="absolute top-4 right-4 flex max-w-[68vw] flex-col items-end gap-3">
      <div className="pointer-events-auto flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full border bg-slate-900/70 px-3 py-1.5 text-[10px] font-bold tracking-[0.18em] uppercase backdrop-blur ${CONNECTION_PILL_CLASS[status]}`}
        >
          {STATUS_LABEL[status]}
        </span>
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 px-3 py-2 text-[10px] backdrop-blur">
          <div className="tracking-[0.16em] text-white/40 uppercase">
            Last Receive
          </div>
          <div className="mt-0.5 text-[12px] font-bold text-white/90">
            {formatRelativeTime(bundle.lastBundleAtMs)}
          </div>
        </div>
        <button
          type="button"
          onClick={onRefit}
          aria-label="Refit View"
          className="cursor-pointer rounded-full border border-cyan-400/40 bg-cyan-500/10 px-3 py-1.5 text-[10px] font-bold tracking-[0.18em] text-cyan-200 uppercase backdrop-blur transition hover:border-cyan-300 hover:bg-cyan-500/20"
        >
          Refit View
        </button>
      </div>

      <div className="pointer-events-auto grid w-[min(40vw,520px)] grid-cols-3 gap-2">
        {metrics.map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 backdrop-blur"
          >
            <div className="text-[9px] tracking-[0.14em] text-white/40 uppercase">
              {label}
            </div>
            <div className="mt-0.5 truncate text-[11px] font-bold text-white/90">
              {value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
