import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Rewind,
  FastForward,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@crane/ui/atoms/button';
import { cn } from '@crane/core/lib/utils';
import { formatReplayTimestamp } from '@crane/domain/monitoring';
import { useReplayPlayerStore } from '../model/use-replay-player-store';

const JUMP_MS = 5_000;
const TICK_COUNT = 10;

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function cumulativeMs(durations: readonly number[], upToIndex: number): number {
  let sum = 0;
  for (let i = 0; i < upToIndex && i < durations.length; i += 1) {
    sum += durations[i] ?? 0;
  }
  return sum;
}

const SPEED_OPTIONS = [
  { value: 0.5, label: '0.5x' },
  { value: 1, label: '1x' },
  { value: 2, label: '2x' },
  { value: 4, label: '4x' },
  { value: 8, label: '8x' },
] as const;

interface ReplayPlayerControlsProps {
  className?: string;
  searchSlot?: ReactNode;
}

export function ReplayPlayerControls({
  className,
  searchSlot,
}: ReplayPlayerControlsProps) {
  const { t } = useTranslation();

  const isPlaying = useReplayPlayerStore((s) => s.isPlaying);
  const frameIndex = useReplayPlayerStore((s) => s.frameIndex);
  const totalFrames = useReplayPlayerStore((s) => s.frames.length);
  const currentTimestamp = useReplayPlayerStore(
    (s) => s.frames[s.frameIndex]?.timestamp ?? null,
  );
  const frameDurationsMs = useReplayPlayerStore((s) => s.frameDurationsMs);
  const speedMultiplier = useReplayPlayerStore((s) => s.speedMultiplier);
  const play = useReplayPlayerStore((s) => s.play);
  const pause = useReplayPlayerStore((s) => s.pause);
  const seekTo = useReplayPlayerStore((s) => s.seekTo);
  const seekByFrames = useReplayPlayerStore((s) => s.seekByFrames);
  const seekByMs = useReplayPlayerStore((s) => s.seekByMs);
  const setSpeed = useReplayPlayerStore((s) => s.setSpeed);

  const hasFrames = totalFrames > 0;
  const atStart = frameIndex === 0;
  const atEnd = frameIndex >= totalFrames - 1;

  const formattedTimestamp =
    formatReplayTimestamp(currentTimestamp, 'time') ?? '--';

  const totalDurationMs = useMemo(
    () => frameDurationsMs.reduce((acc, d) => acc + (d ?? 0), 0),
    [frameDurationsMs],
  );
  const elapsedMs = useMemo(
    () => cumulativeMs(frameDurationsMs, frameIndex),
    [frameDurationsMs, frameIndex],
  );
  const formattedElapsed = `${formatElapsed(elapsedMs)} / ${formatElapsed(totalDurationMs)}`;

  const thumbPercent =
    hasFrames && totalFrames > 1 ? (frameIndex / (totalFrames - 1)) * 100 : 0;

  const tickPositions = useMemo(
    () =>
      Array.from({ length: TICK_COUNT + 1 }, (_, i) => (i / TICK_COUNT) * 100),
    [],
  );

  return (
    <div
      className={cn(
        'bg-background/85 border-border/60 flex flex-col gap-1.5 border-b px-10 py-2 shadow-lg backdrop-blur-sm',
        className,
      )}
    >
      {/* 시크바 + 눈금 (풀폭) */}
      <div className="relative pt-6">
        {/* thumb 너비 12px(size-3) 기준으로 라벨 위치 보정 */}
        {hasFrames ? (
          <div
            aria-hidden
            className="pointer-events-none absolute top-0 z-20 flex -translate-x-1/2 flex-col items-center"
            style={{
              left: `calc(${thumbPercent}% + 6px - ${(thumbPercent / 100) * 12}px)`,
            }}
          >
            <span className="bg-orange-500 text-white rounded-sm px-1.5 py-0.5 font-mono text-[11px] leading-tight whitespace-nowrap shadow-md">
              {formattedTimestamp}
            </span>
            <span
              aria-hidden
              className="-mt-px size-0 border-x-[5px] border-t-[5px] border-x-transparent border-t-orange-500"
            />
          </div>
        ) : null}
        <input
          type="range"
          min={0}
          max={Math.max(0, totalFrames - 1)}
          value={frameIndex}
          disabled={!hasFrames}
          onChange={(e) => seekTo(Number(e.target.value))}
          className="[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:bg-orange-500 [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:rounded-full [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:bg-orange-500 [&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 relative z-10 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border/60 disabled:cursor-not-allowed disabled:opacity-40"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-5 h-1.5 -translate-y-1/2"
        >
          {tickPositions.map((pct, i) => (
            <span
              key={i}
              className="bg-border/80 absolute top-0 h-full w-px"
              style={{ left: `${pct}%` }}
            />
          ))}
        </div>
      </div>

      {/* 컨트롤 행 (풀폭) */}
      <div className="flex items-center gap-2">
        {searchSlot}
        {searchSlot ? <div className="bg-border mx-1 h-5 w-px" /> : null}

        {/* seek to start */}
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          disabled={!hasFrames || (atStart && !isPlaying)}
          onClick={() => seekTo(0)}
          title={t('common:replay.seekStart')}
        >
          <SkipBack className="size-4" />
        </Button>

        {/* -5s */}
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          disabled={!hasFrames || atStart}
          onClick={() => seekByMs(-JUMP_MS)}
          title={t('common:replay.jumpBack')}
        >
          <Rewind className="size-4" />
        </Button>

        {/* -1 frame */}
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          disabled={!hasFrames || atStart || isPlaying}
          onClick={() => seekByFrames(-1)}
          title={t('common:replay.stepBack')}
        >
          <ChevronLeft className="size-4" />
        </Button>

        {/* play / pause */}
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          disabled={!hasFrames}
          onClick={() => (isPlaying ? pause() : play())}
          title={isPlaying ? t('common:replay.pause') : t('common:replay.play')}
        >
          {isPlaying ? (
            <Pause className="size-4" />
          ) : (
            <Play className="size-4" />
          )}
        </Button>

        {/* +1 frame */}
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          disabled={!hasFrames || atEnd || isPlaying}
          onClick={() => seekByFrames(1)}
          title={t('common:replay.stepForward')}
        >
          <ChevronRight className="size-4" />
        </Button>

        {/* +5s */}
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          disabled={!hasFrames || atEnd}
          onClick={() => seekByMs(JUMP_MS)}
          title={t('common:replay.jumpForward')}
        >
          <FastForward className="size-4" />
        </Button>

        {/* seek to end */}
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          disabled={!hasFrames || atEnd}
          onClick={() => seekTo(totalFrames - 1)}
          title={t('common:replay.seekEnd')}
        >
          <SkipForward className="size-4" />
        </Button>

        <div className="bg-border mx-1 h-5 w-px" />

        {/* 속도 */}
        <span className="text-muted-foreground mr-1 text-xs">
          {t('common:replay.speed')}
        </span>
        <div className="flex items-center gap-0.5">
          {SPEED_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setSpeed(value)}
              className={cn(
                'rounded px-2 py-0.5 text-xs font-medium transition-colors',
                speedMultiplier === value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 우측 정보 영역 */}
        <div className="text-muted-foreground ml-auto flex items-center gap-3 text-xs">
          {hasFrames ? (
            <span className="font-mono">{formattedElapsed}</span>
          ) : (
            <span>{t('common:replay.noData')}</span>
          )}
        </div>
      </div>
    </div>
  );
}
