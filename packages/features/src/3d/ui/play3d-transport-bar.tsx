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
import { memo, useMemo, useState } from 'react';
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@crane/ui/molecules/tooltip';
import { createTooltipHandle } from '@crane/ui/molecules/tooltip-handle';
import {
  PLAY3D_DWELL_BOX_CLASS,
  PLAY3D_DWELL_HATCH,
  PLAY3D_DWELL_TONE,
  PLAY3D_EVENT_COLORS,
  bandPercent,
  eventTimeLabel,
  markerPercent,
  markerSeekTargetMs,
  timelineAxisMs,
  transportMarks,
  transportTicks,
  type Play3dHoverPayload,
  type TransportMarks,
} from '../lib/play3d-format';
import { lastEventAtMs } from '../lib/play3d-stats';
import { formatSimClock } from '../lib/sim-clock';
import {
  readPlay3dPositionMs,
  readPlay3dTransport,
  usePlay3dTransport,
} from '../model/play3d-transport';
import { useRigLivePoll } from '../model/rig-live-readouts';
import { usePlay3dStatsStore } from '../model/use-play3d-stats-store';
import { useReplayPlayerStore } from '../model/use-replay-player-store';
import { Play3dHoverSummary } from './play3d-hover-summary';
import { Play3dTickRow } from './play3d-tick-row';
import { ReplaySearchForm } from './replay-search-form';
import { SceneSimulationPanel } from './scene-simulation-panel';

const JUMP_MS = 5_000;

/**
 * 3D 플레이 상단 트랜스포트 바 — ▶/⏸·이동, 시간 눈금과 사건 표식 띠(영역 체류
 * 구간 = 대각선 박스, 충돌·정지·두절 = 세로 선, 리포트 타임라인과 같은 모양·
 * 같은 시간 축·같은 hover 요약)가 얹힌 스크럽, 배속, 위치/길이, 소스별 슬롯
 * (리플레이=구간 검색 팝오버, 시뮬레이션=시계 패널 팝오버). 소스 선택은 위의 탭(Play3dSourceTabs)이 한다. 두 소스의 차이는
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
  const reachedMs = usePlay3dStatsStore((s) => s.data.reachedMs);
  const windowEndMs = usePlay3dStatsStore((s) => s.data.windowEndMs);
  const replayFrames = useReplayPlayerStore((s) => s.frames);
  const replayTimestamp = useReplayPlayerStore(
    (s) => s.frames[s.frameIndex]?.timestamp ?? null,
  );
  const replayFrameCount = useReplayPlayerStore((s) => s.frames.length);
  const replayFrameIndex = useReplayPlayerStore((s) => s.frameIndex);

  const { source, isPlaying, durationMs, hasContent, speed } = transport;
  const positionMs = readPlay3dPositionMs(source);
  // 리포트 타임라인과 같은 축 — 실행 중 줄지 않아 손잡이를 끌어도 값이 무너지지 않는다.
  const axisMs = timelineAxisMs(
    durationMs,
    positionMs,
    lastEventAtMs(events),
    reachedMs,
  );
  const atStart = positionMs <= 0;
  const atEnd = durationMs !== null && positionMs >= durationMs;
  const marks = useMemo(
    () =>
      transportMarks(events, windowEndMs, (e) =>
        eventTimeLabel(e, replayFrames),
      ),
    // events 는 제자리 갱신이라 참조가 같다 — version 이 재계산의 키다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, windowEndMs, replayFrames, version],
  );

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
      {/* 시간 눈금 + 사건 표식 띠 + 스크럽 */}
      <div className="flex flex-col gap-0.5">
        {/* mx-2 — range 손잡이가 양 끝에서 안쪽으로 들어오는 만큼(대략) 맞춘다. */}
        <Play3dTickRow
          ticks={transportTicks(axisMs)}
          axisMs={axisMs}
          className="mx-2 h-3 leading-3"
        />
        <TransportMarkStrip marks={marks} axisMs={axisMs} />
        {/* 열린 구간(시나리오 없음)도 축 전체를 끈다 — 재생 중엔 손잡이가 오른쪽
            끝(닿은 지점)에 붙고, 왼쪽으로 끌면 그 시점부터 이어서 재생된다. */}
        <input
          type="range"
          min={0}
          max={Math.max(1, Math.round(axisMs))}
          step={100}
          value={Math.min(Math.round(positionMs), Math.round(axisMs))}
          disabled={!hasContent}
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

