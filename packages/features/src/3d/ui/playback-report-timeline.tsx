import { useTranslation } from 'react-i18next';
import { cn } from '@crane/core/lib/utils';
import {
  PLAYBACK_STATUS_FILL,
  markerPercent,
  msAtFraction,
  timelineTicks,
} from '../lib/playback-format';
import type {
  HoldBand,
  PlaybackEvent,
  ScannedInterval,
  StatusBand,
  ZoneBand,
} from '../lib/playback-stats';
import { formatSimClock } from '../lib/sim-clock';

/**
 * 스윔레인 타임라인 — 행마다 대상(사건 행·장비·영역), 시간 축 위 밴드,
 * 현재 위치 세로선, 클릭 = seek(Foxglove State Transitions 방식). 밴드 목록은
 * lib/playback-stats(statusBands·zoneBands·holdBands)가 만들고 여기서는
 * 위치(%)만 lib 함수로 옮겨 그린다. 검사되지 않은 구간은 배경 빗금으로 남겨
 * "감지가 없었던 곳" 이 빈 밴드와 구분된다.
 */

export interface TimelineEquipmentRow {
  modelId: string;
  name: string;
  bands: StatusBand[];
}

export interface TimelineZoneRow {
  zoneKey: string;
  zoneName: string;
  bands: ZoneBand[];
}

const ROW_H = 'h-4';

export function PlaybackReportTimeline({
  axisMs,
  windowEndMs,
  scanned,
  collisions,
  holds,
  equipment,
  zones,
  onSeek,
  className,
}: {
  axisMs: number;
  windowEndMs: number;
  scanned: readonly ScannedInterval[];
  collisions: readonly PlaybackEvent[];
  holds: readonly HoldBand[];
  equipment: readonly TimelineEquipmentRow[];
  zones: readonly TimelineZoneRow[];
  /** 축 위 클릭 → 그 씬 시간으로 이동. */
  onSeek: (atMs: number) => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const cursor = markerPercent(windowEndMs, axisMs);
  const ticks = timelineTicks(axisMs, 4);

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    onSeek(msAtFraction((event.clientX - rect.left) / rect.width, axisMs));
  };

  const rows: { key: string; label: string; content: React.ReactNode }[] = [
    {
      key: '__events',
      label: t('monitoring:playback.timeline.events'),
      content: (
        <>
          {holds.map((h, i) => (
            <span
              key={`h${i}`}
              title={`${t('monitoring:playback.event.holdStart')} ${formatSimClock(h.fromMs)}`}
              className="absolute inset-y-0.5 min-w-[2px] rounded-sm bg-violet-400/70"
              style={bandStyle(h.fromMs, h.toMs, axisMs)}
            />
          ))}
          {collisions.map((e) => (
            <span
              key={e.id}
              title={`${formatSimClock(e.atMs)} · ${e.label}`}
              className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-red-500"
              style={{ left: `${markerPercent(e.atMs, axisMs)}%` }}
            />
          ))}
        </>
      ),
    },
    ...equipment.map((row) => ({
      key: row.modelId,
      label: row.name,
      content: (
        <>
          {row.bands.map((b, i) => {
            const fill = PLAYBACK_STATUS_FILL[b.status];
            if (!fill) return null;
            return (
              <span
                key={i}
                title={`${t(`monitoring:runtimeStatus.${b.status}`)} ${formatSimClock(b.fromMs)}~${formatSimClock(b.toMs)}`}
                className="absolute inset-y-1"
                style={{
                  ...bandStyle(b.fromMs, b.toMs, axisMs),
                  background: fill,
                }}
              />
            );
          })}
        </>
      ),
    })),
    ...zones.map((row) => ({
      key: row.zoneKey,
      label: row.zoneName,
      content: (
        <>
          {row.bands.map((b, i) => (
            <span
              key={i}
              title={`${b.intruderName} ${formatSimClock(b.fromMs)}~${formatSimClock(b.toMs)}`}
              className={cn(
                'absolute inset-y-1 min-w-[2px] rounded-sm',
                b.level === 'stop' ? 'bg-red-500/80' : 'bg-amber-400/80',
                b.open && 'border-r border-dashed border-white/70',
              )}
              style={bandStyle(b.fromMs, b.toMs, axisMs)}
            />
          ))}
        </>
      ),
    })),
  ];

  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      <div className="max-h-44 overflow-y-auto">
        {rows.map((row) => (
          <div key={row.key} className={cn('flex items-center gap-1.5', ROW_H)}>
            <span
              className="text-muted-foreground w-20 shrink-0 truncate text-[10px]"
              title={row.label}
            >
              {row.label}
            </span>
            <div
              className="bg-muted/60 relative h-full min-w-0 flex-1 cursor-pointer overflow-hidden rounded-sm"
              onClick={handleClick}
            >
              {/* 검사된 구간 — 그 밖은 빗금(감지 없음). */}
              <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,transparent_0_3px,rgba(120,120,120,0.18)_3px_4px)]" />
              {scanned.map((s, i) => (
                <span
                  key={i}
                  className="bg-background/70 absolute inset-y-0"
                  style={bandStyle(s.fromMs, s.toMs, axisMs)}
                />
              ))}
              {row.content}
              <span
                aria-hidden
                className="bg-foreground/50 absolute inset-y-0 w-px"
                style={{ left: `${cursor}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-20 shrink-0" />
        <div className="text-muted-foreground relative h-3 min-w-0 flex-1 font-mono text-[9px] tabular-nums">
          {ticks.map((tick, i) => (
            <span
              key={i}
              className={cn(
                'absolute top-0',
                i === 0 && 'left-0',
                i === ticks.length - 1 && 'right-0',
                i > 0 && i < ticks.length - 1 && '-translate-x-1/2',
              )}
              style={
                i > 0 && i < ticks.length - 1
                  ? { left: `${markerPercent(tick, axisMs)}%` }
                  : undefined
              }
            >
              {formatSimClock(tick)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function bandStyle(fromMs: number, toMs: number, axisMs: number) {
  const left = markerPercent(fromMs, axisMs);
  const right = markerPercent(toMs, axisMs);
  return { left: `${left}%`, width: `${Math.max(0, right - left)}%` };
}
