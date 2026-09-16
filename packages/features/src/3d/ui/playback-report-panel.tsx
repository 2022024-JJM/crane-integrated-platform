import { Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  buildCsv,
  downloadCsv,
  formatCsvTimestamp,
  type CsvRow,
} from '@crane/core/lib/export-csv';
import { cn } from '@crane/core/lib/utils';
import { formatReplayTimestamp } from '@crane/domain/monitoring';
import { Button } from '@crane/ui/atoms/button';
import {
  PLAYBACK_EVENT_COLORS,
  formatRatio,
  formatTagNumber,
  markerSeekLeadMs,
} from '../lib/playback-format';
import type { PlaybackEvent } from '../lib/playback-stats';
import { formatSimClock } from '../lib/sim-clock';
import { usePlaybackTransport } from '../model/playback-transport';
import {
  usePlaybackStats,
  usePlaybackStatsMeta,
} from '../model/use-playback-stats-store';
import { useReplayPlayerStore } from '../model/use-replay-player-store';

/**
 * 플레이백 실행 리포트 — 창 정보 → 요약 타일 → 사건 목록(클릭 = seek) →
 * 장비 표 → 영역 표 → 태그 표 → CSV. 통계는 usePlaybackStats(version 구독,
 * 4Hz 이하)가 준다. 수치 계산은 lib/playback-stats·playback-format 에 있다.
 */
