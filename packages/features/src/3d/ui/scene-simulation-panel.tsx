import { Pause, Play, RotateCcw, Square } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SIMULATION_SPEED_OPTIONS } from '@crane/domain/virtual-tag';
import { cn } from '@crane/core/lib/utils';
import { Button } from '@crane/ui/atoms/button';
import { ToggleGroup, ToggleGroupItem } from '@crane/ui/molecules/toggle-group';
import { formatSimClock } from '../lib/sim-clock';
import { useRigLivePoll } from '../model/rig-live-readouts';
import { stopSimulation } from '../model/stop-simulation';
import { useVirtualTagStore } from '../model/use-virtual-tag-store';
import { virtualTagRuntime } from '../model/virtual-tag-runner';

/**
 * 시뮬레이션 시계 패널 — 재생/정지·리셋·종료, 배속, 경과 시간. 3D 플레이
 * 트랜스포트 바의 시뮬레이션 팝오버가 쓴다.
 *
 * 경과 시간은 러너(mutable)에서 200ms 폴링으로 읽는다 — 프레임 속도 값을
 * React 상태로 올리지 않는 규칙. 재생 위치 이동은 트랜스포트 바의 스크럽
 * 하나다.
 */
export function SceneSimulationPanel({
  className,
  onStop,
}: {
  className?: string;
  /** 종료 뒤 화면 쪽 후처리. */
  onStop?: () => void;
}) {
  const { t } = useTranslation();
  useRigLivePoll(200);
  const isRunning = useVirtualTagStore((s) => s.isRunning);
  const start = useVirtualTagStore((s) => s.start);
  const pause = useVirtualTagStore((s) => s.pause);
  const speed = useVirtualTagStore((s) => s.speed);
  const setSpeed = useVirtualTagStore((s) => s.setSpeed);
  const load = useVirtualTagStore((s) => s.load);
  // 실시간 모드는 useSceneData 가 정의를 읽지 않는다 — 재생하려면 여기서
  // 읽는다(load 는 한 번만 실제로 읽고 이후 no-op).
  useEffect(() => {
    void load();
  }, [load]);

  const elapsed = virtualTagRuntime.elapsed;

  const handlePlay = () => {
    if (isRunning) {
      pause();
      return;
    }
    void load();
    start();
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant={isRunning ? 'default' : 'outline'}
          size="sm"
          className="h-7 flex-1 gap-1.5 text-[11px]"
          aria-pressed={isRunning}
          onClick={handlePlay}
        >
          {isRunning ? (
            <Pause className="size-3.5" />
          ) : (
            <Play className="size-3.5" />
          )}
          {t(
            isRunning
              ? 'monitoring:simulation.pause'
              : 'monitoring:simulation.play',
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground"
          aria-label={t('monitoring:simulation.reset')}
          title={t('monitoring:simulation.reset')}
          onClick={() => virtualTagRuntime.resetValues()}
        >
          <RotateCcw className="size-3.5" />
        </Button>
        {/* 종료 = 관제 복귀. 일시정지(자세 유지)와 달리 rest 로 돌아간다. */}
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground hover:text-red-400"
          aria-label={t('monitoring:simulation.stop')}
          title={t('monitoring:simulation.stopHint')}
          onClick={() => {
            stopSimulation();
            onStop?.();
          }}
        >
          <Square className="size-3.5" />
        </Button>
      </div>

      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="text-muted-foreground font-medium">
          {t('monitoring:simulation.speed')}
        </span>
        <ToggleGroup
          value={[String(speed)]}
          onValueChange={(next) => {
            const choice = Number(next[0]);
            if (Number.isFinite(choice) && choice > 0) setSpeed(choice);
          }}
          variant="outline"
          size="sm"
          aria-label={t('monitoring:simulation.speed')}
        >
          {SIMULATION_SPEED_OPTIONS.map((option) => (
            <ToggleGroupItem
              key={option}
              value={String(option)}
              className="h-6 px-1.5 text-[10px]"
            >
              ×{option}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="text-muted-foreground flex items-center justify-between text-[11px]">
        <span className="font-medium">{t('monitoring:simulation.time')}</span>
        <span className="text-[10px] tabular-nums">
          {formatSimClock(elapsed)}
        </span>
      </div>
    </div>
  );
}
