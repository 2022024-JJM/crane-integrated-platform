import {
  CalendarRange,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FastForward,
  Pause,
  Play,
  Rewind,
  SkipBack,
  SkipForward,
  Square,
} from 'lucide-react';
import { useMemo } from 'react';
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
  eventTimeLabel,
  timelineAxisMs,
  transportMarks,
  transportTicks,
} from '../lib/play3d-format';
import { lastEventAtMs } from '../lib/play3d-stats';
import { formatSimClock } from '../lib/sim-clock';
import {
  readPlay3dPositionMs,
  usePlay3dTransport,
} from '../model/play3d-transport';
import { useRigLivePoll } from '../model/rig-live-readouts';
import { usePlay3dStatsStore } from '../model/use-play3d-stats-store';
import { useReplayPlayerStore } from '../model/use-replay-player-store';
import { Play3dTickRow } from './play3d-tick-row';
import { ReplaySearchForm } from './replay-search-form';
import { SimulationScenarioSelect } from './simulation-scenario-select';
import { TransportScrubber } from './transport-scrubber';

const JUMP_MS = 5_000;

/**
 * 3D 플레이 상단 트랜스포트 바 — ▶/⏸·이동, 시간 눈금과 사건 표식 띠(영역 체류
 * 구간 = 선보다 낮은 노란 박스, 충돌·정지·두절 = 세로 선, 리포트 타임라인과 같은
 * 모양·같은 시간 축·같은 hover 요약)가 곧 재생 축인 스크럽(`TransportScrubber` —
 * 재생선·지난 구간 채움·아래 삼각형 손잡이), 배속, 위치/길이, 소스별 슬롯
 * (리플레이=구간 검색 팝오버, 시뮬레이션=시나리오 선택). ▶ 바로 오른쪽의 종료는
 * 두 소스 공통(`transport.stop`). 소스 선택은 위의 탭(Play3dSourceTabs)이 한다. 두 소스의 차이는
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
      transportMarks(
        events,
        windowEndMs,
        (e) => eventTimeLabel(e, replayFrames),
        reachedMs,
      ),
    // events 는 제자리 갱신이라 참조가 같다 — version 이 재계산의 키다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, windowEndMs, replayFrames, reachedMs, version],
  );

  const lengthLabel =
    durationMs !== null
      ? formatSimClock(durationMs)
      : t('monitoring:play3d.openEnded');
  const stopLabel = t(
    source === 'replay' ? 'common:replay.stop' : 'monitoring:simulation.stop',
  );

  return (
    <div
      data-slot="play3d-transport-bar"
      className={cn(
        'bg-background/95 border-border/60 flex shrink-0 flex-col gap-1.5 border-b px-3 py-2 backdrop-blur-sm',
        className,
      )}
    >
      {/* 시간 눈금 + 스크럽(사건 표식 띠 · 재생선 · 아래 삼각형) */}
      <div className="flex flex-col gap-0.5">
        {/* 눈금·띠는 같은 전체 너비 — 좌우 여백을 두지 않는다. */}
        <Play3dTickRow
          ticks={transportTicks(axisMs)}
          axisMs={axisMs}
          className="h-3 leading-3"
        />
        {/* 열린 구간(시뮬레이션)도 축 전체를 끈다 — 재생 중엔 삼각형이 오른쪽
            끝(닿은 지점)에 붙고, 왼쪽으로 끌면 그 시점부터 이어서 재생된다. */}
        <TransportScrubber
          marks={marks}
          axisMs={axisMs}
          disabled={!hasContent}
          onSeek={transport.seek}
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
                  <span className="text-box-cap text-[11px]">
                    {formatRangeLabel(search.viewingFrom, search.viewingTo)}
                  </span>
                  <ChevronDown className="size-3 opacity-60" />
                </Button>
              }
            />
            <PopoverPopup align="start" side="bottom" className="w-72 p-4">
              <ReplaySearchForm
                bare
                draftStart={search.draftStart}
                onDraftStartChange={search.setDraftStart}
                onResetDraftStart={search.resetDraftStart}
                draftEnd={search.draftEnd}
                duration={search.duration}
                durations={search.durations}
                onDurationChange={search.setDuration}
                onSearch={search.submitSearch}
                canSearch={search.canSearch}
                validationReason={search.validationReason}
                isLoading={search.isLoading}
                isError={search.isError}
                isEmpty={search.isEmpty}
                errorMessage={search.errorMessage}
              />
            </PopoverPopup>
          </Popover>
        ) : null}
        {source === 'simulation' ? <SimulationScenarioSelect /> : null}

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
        {/* 종료 — 멈추고 처음으로(시뮬레이션은 자세 rest). 일시정지와 다르다. */}
        <Button
          variant="ghost"
          size="icon-sm"
          className="hover:text-red-400"
          disabled={!hasContent}
          onClick={transport.stop}
          title={stopLabel}
          aria-label={stopLabel}
        >
          <Square className="size-4" />
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
              className="h-6 px-1.5 text-[10px]"
            >
              ×{option}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        {/* 위치 */}
        <div className="text-muted-foreground ml-auto flex items-center gap-2 text-[11px] tabular-nums">
          {hasContent ? (
            <>
              <span className="text-foreground">
                {formatSimClock(positionMs)}
              </span>
              <span>/ {lengthLabel}</span>
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
