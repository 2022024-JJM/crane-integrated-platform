import {
  CalendarRange,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FastForward,
  Gauge,
  Pause,
  Play,
  Rewind,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@crane/core/lib/utils';
import {
  formatReplayTimestamp,
  type MonitoringReplayUiState,
} from '@crane/domain/monitoring';
import { Button } from '@crane/ui/atoms/button';
import {
  Popover,
  PopoverPopup,
  PopoverTrigger,
} from '@crane/ui/molecules/popover';
import { ToggleGroup, ToggleGroupItem } from '@crane/ui/molecules/toggle-group';
import {
  PLAY3D_EVENT_COLORS,
  PLAY3D_MARKER_KINDS,
  markerPercent,
  markerSeekLeadMs,
  timelineAxisMs,
} from '../lib/play3d-format';
import { formatSimClock } from '../lib/sim-clock';
import {
  readPlay3dPositionMs,
  usePlay3dTransport,
} from '../model/play3d-transport';
import { useRigLivePoll } from '../model/rig-live-readouts';
import { usePlay3dStatsStore } from '../model/use-play3d-stats-store';
import { useReplayPlayerStore } from '../model/use-replay-player-store';
import { ReplaySearchForm } from './replay-search-form';
import { SceneSimulationPanel } from './scene-simulation-panel';

const JUMP_MS = 5_000;

/**
 * 3D 플레이 상단 트랜스포트 바 — ▶/⏸·이동, 사건 마커 띠가 얹힌 스크럽, 배속,
 * 위치/길이, 소스별 슬롯(리플레이=구간 검색 팝오버, 시뮬레이션=시계 패널
 * 팝오버). 소스 선택은 위의 탭(Play3dSourceTabs)이 한다. 두 소스의 차이는
 * 트랜스포트 어댑터(play3d-transport) 뒤에 숨고 여기서는 소스 슬롯만 갈린다.
 *
 * 캔버스 위 별도 행(오버레이가 아님)이라 HUD·좌상단 열과 겹치지 않는다(옛
 * 리플레이 바는 캔버스 오버레이라 그 둘을 덮었다). 위치는 폴링으로 읽는다
 * (200ms).
 */
export function Play3dTransportBar({
  search,
  className,
}: {
  /** 리플레이 구간 검색 상태(앱 페이지가 든다). 없으면 검색 슬롯을 두지 않는다. */
  search?: MonitoringReplayUiState;
  className?: string;
}) {
  const { t } = useTranslation();
  useRigLivePoll(200);
  const transport = usePlay3dTransport();
  const version = usePlay3dStatsStore((s) => s.version);
  const events = usePlay3dStatsStore((s) => s.data.events);
  const windowEndMs = usePlay3dStatsStore((s) => s.data.windowEndMs);
  const replayTimestamp = useReplayPlayerStore(
    (s) => s.frames[s.frameIndex]?.timestamp ?? null,
  );
  const replayFrameCount = useReplayPlayerStore((s) => s.frames.length);
  const replayFrameIndex = useReplayPlayerStore((s) => s.frameIndex);
  const replayDurations = useReplayPlayerStore((s) => s.frameDurationsMs);

  const { source, isPlaying, durationMs, hasContent, speed } = transport;
  const positionMs = readPlay3dPositionMs(source);
  const lastEventMs = events.length > 0 ? events[events.length - 1].atMs : 0;
  const axisMs = timelineAxisMs(durationMs, positionMs, lastEventMs);
  const scrubbable = hasContent && durationMs !== null && durationMs > 0;
  const atStart = positionMs <= 0;
  const atEnd = durationMs !== null && positionMs >= durationMs;
  // version 은 마커 띠의 재계산 키 — events 는 제자리 갱신이라 참조가 같다.
  void version;

  const seekMarker = (atMs: number) => {
    const lead = markerSeekLeadMs(
      source,
      source === 'replay' ? replayDurations[replayFrameIndex] : undefined,
    );
    transport.seek(Math.max(0, atMs - lead));
  };

  const positionLabel =
    source === 'replay'
      ? (formatReplayTimestamp(replayTimestamp, 'time') ?? '--:--:--')
      : formatSimClock(positionMs);
  const lengthLabel =
    durationMs !== null
      ? formatSimClock(durationMs)
      : t('monitoring:play3d.openEnded');

  return (
    <div
      data-slot="play3d-transport-bar"
      className={cn(
        'bg-background/95 border-border/60 flex shrink-0 flex-col gap-1.5 border-b px-3 py-2 backdrop-blur-sm',
        className,
      )}
    >
      {/* 마커 띠 + 스크럽 */}
      <div className="relative pt-3">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-2.5"
        >
          {events
            .filter((e) => PLAY3D_MARKER_KINDS.includes(e.kind))
            .map((e) => (
              <button
                key={e.id}
                type="button"
                title={`${formatSimClock(e.atMs)} · ${t(`monitoring:play3d.event.${e.kind}`)} · ${e.label}`}
                aria-label={t(`monitoring:play3d.event.${e.kind}`)}
                className={cn(
                  'pointer-events-auto absolute top-0 h-2.5 w-1 -translate-x-1/2 cursor-pointer rounded-sm',
                  PLAY3D_EVENT_COLORS[e.kind],
                  e.atMs > windowEndMs && 'opacity-30',
                )}
                style={{ left: `${markerPercent(e.atMs, axisMs)}%` }}
                onClick={() => seekMarker(e.atMs)}
              />
            ))}
        </div>
        <input
          type="range"
          min={0}
          max={Math.max(1, Math.round(axisMs))}
          step={100}
          value={Math.min(Math.round(positionMs), Math.round(axisMs))}
          disabled={!scrubbable}
          aria-label={t('monitoring:play3d.seek')}
          onChange={(event) => transport.seek(Number(event.target.value))}
          className="accent-primary h-1.5 w-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
        />
      </div>

      <div className="flex items-center gap-2">
        {/* 소스별 슬롯 */}
        {source === 'replay' && search ? (
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 px-2"
                >
                  <CalendarRange className="size-3.5" />
                  <span className="font-mono text-[11px]">
                    {formatRangeLabel(search.viewingFrom, search.viewingTo)}
                  </span>
                  <ChevronDown className="size-3 opacity-60" />
                </Button>
              }
            />
            <PopoverPopup align="start" side="bottom" className="w-72 p-3">
              <ReplaySearchForm
                bare
                draftFrom={search.draftFrom}
                draftTo={search.draftTo}
                onDraftFromChange={search.setDraftFrom}
                onDraftToChange={search.setDraftTo}
                onSearch={search.submitSearch}
                canSearch={search.canSearch}
                validationReason={search.validationReason}
                isLoading={search.isLoading}
                isError={search.isError}
                errorMessage={search.errorMessage}
              />
            </PopoverPopup>
          </Popover>
        ) : null}
        {source === 'simulation' ? (
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 px-2"
                >
                  <Gauge className="size-3.5" />
                  <span className="text-[11px]">
                    {t('monitoring:simulation.title')}
                  </span>
                  <ChevronDown className="size-3 opacity-60" />
                </Button>
              }
            />
            <PopoverPopup align="start" side="bottom" className="w-72 p-3">
              <SceneSimulationPanel />
            </PopoverPopup>
          </Popover>
        ) : null}

        <div className="bg-border mx-1 h-5 w-px" />

        {/* 이동·재생 */}
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={!hasContent || atStart}
          onClick={() => transport.seek(0)}
          title={t('common:replay.seekStart')}
        >
          <SkipBack className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={!hasContent || atStart}
          onClick={() => transport.seek(Math.max(0, positionMs - JUMP_MS))}
          title={t('common:replay.jumpBack')}
        >
          <Rewind className="size-4" />
        </Button>
        {source === 'replay' ? (
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={!hasContent || replayFrameIndex <= 0 || isPlaying}
            onClick={() => transport.stepFrames(-1)}
            title={t('common:replay.stepBack')}
          >
            <ChevronLeft className="size-4" />
          </Button>
        ) : null}
        <Button
          variant="outline"
          size="icon-sm"
          disabled={!hasContent}
          onClick={() => (isPlaying ? transport.pause() : transport.play())}
          title={isPlaying ? t('common:replay.pause') : t('common:replay.play')}
          aria-pressed={isPlaying}
        >
          {isPlaying ? (
            <Pause className="size-4" />
          ) : (
            <Play className="size-4" />
          )}
        </Button>
        {source === 'replay' ? (
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={
              !hasContent ||
              replayFrameIndex >= replayFrameCount - 1 ||
              isPlaying
            }
            onClick={() => transport.stepFrames(1)}
            title={t('common:replay.stepForward')}
          >
            <ChevronRight className="size-4" />
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={!hasContent || atEnd}
          onClick={() => transport.seek(positionMs + JUMP_MS)}
          title={t('common:replay.jumpForward')}
        >
          <FastForward className="size-4" />
        </Button>
        {durationMs !== null ? (
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={!hasContent || atEnd}
            onClick={() => transport.seek(durationMs)}
            title={t('common:replay.seekEnd')}
          >
            <SkipForward className="size-4" />
          </Button>
        ) : null}

        <div className="bg-border mx-1 h-5 w-px" />

        {/* 배속 */}
        <span className="text-muted-foreground text-[11px]">
          {t('common:replay.speed')}
        </span>
        <ToggleGroup
          value={[String(speed)]}
          onValueChange={(next) => {
            const choice = Number(next[0]);
            if (Number.isFinite(choice) && choice > 0)
              transport.setSpeed(choice);
          }}
          variant="outline"
          size="sm"
          aria-label={t('common:replay.speed')}
        >
          {transport.speedOptions.map((option) => (
            <ToggleGroupItem
              key={option}
              value={String(option)}
              className="h-6 px-1.5 font-mono text-[10px]"
            >
              ×{option}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        {/* 위치 */}
        <div className="text-muted-foreground ml-auto flex items-center gap-2 font-mono text-[11px] tabular-nums">
          {hasContent ? (
            <>
              <span className="text-foreground">{positionLabel}</span>
              <span>
                {formatSimClock(positionMs)} / {lengthLabel}
              </span>
            </>
          ) : (
            <span>{t('common:replay.noData')}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function formatRangeLabel(viewingFrom: string, viewingTo: string): string {
  const from = formatReplayTimestamp(viewingFrom, 'datetime');
  const to = formatReplayTimestamp(viewingTo, 'time');
  if (from && to) return `${from} ~ ${to}`;
  return viewingFrom && viewingTo ? `${viewingFrom} ~ ${viewingTo}` : '';
}