/** 세로 선의 hover·클릭 영역 폭(px)과 그 안에서 선이 놓이는 위치(px). */
const LINE_HIT_PX = 8;
const LINE_INSET_PX = 3;

/** 표식 클릭 — 누르는 순간의 어댑터 스냅샷으로 이동한다(prop 으로 받지 않아 memo 가 산다). */
function seekToMark(atMs: number) {
  const transport = readPlay3dTransport();
  const replay = useReplayPlayerStore.getState();
  transport.seek(
    markerSeekTargetMs(
      atMs,
      transport.source,
      transport.source === 'replay'
        ? replay.frameDurationsMs[replay.frameIndex]
        : undefined,
    ),
  );
}

/**
 * 사건 표식 띠 — 바는 위치 폴링으로 계속 리렌더되므로 띠는 memo 로 떼어 표식이
 * 바뀔 때만 다시 그린다. 팝업 하나에 트리거 여럿(분리 트리거).
 */
const TransportMarkStrip = memo(function TransportMarkStrip({
  marks,
  axisMs,
}: {
  marks: TransportMarks;
  axisMs: number;
}) {
  const { t } = useTranslation();
  const [hover] = useState(() => createTooltipHandle<Play3dHoverPayload>());
  return (
    <div className="bg-foreground/10 relative mx-2 h-3 overflow-hidden">
      {/* Root 를 트리거보다 먼저 렌더한다. */}
      <Tooltip handle={hover} trackCursorAxis="x" disableHoverablePopup>
        {({ payload }) => (
          <TooltipContent className="max-w-64 animate-none! flex-col items-start gap-0.5 px-2 py-1.5 text-[11px]">
            {payload ? <Play3dHoverSummary payload={payload} /> : null}
          </TooltipContent>
        )}
      </Tooltip>
      {marks.zones.map((mark) => {
        const { left, width } = bandPercent(
          mark.band.fromMs,
          mark.band.toMs,
          axisMs,
        );
        return (
          <TooltipTrigger
            key={mark.key}
            handle={hover}
            payload={mark.payload}
            delay={0}
            render={<button type="button" tabIndex={-1} />}
            aria-label={t('monitoring:play3d.timeline.zoneDwell')}
            className={cn(
              'absolute inset-y-0 min-w-1.5 cursor-pointer',
              PLAY3D_DWELL_BOX_CLASS,
              PLAY3D_DWELL_TONE[mark.band.level],
              mark.band.open && '[border-right-style:dashed]',
              mark.dim && 'opacity-30',
            )}
            style={{
              left: `${left}%`,
              width: `${width}%`,
              backgroundImage: PLAY3D_DWELL_HATCH,
            }}
            onClick={() => seekToMark(mark.band.fromMs)}
          />
        );
      })}
      {marks.lines.map((mark) => (
        <TooltipTrigger
          key={mark.key}
          handle={hover}
          payload={mark.payload}
          delay={0}
          render={<button type="button" tabIndex={-1} />}
          aria-label={t(`monitoring:play3d.event.${mark.event.kind}`)}
          className={cn(
            'absolute inset-y-0 cursor-pointer',
            mark.dim && 'opacity-30',
          )}
          style={{
            width: LINE_HIT_PX,
            left: `clamp(0px, calc(${markerPercent(mark.event.atMs, axisMs)}% - ${LINE_INSET_PX}px), calc(100% - ${LINE_HIT_PX}px))`,
          }}
          onClick={() => seekToMark(mark.event.atMs)}
        >
          <span
            className={cn(
              'absolute inset-y-0 w-0.5',
              PLAY3D_EVENT_COLORS[mark.event.kind],
            )}
            style={{ left: LINE_INSET_PX }}
          />
        </TooltipTrigger>
      ))}
    </div>
  );
});

function formatRangeLabel(viewingFrom: string, viewingTo: string): string {
  const from = formatReplayTimestamp(viewingFrom, 'datetime');
  const to = formatReplayTimestamp(viewingTo, 'time');
  if (from && to) return `${from} ~ ${to}`;
  return viewingFrom && viewingTo ? `${viewingFrom} ~ ${viewingTo}` : '';
}
