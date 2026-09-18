import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { cn } from '@crane/core/lib/utils';
import { formatReplayTimestamp } from '@crane/domain/monitoring';
import {
  PLAY3D_STATUS_FILL,
  coverageRatio,
  formatRatio,
  markerSeekLeadMs,
  reportAxisMs,
  tagRowLabel,
} from '../lib/play3d-format';
import {
  assignZoneBandsToRows,
  statusBands,
  tagRangeBar,
  zoneBands,
  type Play3dEvent,
} from '../lib/play3d-stats';
import { formatSimClock } from '../lib/sim-clock';
import { collectSceneTagKeys } from '../lib/tag-mapping-index';
import { usePlay3dTransport } from '../model/play3d-transport';
import {
  usePlay3dStats,
  usePlay3dStatsMeta,
} from '../model/use-play3d-stats-store';
import { useReplayPlayerStore } from '../model/use-replay-player-store';
import { useSceneInfoStore } from '../model/use-scene-info-store';
import { useVirtualTagStore } from '../model/use-virtual-tag-store';
import { Play3dKpiCard } from './play3d-report-kpi';
import {
  EquipmentTable,
  EventList,
  TagTable,
  ZoneTable,
} from './play3d-report-tables';
import { Play3dReportTimeline } from './play3d-report-timeline';

/**
 * 3D 플레이 실행 리포트 — 개요 → 상세(Grafana 식). 헤더(실행·창·검사 비율)
 * → KPI 카드 4장(충돌 · 영역 침범 · 가동률 · 소스별: 통신 두절 | 속도 한계
 * 도달) → 스윔레인 타임라인(사건 lane + 장비 행에 상태 밴드·영역 체류 띠) →
 * 접이식 상세(사건 목록·장비·영역·축). 같은 사실은 한 자리에서만 보인다.
 * 통계는 usePlay3dStats(version 구독, 4Hz 이하), 시각화 입력은
 * lib/play3d-stats·play3d-format 파생 함수를 useMemo 로. PASS/FAIL 판정은
 * 두지 않는다.
 */
