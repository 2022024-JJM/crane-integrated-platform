import { useTranslation } from 'react-i18next';
import { cn } from '@crane/core/lib/utils';
import {
  PLAY3D_EVENT_COLORS,
  PLAY3D_EVENT_FILTERS,
  PLAY3D_STATUS_FILL,
  formatRatio,
  formatTagNumber,
  type RankingRow,
} from '../lib/play3d-format';
import type {
  EquipmentStat,
  Play3dEvent,
  TagRangeBar,
  TagStat,
  ZoneStat,
} from '../lib/play3d-stats';
import { formatSimClock } from '../lib/sim-clock';

/**
 * 리포트 표·목록 — 원인 상위(ISA-18.2 bad actors), 장비 적층 비율 막대, 태그
 * range bar(MoTeC 채널 리포트), 사건 목록(종류 필터). 수치는 전부 lib 에서
 * 받은 값을 그리기만 한다.
 */

export function RankingBars({
  rows,
  className,
}: {
  rows: readonly RankingRow[];
  className?: string;
}) {
  const max = rows.reduce((m, r) => Math.max(m, r.count), 0);
  return (
    <ul className={cn('space-y-1', className)}>
      {rows.map((r) => (
        <li key={r.key} className="flex items-center gap-2 text-[11px]">
          <span className="w-28 shrink-0 truncate" title={r.label}>
            {r.label}
          </span>
          <span className="bg-muted relative h-2.5 min-w-0 flex-1 overflow-hidden rounded-sm">
            <span
              className={cn(
                'absolute inset-y-0 left-0 rounded-sm',
                r.tone === 'bad' ? 'bg-red-500/80' : 'bg-amber-400/80',
              )}
              style={{ width: `${max > 0 ? (r.count / max) * 100 : 0}%` }}
            />
          </span>
          <span className="w-6 shrink-0 text-right font-mono tabular-nums">
            {r.count}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function EquipmentTable({
  rows,
  showOffline,
}: {
  rows: readonly EquipmentStat[];
  showOffline: boolean;
}) {
  const { t } = useTranslation();
  return (
    <ul className="space-y-1">
      {rows.map((eq) => {
        const total = eq.totalMs - eq.ms.unknown;
        const pct = (ms: number) => (total > 0 ? (ms / total) * 100 : 0);
        return (
          <li key={eq.modelId} className="flex items-center gap-2 text-[11px]">
            <span className="w-24 shrink-0 truncate" title={eq.name}>
              {eq.name}
            </span>
            <span
              className="bg-muted relative h-2.5 min-w-0 flex-1 overflow-hidden rounded-sm"
              title={`${t('monitoring:runtimeStatus.running')} ${formatRatio(total > 0 ? eq.ms.running / total : null)} · ${t('monitoring:runtimeStatus.idle')} ${formatRatio(total > 0 ? eq.ms.idle / total : null)}${showOffline ? ` · ${t('monitoring:runtimeStatus.offline')} ${formatRatio(total > 0 ? eq.ms.offline / total : null)}` : ''}`}
            >
              <span
                className="absolute inset-y-0 left-0"
                style={{
                  width: `${pct(eq.ms.running)}%`,
                  background: PLAY3D_STATUS_FILL.running ?? undefined,
                }}
              />
              <span
                className="absolute inset-y-0"
                style={{
                  left: `${pct(eq.ms.running)}%`,
                  width: `${pct(eq.ms.idle)}%`,
                  background: PLAY3D_STATUS_FILL.idle ?? undefined,
                }}
              />
              {showOffline ? (
                <span
                  className="absolute inset-y-0"
                  style={{
                    left: `${pct(eq.ms.running) + pct(eq.ms.idle)}%`,
                    width: `${pct(eq.ms.offline)}%`,
                    background: PLAY3D_STATUS_FILL.offline ?? undefined,
                  }}
                />
              ) : null}
            </span>
            <span className="w-9 shrink-0 text-right font-mono text-emerald-600 tabular-nums dark:text-emerald-400">
              {formatRatio(total > 0 ? eq.ms.running / total : null)}
            </span>
            {showOffline ? (
              <span
                className={cn(
                  'w-5 shrink-0 text-right font-mono tabular-nums',
                  eq.offlineEpisodes > 0
                    ? 'text-amber-600 dark:text-amber-300'
                    : 'text-muted-foreground',
                )}
                title={t('monitoring:play3d.col.offlineEpisodes')}
              >
                {eq.offlineEpisodes}
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function TagTable({
  rows,
  showSaturation,
}: {
  rows: readonly { stat: TagStat; range: TagRangeBar | null }[];
  showSaturation: boolean;
}) {
  const { t } = useTranslation();
  return (
    <ul className="space-y-1">
      {rows.map(({ stat, range }) => (
        <li key={stat.key} className="flex items-center gap-2 text-[11px]">
          <span className="w-28 shrink-0 truncate font-mono" title={stat.key}>
            {stat.key}
          </span>
          <span
            className="bg-muted relative h-2.5 min-w-0 flex-1 rounded-sm"
            title={
              range
                ? `min ${formatTagNumber(stat.min)} · ${t('monitoring:play3d.col.mean')} ${formatTagNumber(stat.mean)} · max ${formatTagNumber(stat.max)} (${formatTagNumber(range.lo)}~${formatTagNumber(range.hi)})`
                : undefined
            }
          >
            {range ? (
              <>
                <span
                  className="absolute inset-y-0 rounded-sm bg-sky-500/40"
                  style={{
                    left: `${range.min * 100}%`,
                    width: `${Math.max(0, range.max - range.min) * 100}%`,
                  }}
                />
                <span
                  className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-600 dark:bg-sky-300"
                  style={{ left: `${range.mean * 100}%` }}
                />
              </>
            ) : null}
          </span>
          <span
            className="w-12 shrink-0 text-right font-mono tabular-nums"
            title={t('monitoring:play3d.col.travel')}
          >
            {formatTagNumber(stat.travel)}
          </span>
          {showSaturation ? (
            <span
              className="bg-muted relative h-2.5 w-10 shrink-0 overflow-hidden rounded-sm"
              title={`${t('monitoring:play3d.col.saturation')} ${formatRatio(stat.saturationRatio)}`}
            >
              {stat.saturationRatio !== null ? (
                <span
                  className="absolute inset-y-0 left-0 bg-red-500/70"
                  style={{ width: `${stat.saturationRatio * 100}%` }}
                />
              ) : null}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function ZoneTable({ rows }: { rows: readonly ZoneStat[] }) {
  const max = rows.reduce((m, z) => Math.max(m, z.dwellMs), 0);
  return (
    <ul className="space-y-1">
      {rows.map((z) => (
        <li key={z.zoneKey} className="flex items-center gap-2 text-[11px]">
          <span className="w-28 shrink-0 truncate" title={z.zoneName}>
            {z.level === 'stop' ? (
              <span className="mr-1 text-red-500">■</span>
            ) : null}
            {z.zoneName}
          </span>
          <span className="bg-muted relative h-2.5 min-w-0 flex-1 overflow-hidden rounded-sm">
            <span
              className={cn(
                'absolute inset-y-0 left-0 rounded-sm',
                z.level === 'stop' ? 'bg-red-500/70' : 'bg-amber-400/70',
              )}
              style={{ width: `${max > 0 ? (z.dwellMs / max) * 100 : 0}%` }}
            />
          </span>
          <span className="w-12 shrink-0 text-right font-mono tabular-nums">
            {formatSimClock(z.dwellMs)}
          </span>
          <span className="text-muted-foreground w-6 shrink-0 text-right font-mono tabular-nums">
            {z.enters}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function EventList({
  events,
  filter,
  onFilterChange,
  timeLabel,
  onSeek,
}: {
  events: readonly Play3dEvent[];
  filter: string;
  onFilterChange: (key: string) => void;
  timeLabel: (event: Play3dEvent) => string;
  onSeek: (event: Play3dEvent) => void;
}) {
  const { t } = useTranslation();
  const active =
    PLAY3D_EVENT_FILTERS.find((f) => f.key === filter) ??
    PLAY3D_EVENT_FILTERS[0];
  const visible =
    active.kinds.length === 0
      ? events
      : events.filter((e) => active.kinds.includes(e.kind));
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-1">
        {PLAY3D_EVENT_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={cn(
              'rounded-full border px-2 py-0.5 text-[10px]',
              f.key === active.key
                ? 'bg-foreground text-background border-foreground'
                : 'text-muted-foreground hover:bg-accent',
            )}
            onClick={() => onFilterChange(f.key)}
          >
            {t(`monitoring:play3d.filter.${f.key}`)}
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <p className="text-muted-foreground text-[10px]">
          {t('monitoring:play3d.noEvents')}
        </p>
      ) : (
        <ul className="max-h-48 space-y-0.5 overflow-y-auto">
          {visible.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                className="hover:bg-accent flex w-full items-center gap-2 rounded px-1.5 py-0.5 text-left"
                onClick={() => onSeek(e)}
                title={t('monitoring:play3d.seekToEvent')}
              >
                <span
                  aria-hidden
                  className={cn(
                    'size-2 shrink-0 rounded-full',
                    PLAY3D_EVENT_COLORS[e.kind],
                  )}
                />
                <span className="text-muted-foreground w-16 shrink-0 font-mono text-[10px] tabular-nums">
                  {timeLabel(e)}
                </span>
                <span className="w-14 shrink-0 text-[10px]">
                  {t(`monitoring:play3d.event.${e.kind}`)}
                </span>
                <span className="truncate text-[11px]">{e.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
