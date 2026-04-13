import { SkipBack, SkipForward, Play, Pause } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@crane/ui/atoms/button';
import { cn } from '@crane/core/lib/utils';
import { formatReplayTimestamp } from '@crane/domain/monitoring';
import { useReplayPlayerStore } from '../model/use-replay-player-store';

const SPEED_OPTIONS = [
  { value: 0.5, label: '0.5x' },
  { value: 1, label: '1x' },
  { value: 2, label: '2x' },
  { value: 4, label: '4x' },
] as const;

interface ReplayPlayerControlsProps {
  className?: string;
}

export function ReplayPlayerControls({ className }: ReplayPlayerControlsProps) {
  const { t } = useTranslation();

  const isPlaying = useReplayPlayerStore((s) => s.isPlaying);
  const frameIndex = useReplayPlayerStore((s) => s.frameIndex);
  const totalFrames = useReplayPlayerStore((s) => s.frames.length);
  const currentTimestamp = useReplayPlayerStore(
    (s) => s.frames[s.frameIndex]?.timestamp ?? null,
  );
  const speedMultiplier = useReplayPlayerStore((s) => s.speedMultiplier);
  const play = useReplayPlayerStore((s) => s.play);
  const pause = useReplayPlayerStore((s) => s.pause);
  const seekTo = useReplayPlayerStore((s) => s.seekTo);
  const setSpeed = useReplayPlayerStore((s) => s.setSpeed);

  const hasFrames = totalFrames > 0;

  const formattedTimestamp =
    formatReplayTimestamp(currentTimestamp, 'datetime') ?? '--';

  return (
    <div
      className={cn(
        'bg-background/85 border-border/60 flex flex-col gap-2 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-sm',
        className,
      )}
    >
      {/* 재생 컨트롤 행 */}
      <div className="flex items-center gap-2">
        {/* seek to start */}
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          disabled={!hasFrames || (frameIndex === 0 && !isPlaying)}
          onClick={() => seekTo(0)}
          title={t('common:replay.seekStart')}
        >
          <SkipBack className="size-4" />
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

        {/* seek to end */}
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          disabled={!hasFrames || frameIndex >= totalFrames - 1}
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
      </div>

      {/* 시크바 */}
      <input
        type="range"
        min={0}
        max={Math.max(0, totalFrames - 1)}
        value={frameIndex}
        disabled={!hasFrames}
        onChange={(e) => seekTo(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer accent-orange-500 disabled:cursor-not-allowed disabled:opacity-40"
      />

      {/* 프레임 정보 */}
      <div className="text-muted-foreground flex items-center justify-between text-xs">
        <span>
          {hasFrames
            ? t('common:replay.frameInfo', {
                current: frameIndex + 1,
                total: totalFrames,
              })
            : t('common:replay.noData')}
        </span>
        <span className="font-mono">{formattedTimestamp}</span>
      </div>
    </div>
  );
}
