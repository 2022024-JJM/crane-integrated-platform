import { useTranslation } from 'react-i18next';
import { cn } from '@crane/core/lib/utils';
import {
  PLAY3D_EVENT_COLORS,
  PLAY3D_EVENT_FILTERS,
  PLAY3D_STATUS_FILL,
  formatPercent,
  formatRatio,
  formatTagNumber,
  percentOf,
  rangeBarPercent,
  statusSharePercents,
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
 * 리포트 표·목록 — 장비 적층 비율(가동·대기·두절)과 노출(영역 체류·충돌 관여),
 * 영역 체류 막대와 주 침범자, 축 range bar(MoTeC 채널 리포트), 사건 목록(종류
 * 필터). 표마다 헤더 행을 두고, 수치는 전부 lib 에서 받은 값을 그리기만 한다.
 */

interface HeaderCell {
  label: string;
  className: string;
}

function HeaderRow({ cells }: { cells: readonly HeaderCell[] }) {
  return (
    <div className="text-muted-foreground flex items-center gap-2 text-[9px] tracking-wide uppercase">
      {cells.map((cell, i) => (
        <span key={i} className={cn('truncate', cell.className)}>
          {cell.label}
        </span>
      ))}
    </div>
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
  const header: HeaderCell[] = [
    { label: t('monitoring:play3d.col.equipment'), className: 'w-24 shrink-0' },
    { label: t('monitoring:play3d.col.status'), className: 'min-w-0 flex-1' },
    {
      label: t('monitoring:play3d.col.running'),
      className: 'w-9 shrink-0 text-right',
    },
  ];
  if (showOffline) {
    header.push({
      label: t('monitoring:play3d.col.offlineEpisodes'),
      className: 'w-6 shrink-0 text-right',
    });
  }
  header.push(
    {
      label: t('monitoring:play3d.col.zoneDwell'),
      className: 'w-11 shrink-0 text-right',
    },
    {
      label: t('monitoring:play3d.col.collisions'),
      className: 'w-6 shrink-0 text-right',
    },
  );
  return (
    <div className="space-y-1">
      <HeaderRow cells={header} />
      <ul className="space-y-1">
        {rows.map((eq) => {
          const share = statusSharePercents(eq);
          return (
            <li
              key={eq.modelId}
              className="flex items-center gap-2 text-[11px]"
            >
              <span className="w-24 shrink-0 truncate" title={eq.name}>
                {eq.name}
              </span>
              <span
                className="bg-muted relative h-2.5 min-w-0 flex-1 overflow-hidden rounded-sm"
                title={
                  share
                    ? `${t('monitoring:runtimeStatus.running')} ${formatPercent(share.running)} · ${t('monitoring:runtimeStatus.idle')} ${formatPercent(share.idle)}${showOffline ? ` · ${t('monitoring:runtimeStatus.offline')} ${formatPercent(share.offline)}` : ''}`
                    : undefined
                }
              >
                {share ? (
                  <>
                    <span
                      className="absolute inset-y-0 left-0"
                      style={{
                        width: `${share.running}%`,
                        background: PLAY3D_STATUS_FILL.running ?? undefined,
                      }}
                    />
                    <span
                      className="absolute inset-y-0"
                      style={{
                        left: `${share.idleLeft}%`,
                        width: `${share.idle}%`,
                        background: PLAY3D_STATUS_FILL.idle ?? undefined,
                      }}
                    />
                    {showOffline ? (
                      <span
                        className="absolute inset-y-0"
                        style={{
                          left: `${share.offlineLeft}%`,
                          width: `${share.offline}%`,
                          background: PLAY3D_STATUS_FILL.offline ?? undefined,
                        }}
                      />
                    ) : null}
                  </>
                ) : null}
              </span>
              <span className="w-9 shrink-0 text-right font-mono tabular-nums">
                {formatPercent(share ? share.running : null)}
              </span>
              {showOffline ? (
                <span
                  className={cn(
                    'w-6 shrink-0 text-right font-mono tabular-nums',
                    eq.offlineEpisodes > 0
                      ? 'text-amber-600 dark:text-amber-300'
                      : 'text-muted-foreground',
                  )}
                >
                  {eq.offlineEpisodes}
                </span>
              ) : null}
              <span
                className={cn(
                  'w-11 shrink-0 text-right font-mono tabular-nums',
                  eq.zoneDwellMs <= 0 && 'text-muted-foreground',
                )}
              >
                {formatSimClock(eq.zoneDwellMs)}
              </span>
              <span
                className={cn(
                  'w-6 shrink-0 text-right font-mono tabular-nums',
                  eq.collisions > 0
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-muted-foreground',
                )}
              >
                {eq.collisions}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ZoneTable({
  rows,
  maxDwellMs,
}: {
  rows: readonly ZoneStat[];
  /** 막대 기준(영역별 체류 합 중 최대). */
  maxDwellMs: number;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-1">
      <HeaderRow
        cells={[
          {
            label: t('monitoring:play3d.col.zone'),
            className: 'w-28 shrink-0',
          },
          {
            label: t('monitoring:play3d.col.dwell'),
            className: 'min-w-0 flex-1',
          },
          {
            label: t('monitoring:play3d.col.enters'),
            className: 'w-6 shrink-0 text-right',
          },
          {
            label: t('monitoring:play3d.col.topIntruder'),
            className: 'w-16 shrink-0',
          },
        ]}
      />
      <ul className="space-y-1">
        {rows.map((z) => {
          const top = z.byIntruder[0];
          return (
            <li key={z.zoneKey} className="flex items-center gap-2 text-[11px]">
              <span className="w-28 shrink-0 truncate" title={z.zoneName}>
                {z.level === 'stop' ? (
                  <span className="mr-1 text-red-500">■</span>
                ) : null}
                {z.zoneName}
              </span>
              <span className="flex min-w-0 flex-1 items-center gap-1.5">
                <span className="bg-muted relative h-2.5 min-w-0 flex-1 overflow-hidden rounded-sm">
                  <span
                    className={cn(
                      'absolute inset-y-0 left-0 rounded-sm',
                      z.level === 'stop' ? 'bg-red-500/70' : 'bg-amber-400/70',
                    )}
                    style={{ width: `${percentOf(z.dwellMs, maxDwellMs)}%` }}
                  />
                </span>
                <span className="w-10 shrink-0 text-right font-mono tabular-nums">
                  {formatSimClock(z.dwellMs)}
                </span>
              </span>
              <span className="text-muted-foreground w-6 shrink-0 text-right font-mono tabular-nums">
                {z.enters}
              </span>
              <span
                className="w-16 shrink-0 truncate"
                title={top ? `${top.intruderName} (${top.count})` : undefined}
              >
                {top ? top.intruderName : '—'}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export interface TagTableRow {
  stat: TagStat;
  range: TagRangeBar | null;
  label: string;
  unit: string;
}

export function TagTable({
  rows,
  showSaturation,
}: {
  rows: readonly TagTableRow[];
  showSaturation: boolean;
}) {
  const { t } = useTranslation();
  const header: HeaderCell[] = [
    { label: t('monitoring:play3d.col.tag'), className: 'w-28 shrink-0' },
    { label: t('monitoring:play3d.col.range'), className: 'min-w-0 flex-1' },
    {
      label: t('monitoring:play3d.col.travel'),
      className: 'w-12 shrink-0 text-right',
    },
  ];
  if (showSaturation) {
    header.push({
      label: t('monitoring:play3d.col.saturation'),
      className: 'w-10 shrink-0',
    });
  }
  return (
    <div className="space-y-1">
      <HeaderRow cells={header} />
      <ul className="space-y-1">
        {rows.map(({ stat, range, label, unit }) => {
          const bar = range ? rangeBarPercent(range) : null;
          return (
            <li key={stat.key} className="flex items-center gap-2 text-[11px]">
              <span className="w-28 shrink-0 truncate" title={stat.key}>
                {label}
                {unit ? (
                  <span className="text-muted-foreground ml-1 text-[10px]">
                    {unit}
                  </span>
                ) : null}
              </span>
              <span
                className="bg-muted relative h-2.5 min-w-0 flex-1 rounded-sm"
                title={
                  range
                    ? `min ${formatTagNumber(stat.min)} · ${t('monitoring:play3d.col.mean')} ${formatTagNumber(stat.mean)} · max ${formatTagNumber(stat.max)} (${formatTagNumber(range.lo)}~${formatTagNumber(range.hi)})`
                    : undefined
                }
              >
                {bar ? (
                  <>
                    <span
                      className="absolute inset-y-0 rounded-sm bg-sky-500/40"
                      style={{ left: `${bar.left}%`, width: `${bar.width}%` }}
                    />
                    <span
                      className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-600 dark:bg-sky-300"
                      style={{ left: `${bar.mean}%` }}
                    />
                  </>
                ) : null}
              </span>
              <span className="w-12 shrink-0 text-right font-mono tabular-nums">
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
                      style={{
                        width: `${percentOf(stat.saturationRatio, 1)}%`,
                      }}
                    />
                  ) : null}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
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