export function Play3dReportPanel({ className }: { className?: string }) {
  const { t } = useTranslation();
  const stats = usePlay3dStats();
  const meta = usePlay3dStatsMeta();
  const transport = usePlay3dTransport();
  const replayDurations = useReplayPlayerStore((s) => s.frameDurationsMs);
  const replayFrames = useReplayPlayerStore((s) => s.frames);
  const tagDefs = useVirtualTagStore((s) => s.tags);
  const sceneInfo = useSceneInfoStore(
    (s) => s.sceneInfoByRegion[meta.regionId] ?? null,
  );
  const [eventFilter, setEventFilter] = useState('all');

  const lastEventMs =
    stats.events.length > 0 ? stats.events[stats.events.length - 1].atMs : 0;
  // 반복 시나리오는 경과가 길이를 넘어 자란다 — 축도 함께 자라야 표식이 끝에 쌓이지 않는다.
  const axisMs = reportAxisMs(
    transport.durationMs,
    stats.windowEndMs,
    lastEventMs,
  );
  const isReplay = meta.source === 'replay';

  const noTagMappings = useMemo(
    () => sceneInfo !== null && collectSceneTagKeys(sceneInfo).length === 0,
    [sceneInfo],
  );

  const derived = useMemo(() => {
    const end = stats.windowEndMs;
    const rowIds = new Set(stats.equipment.map((e) => e.modelId));
    const strips = assignZoneBandsToRows(zoneBands(stats.events, end), rowIds);
    const tagRows = stats.tags.map((stat) => {
      const def =
        meta.source === 'simulation'
          ? tagDefs.find((d) => d.key === stat.key)
          : undefined;
      return {
        stat,
        range: tagRangeBar(stat, def ? { min: def.min, max: def.max } : null),
        ...tagRowLabel(stat.key, {
          source: meta.source,
          defs: tagDefs,
          scene: sceneInfo,
        }),
      };
    });
    return {
      equipmentRows: stats.equipment.map((eq) => ({
        modelId: eq.modelId,
        name: eq.name,
        bands: statusBands(
          stats.statusTransitions,
          eq.modelId,
          end,
          stats.scanned,
        ),
        zoneBands: strips.get(eq.modelId) ?? [],
      })),
      collisions: stats.events.filter((e) => e.kind === 'collision'),
      zoneEnters: stats.events.filter((e) => e.kind === 'zoneEnter'),
      tagRows,
      saturationLabel:
        tagRows.find((r) => r.stat.key === stats.summary.saturation.key)
          ?.label ?? null,
    };
  }, [stats, meta.source, tagDefs, sceneInfo]);

  const eventTime = (e: Play3dEvent): string => {
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

  const windowLabel = isReplay
    ? [
        formatReplayTimestamp(meta.replayFrom, 'datetime'),
        formatReplayTimestamp(meta.replayTo, 'time'),
      ]
        .filter(Boolean)
        .join(' ~ ') || t('common:replay.noData')
    : (meta.scenarioName ?? t('monitoring:simulation.none'));

  const coverage = coverageRatio(stats.scannedMs, stats.windowEndMs);
  const topPair = stats.collisions.byPair[0];
  const collisionHint = [
    stats.collisions.firstAtMs !== null
      ? t('monitoring:play3d.tile.firstAt', {
          time: formatSimClock(stats.collisions.firstAtMs),
        })
      : null,
    topPair
      ? t('monitoring:play3d.tile.topPair', {
          pair: topPair.label,
          count: topPair.count,
        })
      : null,
  ]
    .filter((s): s is string => s !== null)
    .join(' · ');
  const { summary } = stats;

  return (
    <div
      data-slot="play3d-report-panel"
      className={cn(
        '@container flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3 text-xs',
        className,
      )}
    >
      {/* 헤더 */}
      <div className="min-w-0">
        <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.14em] uppercase">
          {t('monitoring:play3d.report')}
        </p>
        <p className="truncate font-medium" title={windowLabel}>
          {t(
            isReplay
              ? 'monitoring:play3d.sourceReplay'
              : 'monitoring:play3d.sourceSimulation',
          )}{' '}
          · {windowLabel}
        </p>
        <p className="text-muted-foreground font-mono text-[10px] tabular-nums">
          {t('monitoring:play3d.window')} {formatSimClock(0)}~
          {formatSimClock(stats.windowEndMs)} · {t('monitoring:play3d.scanned')}{' '}
          {formatSimClock(stats.scannedMs)}
          {coverage !== null ? ` (${formatRatio(coverage)})` : null}
          {stats.loopIteration !== null && meta.scenarioLoop
            ? ` · ${t('monitoring:play3d.iteration', { n: stats.loopIteration + 1 })}`
            : null}
          {stats.holds.count > 0
            ? ` · ${t('monitoring:play3d.holdsSummary', {
                count: stats.holds.count,
                time: formatSimClock(stats.holds.wallMs),
              })}`
            : null}
        </p>
      </div>
      {stats.detectionOffSeen ? (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-700 dark:text-amber-300">
          {t('monitoring:play3d.detectionOff')}
        </p>
      ) : null}
      {noTagMappings ? (
        <p className="text-muted-foreground bg-muted/60 rounded-md border px-2 py-1 text-[10px]">
          {t('monitoring:play3d.noTagMappings')}
        </p>
      ) : null}

      {/* KPI */}
      <div className="grid grid-cols-2 gap-2 @lg:grid-cols-4">
        <Play3dKpiCard
          label={t('monitoring:play3d.tile.collisions')}
          value={String(stats.collisions.count)}
          tone={stats.collisions.count > 0 ? 'bad' : 'neutral'}
          hint={collisionHint || undefined}
        />
        <Play3dKpiCard
          label={t('monitoring:play3d.tile.intrusions')}
          value={String(stats.zones.enters)}
          tone={
            stats.zones.stopEnters > 0
              ? 'bad'
              : stats.zones.enters > 0
                ? 'warn'
                : 'neutral'
          }
          hint={`${t('monitoring:play3d.tile.stopEnters', { count: stats.zones.stopEnters })} · ${t('monitoring:play3d.tile.dwellTotal', { time: formatSimClock(stats.zones.dwellMs) })}`}
        />
        <Play3dKpiCard
          label={t('monitoring:play3d.tile.running')}
          value={formatRatio(summary.runningRatio)}
          tone="neutral"
          hint={`${t('monitoring:play3d.tile.equipmentCount', { count: summary.equipmentCount })} · ${t('monitoring:play3d.tile.idleRatio', { ratio: formatRatio(summary.idleRatio) })}`}
        />
        {isReplay ? (
          <Play3dKpiCard
            label={t('monitoring:play3d.tile.offline')}
            value={String(summary.offlineEpisodes)}
            tone={summary.offlineEpisodes > 0 ? 'warn' : 'neutral'}
            hint={t('monitoring:play3d.tile.offlineTotal', {
              time: formatSimClock(summary.offlineMs),
            })}
          />
        ) : (
          <Play3dKpiCard
            label={t('monitoring:play3d.tile.saturation')}
            value={formatRatio(summary.saturation.maxRatio)}
            tone={
              summary.saturation.maxRatio !== null &&
              summary.saturation.maxRatio > 0
                ? 'warn'
                : 'neutral'
            }
            hint={
              derived.saturationLabel ??
              t('monitoring:play3d.tile.noSpeedLimit')
            }
          />
        )}
      </div>

      {/* 타임라인 */}
      <Section title={t('monitoring:play3d.timeline.title')}>
        <Play3dReportTimeline
          axisMs={axisMs}
          windowEndMs={stats.windowEndMs}
          isPlaying={transport.isPlaying}
          scanned={stats.scanned}
          collisions={derived.collisions}
          zoneEnters={derived.zoneEnters}
          equipment={derived.equipmentRows}
          onSeek={(ms) => transport.seek(ms)}
        />
        <p className="text-muted-foreground flex flex-wrap gap-x-2 text-[9px]">
          <LegendMark
            color={PLAY3D_STATUS_FILL.running}
            label={t('monitoring:runtimeStatus.running')}
          />
          <LegendMark
            color={PLAY3D_STATUS_FILL.idle}
            label={t('monitoring:runtimeStatus.idle')}
          />
          {isReplay ? (
            <LegendMark
              color={PLAY3D_STATUS_FILL.offline}
              label={t('monitoring:runtimeStatus.offline')}
            />
          ) : null}
          <LegendMark
            shape="bar"
            className="bg-amber-400"
            label={t('monitoring:play3d.timeline.zoneDwell')}
          />
          <LegendMark
            shape="tick"
            className="bg-red-500"
            label={t('monitoring:play3d.event.collision')}
          />
        </p>
      </Section>

      {/* 상세 — 접이식 */}
      <Disclosure
        key="events"
        title={t('monitoring:play3d.events')}
        summary={t('monitoring:play3d.summary.events', {
          count: stats.events.length,
        })}
        defaultOpen
      >
        <EventList
          events={stats.events}
          filter={eventFilter}
          onFilterChange={setEventFilter}
          timeLabel={eventTime}
          onSeek={(e) => seekMs(e.atMs, e.frameIndex)}
        />
      </Disclosure>
      <Disclosure
        key="equipment"
        title={t('monitoring:play3d.equipment')}
        summary={t('monitoring:play3d.summary.equipment', {
          count: summary.equipmentCount,
          ratio: formatRatio(summary.runningRatio),
        })}
      >
        {stats.equipment.length === 0 ? (
          <Empty>{t('monitoring:play3d.noData')}</Empty>
        ) : (
          <EquipmentTable rows={stats.equipment} showOffline={isReplay} />
        )}
      </Disclosure>
      {stats.zones.byZone.length > 0 ? (
        <Disclosure
          key="zones"
          title={t('monitoring:play3d.zones')}
          summary={t('monitoring:play3d.summary.zones', {
            count: stats.zones.byZone.length,
            enters: stats.zones.enters,
            time: formatSimClock(stats.zones.dwellMs),
          })}
        >
          <ZoneTable
            rows={stats.zones.byZone}
            maxDwellMs={stats.zones.maxDwellMs}
          />
        </Disclosure>
      ) : null}
      <Disclosure
        key="tags"
        title={t('monitoring:play3d.tags')}
        summary={t('monitoring:play3d.summary.tags', {
          count: derived.tagRows.length,
        })}
      >
        {derived.tagRows.length === 0 ? (
          <Empty>{t('monitoring:play3d.noData')}</Empty>
        ) : (
          <TagTable rows={derived.tagRows} showSaturation={!isReplay} />
        )}
      </Disclosure>
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

/**
 * 접이식 상세 섹션 — 네이티브 details. `open` 은 리터럴 초기값만 넘긴다(데이터로
 * 파생하면 리렌더가 사용자의 접기·펼치기를 되돌린다).
 */
function Disclosure({
  title,
  summary,
  defaultOpen,
  children,
}: {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="group" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center gap-1.5 [&::-webkit-details-marker]:hidden">
        <ChevronDown
          aria-hidden
          className="text-muted-foreground size-3 shrink-0 transition-transform group-open:rotate-180"
        />
        <span className="text-muted-foreground text-[10px] font-semibold tracking-[0.14em] uppercase">
          {title}
        </span>
        {summary ? (
          <span
            className="text-muted-foreground ml-auto min-w-0 truncate font-mono text-[10px] tabular-nums"
            title={summary}
          >
            {summary}
          </span>
        ) : null}
      </summary>
      <div className="mt-1">{children}</div>
    </details>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground text-[10px]">{children}</p>;
}

/** 범례 표식 — 타임라인의 실제 모양과 같다(상태 = 사각, 체류 = 막대, 충돌 = 세로 선). */
function LegendMark({
  shape = 'dot',
  className,
  color,
  label,
}: {
  shape?: 'dot' | 'bar' | 'tick';
  className?: string;
  /** 상태 색처럼 lib 상수(hex)에서 오는 색. */
  color?: string | null;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        aria-hidden
        className={cn(
          'inline-block',
          shape === 'dot' && 'size-1.5',
          shape === 'bar' && 'h-1 w-3',
          shape === 'tick' && 'h-2.5 w-0.5',
          className,
        )}
        style={color ? { background: color } : undefined}
      />
      {label}
    </span>
  );
}
