import { Pause, Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  clampPlaybackSpeed,
  DEFAULT_PLAYBACK_SPEED,
  formatClipTime,
  PLAYBACK_SPEED_MAX,
  PLAYBACK_SPEED_MIN,
  PLAYBACK_SPEED_STEP,
  REST_POSE_CLIP,
  type PlaybackClip,
  type PlaybackClock,
} from '@crane/features/asset-library';
import { Button } from '@crane/ui/atoms/button';
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
} from '@crane/ui/molecules/select';
import { usePlaybackTick } from '../model/use-playback-tick';

/** 재생 위치를 다시 읽는 간격. */
const POSITION_POLL_MS = 100;
const SEEK_STEP_SEC = 0.01;

interface AssetPlaybackBarProps {
  clips: readonly PlaybackClip[];
  /** 지금 도는 클립. null 이면 애니메이션 없이 기본 자세다. */
  clip: PlaybackClip | null;
  playing: boolean;
  speed: number;
  clock: PlaybackClock;
  onPlayingChange: (playing: boolean) => void;
  /** 클립 이름 또는 `REST_POSE_CLIP`. */
  onClipChange: (name: string) => void;
  onSpeedChange: (speed: number) => void;
  onSeek: (timeSec: number) => void;
}

/**
 * 뷰어 아래 재생 줄 — ▶/⏸ · 클립 선택(맨 위는 "애니메이션 없음", 그 아래 이름 +
 * 길이) · 위치 스크럽과 위치/길이 · 배속 슬라이더. 캔버스 위 오버레이가
 * 아니라 캔버스 아래 별도 행이라 우하단 시점 묶음과 겹치지 않는다(3D 플레이
 * 트랜스포트 바와 같은 자리잡기). 기본 자세를 고르면 클립 선택만 남기고
 * 나머지는 비활성이다.
 */
export function AssetPlaybackBar({
  clips,
  clip,
  playing,
  speed,
  clock,
  onPlayingChange,
  onClipChange,
  onSpeedChange,
  onSeek,
}: AssetPlaybackBarProps) {
  const { t } = useTranslation();
  const resting = clip === null;
  const [, bump] = usePlaybackTick(playing && !resting, POSITION_POLL_MS);
  const durationSec = clip?.durationSec ?? 0;
  const position = Math.min(clock.getTime(), durationSec);
  const restLabel = t('asset-library:viewer.restPose');

  return (
    <div
      data-slot="asset-playback-bar"
      role="group"
      aria-label={t('asset-library:viewer.playback')}
      className="border-border bg-background/95 flex shrink-0 flex-wrap items-center gap-2 border-t px-3 py-2"
    >
      <Button
        variant="outline"
        size="icon-sm"
        disabled={resting}
        aria-pressed={playing}
        title={playing ? t('common:replay.pause') : t('common:replay.play')}
        onClick={() => onPlayingChange(!playing)}
      >
        {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
      </Button>

      <Select value={clip?.name ?? REST_POSE_CLIP} onValueChange={onClipChange}>
        <SelectTrigger
          aria-label={t('asset-library:viewer.clip')}
          label={clip?.name ?? restLabel}
          className="h-7 max-w-56"
        />
        <SelectPopup>
          <SelectItem value={REST_POSE_CLIP}>{restLabel}</SelectItem>
          {clips.map((item) => (
            <SelectItem key={item.name} value={item.name}>
              {item.name}
              <span className="text-muted-foreground ml-1.5 text-xs tabular-nums">
                {formatClipTime(item.durationSec)} s
              </span>
            </SelectItem>
          ))}
        </SelectPopup>
      </Select>

      <input
        type="range"
        min={0}
        max={resting ? 1 : durationSec}
        step={SEEK_STEP_SEC}
        value={resting ? 0 : position}
        disabled={resting}
        aria-label={t('asset-library:viewer.seek')}
        onChange={(event) => {
          onSeek(Number(event.target.value));
          bump();
        }}
        className="accent-primary h-1.5 min-w-32 flex-1 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
      />
      <span className="text-muted-foreground font-mono text-[11px] tabular-nums">
        {resting ? (
          '—'
        ) : (
          <>
            <span className="text-foreground">{formatClipTime(position)}</span>
            {' / '}
            {formatClipTime(durationSec)} s
          </>
        )}
      </span>

      <div className="bg-border mx-1 h-5 w-px" />

      <button
        type="button"
        disabled={resting}
        title={t('asset-library:viewer.speedReset')}
        onClick={() => onSpeedChange(DEFAULT_PLAYBACK_SPEED)}
        className="text-muted-foreground hover:text-foreground cursor-pointer text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-40"
      >
        {t('common:replay.speed')}
      </button>
      <input
        type="range"
        min={PLAYBACK_SPEED_MIN}
        max={PLAYBACK_SPEED_MAX}
        step={PLAYBACK_SPEED_STEP}
        value={speed}
        disabled={resting}
        aria-label={t('common:replay.speed')}
        onChange={(event) =>
          onSpeedChange(clampPlaybackSpeed(Number(event.target.value)))
        }
        className="accent-primary h-1.5 w-28 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
      />
      <span className="w-9 font-mono text-[11px] tabular-nums">
        ×{speed.toFixed(1)}
      </span>
    </div>
  );
}