export function PlaybackReportPanel({ className }: { className?: string }) {
  const { t } = useTranslation();
  const stats = usePlaybackStats();
  const meta = usePlaybackStatsMeta();
  const transport = usePlaybackTransport();
  const replayDurations = useReplayPlayerStore((s) => s.frameDurationsMs);
  const replayFrames = useReplayPlayerStore((s) => s.frames);

  const eventTime = (e: PlaybackEvent): string => {
    if (e.frameIndex !== null) {
      const stamp = replayFrames[e.frameIndex]?.timestamp ?? null;
      const label = formatReplayTimestamp(stamp, 'time');
      if (label) return label;
    }
    return formatSimClock(e.atMs);
  };

  const seekEvent = (e: PlaybackEvent) => {
    const lead = markerSeekLeadMs(
      meta.source,
      e.frameIndex !== null ? replayDurations[e.frameIndex] : undefined,
    );
    transport.seek(Math.max(0, e.atMs - lead));
  };

  const exportEvents = () => {
    const rows: CsvRow[] = stats.events.map((e) => [
      eventTime(e),
      Math.round(e.atMs),
      t(`monitoring:playback.event.${e.kind}`),
      e.label,
      e.level ?? '',
    ]);
    downloadCsv(
      `playback-events-${meta.regionId}-${formatCsvTimestamp()}.csv`,
      buildCsv(
        [
          t('monitoring:playback.csv.time'),
          t('monitoring:playback.csv.sceneMs'),
          t('monitoring:playback.csv.kind'),
          t('monitoring:playback.csv.subject'),
          t('monitoring:playback.csv.level'),
        ],
        rows,
      ),
    );
  };

  const exportTables = () => {
    const rows: CsvRow[] = [];
    for (const eq of stats.equipment) {
      rows.push([
        t('monitoring:playback.csv.sectionEquipment'),
        eq.name,
        formatRatio(eq.totalMs > 0 ? eq.ms.running / eq.totalMs : null),
        formatRatio(eq.totalMs > 0 ? eq.ms.idle / eq.totalMs : null),
        formatRatio(eq.totalMs > 0 ? eq.ms.offline / eq.totalMs : null),
        eq.offlineEpisodes,
      ]);
    }
    for (const z of stats.zones.byZone) {
      rows.push([
        t('monitoring:playback.csv.sectionZones'),
        z.zoneName,
        z.enters,
        z.stopEnters,
        Math.round(z.dwellMs / 1000),
        Math.round(z.maxDwellMs / 1000),
      ]);
    }
    for (const tag of stats.tags) {
      rows.push([
        t('monitoring:playback.csv.sectionTags'),
        tag.key,
        formatTagNumber(tag.min),
        formatTagNumber(tag.max),
        formatTagNumber(tag.mean),
        formatTagNumber(tag.travel),
        formatRatio(tag.saturationRatio),
      ]);
    }
    downloadCsv(
      `playback-summary-${meta.regionId}-${formatCsvTimestamp()}.csv`,
      buildCsv(
        [
          t('monitoring:playback.csv.section'),
          t('monitoring:playback.csv.name'),
          'a',
          'b',
          'c',
          'd',
          'e',
        ],
        rows,
      ),
    );
  };

  const windowLabel =
    meta.source === 'replay'
      ? [
          formatReplayTimestamp(meta.replayFrom, 'datetime'),
          formatReplayTimestamp(meta.replayTo, 'time'),
        ]
          .filter(Boolean)
          .join(' ~ ') || t('common:replay.noData')
      : (meta.scenarioName ?? t('monitoring:simulation.none'));

  const runningTotal = stats.equipment.reduce(
    (acc, e) => acc + e.ms.running,
    0,
  );
  const knownTotal = stats.equipment.reduce(
    (acc, e) => acc + e.totalMs - e.ms.unknown,
    0,
  );

  return (
    <div
      data-slot="playback-report-panel"
      className={cn(
        'flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3 text-xs',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.14em] uppercase">
            {t('monitoring:playback.report')}
          </p>
          <p className="truncate font-medium" title={windowLabel}>
            {t(
              meta.source === 'replay'
                ? 'monitoring:playback.sourceReplay'
                : 'monitoring:playback.sourceSimulation',
            )}{' '}
            · {windowLabel}
            {stats.loopIteration !== null && meta.scenarioLoop
              ? ` · ${t('monitoring:playback.iteration', { n: stats.loopIteration + 1 })}`
              : null}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={exportEvents}
            disabled={stats.events.length === 0}
            title={t('monitoring:playback.exportEvents')}
          >
            <Download className="size-3" />
            {t('monitoring:playback.exportEvents')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={exportTables}
            disabled={
              stats.equipment.length === 0 &&
              stats.zones.byZone.length === 0 &&
              stats.tags.length === 0
            }
            title={t('monitoring:playback.exportSummary')}
          >
            <Download className="size-3" />
            {t('monitoring:playback.exportSummary')}
          </Button>
        </div>
      </div>

      <dl className="text-muted-foreground grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        <dt>{t('monitoring:playback.window')}</dt>
        <dd className="text-foreground font-mono tabular-nums">
          {formatSimClock(0)} ~ {formatSimClock(stats.windowEndMs)}
        </dd>
        <dt>{t('monitoring:playback.scanned')}</dt>
        <dd className="text-foreground font-mono tabular-nums">
          {formatSimClock(stats.scannedMs)}
        </dd>
      </dl>
      {stats.detectionOffSeen ? (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-700 dark:text-amber-300">
          {t('monitoring:playback.detectionOff')}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <Tile
          label={t('monitoring:playback.tile.collisions')}
          value={String(stats.collisions.count)}
          tone={stats.collisions.count > 0 ? 'bad' : 'good'}
          hint={
            stats.collisions.firstAtMs !== null
              ? t('monitoring:playback.tile.firstAt', {
                  time: formatSimClock(stats.collisions.firstAtMs),
                })
              : undefined
          }
        />
        <Tile
          label={t('monitoring:playback.tile.intrusions')}
          value={String(stats.zones.enters)}
          tone={
            stats.zones.stopEnters > 0
              ? 'bad'
              : stats.zones.enters > 0
                ? 'warn'
                : 'good'
          }
          hint={t('monitoring:playback.tile.stopEnters', {
            count: stats.zones.stopEnters,
          })}
        />
        <Tile
          label={t('monitoring:playback.tile.holds')}
          value={String(stats.holds.count)}
          tone={stats.holds.count > 0 ? 'warn' : 'good'}
          hint={t('monitoring:playback.tile.holdWall', {
            time: formatSimClock(stats.holds.wallMs),
          })}
        />
        <Tile
          label={t('monitoring:playback.tile.running')}
          value={formatRatio(knownTotal > 0 ? runningTotal / knownTotal : null)}
          tone="neutral"
        />
      </div>

      <Section title={t('monitoring:playback.events')}>
        {stats.events.length === 0 ? (
          <Empty>{t('monitoring:playback.noEvents')}</Empty>
        ) : (
          <ul className="max-h-48 space-y-0.5 overflow-y-auto">
            {stats.events.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  className="hover:bg-accent flex w-full items-center gap-2 rounded px-1.5 py-0.5 text-left"
                  onClick={() => seekEvent(e)}
                  title={t('monitoring:playback.seekToEvent')}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'size-2 shrink-0 rounded-full',
                      PLAYBACK_EVENT_COLORS[e.kind],
                    )}
                  />
                  <span className="text-muted-foreground w-16 shrink-0 font-mono text-[10px] tabular-nums">
                    {eventTime(e)}
                  </span>
                  <span className="w-14 shrink-0 text-[10px]">
                    {t(`monitoring:playback.event.${e.kind}`)}
                  </span>
                  <span className="truncate text-[11px]">{e.label}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t('monitoring:playback.equipment')}>
        {stats.equipment.length === 0 ? (
          <Empty>{t('monitoring:playback.noData')}</Empty>
        ) : (
          <table className="w-full text-[11px]">
            <thead className="text-muted-foreground text-[10px]">
              <tr>
                <th className="text-left font-medium">
                  {t('monitoring:playback.col.equipment')}
                </th>
                <th className="text-right font-medium">
                  {t('monitoring:runtimeStatus.running')}
                </th>
                <th className="text-right font-medium">
                  {t('monitoring:runtimeStatus.idle')}
                </th>
                {meta.source === 'replay' ? (
                  <>
                    <th className="text-right font-medium">
                      {t('monitoring:runtimeStatus.offline')}
                    </th>
                    <th className="text-right font-medium">
                      {t('monitoring:playback.col.offlineEpisodes')}
                    </th>
                  </>
                ) : null}
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums">
              {stats.equipment.map((eq) => (
                <tr key={eq.modelId}>
                  <td className="truncate font-sans">{eq.name}</td>
                  <td className="text-right">
                    {formatRatio(
                      eq.totalMs > 0 ? eq.ms.running / eq.totalMs : null,
                    )}
                  </td>
                  <td className="text-right">
                    {formatRatio(
                      eq.totalMs > 0 ? eq.ms.idle / eq.totalMs : null,
                    )}
                  </td>
                  {meta.source === 'replay' ? (
                    <>
                      <td className="text-right">
                        {formatRatio(
                          eq.totalMs > 0 ? eq.ms.offline / eq.totalMs : null,
                        )}
                      </td>
                      <td className="text-right">{eq.offlineEpisodes}</td>
                    </>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title={t('monitoring:playback.zones')}>
        {stats.zones.byZone.length === 0 ? (
          <Empty>{t('monitoring:playback.noData')}</Empty>
        ) : (
          <table className="w-full text-[11px]">
            <thead className="text-muted-foreground text-[10px]">
              <tr>
                <th className="text-left font-medium">
                  {t('monitoring:playback.col.zone')}
                </th>
                <th className="text-right font-medium">
                  {t('monitoring:playback.col.enters')}
                </th>
                <th className="text-right font-medium">
                  {t('monitoring:playback.col.dwell')}
                </th>
                <th className="text-right font-medium">
                  {t('monitoring:playback.col.maxDwell')}
                </th>
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums">
              {stats.zones.byZone.map((z) => (
                <tr key={z.zoneKey}>
                  <td className="truncate font-sans">
                    {z.zoneName}
                    {z.level === 'stop' ? (
                      <span className="ml-1 text-red-500">■</span>
                    ) : null}
                  </td>
                  <td className="text-right">{z.enters}</td>
                  <td className="text-right">{formatSimClock(z.dwellMs)}</td>
                  <td className="text-right">{formatSimClock(z.maxDwellMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title={t('monitoring:playback.tags')}>
        {stats.tags.length === 0 ? (
          <Empty>{t('monitoring:playback.noData')}</Empty>
        ) : (
          <table className="w-full text-[11px]">
            <thead className="text-muted-foreground text-[10px]">
              <tr>
                <th className="text-left font-medium">
                  {t('monitoring:playback.col.tag')}
                </th>
                <th className="text-right font-medium">min</th>
                <th className="text-right font-medium">max</th>
                <th className="text-right font-medium">
                  {t('monitoring:playback.col.mean')}
                </th>
                <th className="text-right font-medium">
                  {t('monitoring:playback.col.travel')}
                </th>
                {meta.source === 'simulation' ? (
                  <th className="text-right font-medium">
                    {t('monitoring:playback.col.saturation')}
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums">
              {stats.tags.map((tag) => (
                <tr key={tag.key}>
                  <td className="truncate">{tag.key}</td>
                  <td className="text-right">{formatTagNumber(tag.min)}</td>
                  <td className="text-right">{formatTagNumber(tag.max)}</td>
                  <td className="text-right">{formatTagNumber(tag.mean)}</td>
                  <td className="text-right">{formatTagNumber(tag.travel)}</td>
                  {meta.source === 'simulation' ? (
                    <td className="text-right">
                      {formatRatio(tag.saturationRatio)}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  );
}

function Tile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone: 'good' | 'warn' | 'bad' | 'neutral';
}) {
  return (
    <div className="bg-muted/50 rounded-md border px-2 py-1.5">
      <p className="text-muted-foreground text-[10px]">{label}</p>
      <p
        className={cn(
          'font-mono text-lg leading-6 font-bold tabular-nums',
          tone === 'good' && 'text-emerald-600 dark:text-emerald-400',
          tone === 'warn' && 'text-amber-600 dark:text-amber-300',
          tone === 'bad' && 'text-red-600 dark:text-red-400',
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className="text-muted-foreground text-[10px]">{hint}</p>
      ) : null}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-1">
      <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.14em] uppercase">
        {title}
      </p>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground text-[10px]">{children}</p>;
}
