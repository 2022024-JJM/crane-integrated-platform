import { Download } from 'lucide-react';
import { useMemo, useState } from 'react';
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
  formatRatio,
  formatTagNumber,
  markerSeekLeadMs,
  pairRankingRows,
  timelineAxisMs,
  zoneRankingRows,
} from '../lib/playback-format';
import {
  cumulativeSeries,
  holdBands,
  rankZoneIntruders,
  runningRatioSeries,
  statusBands,
  tagRangeBar,
  topN,
  zoneBands,
  type PlaybackEvent,
} from '../lib/playback-stats';
import { formatSimClock } from '../lib/sim-clock';
import { usePlaybackTransport } from '../model/playback-transport';
import {
  usePlaybackStats,
  usePlaybackStatsMeta,
} from '../model/use-playback-stats-store';
import { useReplayPlayerStore } from '../model/use-replay-player-store';
import { useVirtualTagStore } from '../model/use-virtual-tag-store';
import { PlaybackKpiCard } from './playback-report-kpi';
import {
  EquipmentTable,
  EventList,
  RankingBars,
  TagTable,
  ZoneTable,
} from './playback-report-tables';
import { PlaybackReportTimeline } from './playback-report-timeline';

const RANK_N = 5;

/**
 * 플레이백 실행 리포트 — 헤더(실행·창) → KPI 카드(누적 스파크라인) → 스윔레인
 * 타임라인(장비 상태·영역 체류·충돌·정지) → 원인 상위 → 장비·영역·태그 표 →
 * 사건 목록(필터·클릭 seek) → CSV. 통계는 usePlaybackStats(version 구독,
 * 4Hz 이하), 시각화 입력은 lib/playback-stats 파생 함수를 useMemo 로.
 * 레퍼런스: Foxglove State Transitions(타임라인), ISA-18.2 bad actors(원인
 * 상위), MoTeC 채널 리포트(range bar). PASS/FAIL 판정은 두지 않는다(2026-09-16).
 */
export function PlaybackReportPanel({ className }: { className?: string }) {
  const { t } = useTranslation();
  const stats = usePlaybackStats();
  const meta = usePlaybackStatsMeta();
  const transport = usePlaybackTransport();
  const replayDurations = useReplayPlayerStore((s) => s.frameDurationsMs);
  const replayFrames = useReplayPlayerStore((s) => s.frames);
  const tagDefs = useVirtualTagStore((s) => s.tags);
  const [eventFilter, setEventFilter] = useState('all');

  const lastEventMs =
    stats.events.length > 0 ? stats.events[stats.events.length - 1].atMs : 0;
  const axisMs = timelineAxisMs(
    transport.durationMs,
    stats.windowEndMs,
    lastEventMs,
  );

  const derived = useMemo(() => {
    const end = stats.windowEndMs;
    const modelIds = [
      ...new Set([
        ...stats.equipment.map((e) => e.modelId),
        ...stats.statusTransitions.map((s) => s.modelId),
      ]),
    ];
    const nameOf = (id: string) =>
      stats.equipment.find((e) => e.modelId === id)?.name ?? id;
    const zones = zoneBands(stats.events, end);
    const zoneRows = [...new Set(zones.map((z) => z.zoneKey))].map((key) => ({
      zoneKey: key,
      zoneName: zones.find((z) => z.zoneKey === key)?.zoneName ?? key,
      bands: zones.filter((z) => z.zoneKey === key),
    }));
    return {
      collisionSeries: cumulativeSeries(
        stats.events,
        ['collision'],
        axisMs,
        end,
      ),
      intrusionSeries: cumulativeSeries(
        stats.events,
        ['zoneEnter'],
        axisMs,
        end,
      ),
      holdSeries: cumulativeSeries(stats.events, ['holdStart'], axisMs, end),
      runningSeries: runningRatioSeries(
        stats.statusTransitions,
        stats.scanned,
        axisMs,
        end,
      ),
      equipmentRows: modelIds.map((id) => ({
        modelId: id,
        name: nameOf(id),
        bands: statusBands(stats.statusTransitions, id, end, stats.scanned),
      })),
      zoneRows,
      holds: holdBands(stats.events, end),
      collisions: stats.events.filter((e) => e.kind === 'collision'),
      pairRanks: topN(stats.collisions.byPair, RANK_N),
      zoneRanks: rankZoneIntruders(stats.zones.byZone, RANK_N),
      tagRows: stats.tags.map((stat) => {
        const def =
          meta.source === 'simulation'
            ? tagDefs.find((d) => d.key === stat.key)
            : undefined;
        return {
          stat,
          range: tagRangeBar(stat, def ? { min: def.min, max: def.max } : null),
        };
      }),
    };
  }, [stats, axisMs, meta.source, tagDefs]);

  const eventTime = (e: PlaybackEvent): string => {
    if (e.frameIndex !== null) {
      const stamp = replayFrames[e.frameIndex]?.timestamp ?? null;
      const label = formatReplayTimestamp(stamp, 'time');
      if (label) return label;
    }
    return formatSimClock(e.atMs);
  };

  const seekMs = (atMs: number, frameIndex: number | null = null) => {
    const lead = markerSeekLeadMs(
      meta.source,
      frameIndex !== null ? replayDurations[frameIndex] : undefined,
    );
    transport.seek(Math.max(0, atMs - lead));
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
      const total = eq.totalMs - eq.ms.unknown;
      rows.push([
        t('monitoring:playback.csv.sectionEquipment'),
        eq.name,
        formatRatio(total > 0 ? eq.ms.running / total : null),
        formatRatio(total > 0 ? eq.ms.idle / total : null),
        formatRatio(total > 0 ? eq.ms.offline / total : null),
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

  const runningTotal = stats.equipment.reduce((a, e) => a + e.ms.running, 0);
  const knownTotal = stats.equipment.reduce(
    (a, e) => a + e.totalMs - e.ms.unknown,
    0,
  );
  const runningRatio = knownTotal > 0 ? runningTotal / knownTotal : null;
  const isReplay = meta.source === 'replay';
  const hasSummary =
    stats.equipment.length > 0 ||
    stats.zones.byZone.length > 0 ||
    stats.tags.length > 0;

  return (
    <div
      data-slot="playback-report-panel"
      className={cn(
        'flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3 text-xs',
        className,
      )}
    >
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.14em] uppercase">
            {t('monitoring:playback.report')}
          </p>
          <p className="truncate font-medium" title={windowLabel}>
            {t(
              isReplay
                ? 'monitoring:playback.sourceReplay'
                : 'monitoring:playback.sourceSimulation',
            )}{' '}
            · {windowLabel}
          </p>
          <p className="text-muted-foreground font-mono text-[10px] tabular-nums">
            {t('monitoring:playback.window')} {formatSimClock(0)}~
            {formatSimClock(stats.windowEndMs)} ·{' '}
            {t('monitoring:playback.scanned')} {formatSimClock(stats.scannedMs)}
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
            disabled={!hasSummary}
            title={t('monitoring:playback.exportSummary')}
          >
            <Download className="size-3" />
            {t('monitoring:playback.exportSummary')}
          </Button>
        </div>
      </div>
      {stats.detectionOffSeen ? (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-700 dark:text-amber-300">
          {t('monitoring:playback.detectionOff')}
        </p>
      ) : null}

      {/* KPI */}
      <div className="grid grid-cols-2 gap-2">
        <PlaybackKpiCard
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
          series={derived.collisionSeries}
          axisMs={axisMs}
          windowEndMs={stats.windowEndMs}
        />
        <PlaybackKpiCard
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
          series={derived.intrusionSeries}
          axisMs={axisMs}
          windowEndMs={stats.windowEndMs}
        />
        <PlaybackKpiCard
          label={t('monitoring:playback.tile.holds')}
          value={String(stats.holds.count)}
          tone={stats.holds.count > 0 ? 'warn' : 'good'}
          hint={t('monitoring:playback.tile.holdWall', {
            time: formatSimClock(stats.holds.wallMs),
          })}
          series={derived.holdSeries}
          axisMs={axisMs}
          windowEndMs={stats.windowEndMs}
        />
        <PlaybackKpiCard
          label={t('monitoring:playback.tile.running')}
          value={formatRatio(runningRatio)}
          tone="neutral"
          hint={t('monitoring:playback.tile.runningOf', {
            count: stats.equipment.length,
          })}
          series={derived.runningSeries}
          axisMs={axisMs}
          windowEndMs={stats.windowEndMs}
          maxV={1}
        />
      </div>

      {/* 타임라인 */}
      <Section title={t('monitoring:playback.timeline.title')}>
        <PlaybackReportTimeline
          axisMs={axisMs}
          windowEndMs={stats.windowEndMs}
          scanned={stats.scanned}
          collisions={derived.collisions}
          holds={derived.holds}
          equipment={derived.equipmentRows}
          zones={derived.zoneRows}
          onSeek={(ms) => transport.seek(ms)}
        />
        <p className="text-muted-foreground flex flex-wrap gap-x-2 text-[9px]">
          <LegendDot
            className="bg-emerald-400"
            label={t('monitoring:runtimeStatus.running')}
          />
          <LegendDot
            className="bg-sky-300"
            label={t('monitoring:runtimeStatus.idle')}
          />
          {isReplay ? (
            <LegendDot
              className="bg-zinc-400"
              label={t('monitoring:runtimeStatus.offline')}
            />
          ) : null}
          <LegendDot
            className="bg-amber-400"
            label={t('monitoring:playback.timeline.zoneDwell')}
          />
          <LegendDot
            className="bg-red-500"
            label={t('monitoring:playback.event.collision')}
          />
          <LegendDot
            className="bg-violet-400"
            label={t('monitoring:playback.event.holdStart')}
          />
          <span>{t('monitoring:playback.timeline.unscanned')}</span>
        </p>
      </Section>

      {/* 원인 상위 */}
      {derived.pairRanks.length > 0 || derived.zoneRanks.length > 0 ? (
        <Section title={t('monitoring:playback.ranking.title')}>
          {derived.pairRanks.length > 0 ? (
            <RankingBars rows={pairRankingRows(derived.pairRanks)} />
          ) : null}
          {derived.zoneRanks.length > 0 ? (
            <RankingBars rows={zoneRankingRows(derived.zoneRanks)} />
          ) : null}
        </Section>
      ) : null}

      {/* 장비 */}
      <Section title={t('monitoring:playback.equipment')}>
        {stats.equipment.length === 0 ? (
          <Empty>{t('monitoring:playback.noData')}</Empty>
        ) : (
          <EquipmentTable rows={stats.equipment} showOffline={isReplay} />
        )}
      </Section>

      {/* 영역 */}
      {stats.zones.byZone.length > 0 ? (
        <Section title={t('monitoring:playback.zones')}>
          <ZoneTable rows={stats.zones.byZone} />
        </Section>
      ) : null}

      {/* 태그 */}
      <Section title={t('monitoring:playback.tags')}>
        {derived.tagRows.length === 0 ? (
          <Empty>{t('monitoring:playback.noData')}</Empty>
        ) : (
          <TagTable rows={derived.tagRows} showSaturation={!isReplay} />
        )}
      </Section>

      {/* 사건 */}
      <Section title={t('monitoring:playback.events')}>
        <EventList
          events={stats.events}
          filter={eventFilter}
          onFilterChange={setEventFilter}
          timeLabel={eventTime}
          onSeek={(e) => seekMs(e.atMs, e.frameIndex)}
        />
      </Section>
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

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        aria-hidden
        className={cn('inline-block size-1.5 rounded-sm', className)}
      />
      {label}
    </span>
  );
}
