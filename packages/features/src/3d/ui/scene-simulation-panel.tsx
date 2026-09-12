import { Pause, Play, RotateCcw, Square } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  SIMULATION_SPEED_OPTIONS,
  scenarioDurationMs,
  scenarioTimeMs,
} from '@crane/domain/virtual-tag';
import { cn } from '@crane/core/lib/utils';
import { Button } from '@crane/ui/atoms/button';
import { Switch } from '@crane/ui/atoms/switch';
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
} from '@crane/ui/molecules/select';
import { ToggleGroup, ToggleGroupItem } from '@crane/ui/molecules/toggle-group';
import { formatSimClock } from '../lib/sim-clock';
import { useRigLivePoll } from '../model/rig-live-readouts';
import { stopSimulation } from '../model/stop-simulation';
import { useVirtualTagStore } from '../model/use-virtual-tag-store';
import { virtualTagRuntime } from '../model/virtual-tag-runner';

/**
 * 시뮬레이션 시계 패널 — 재생/정지·리셋, 배속, 시나리오 선택·반복, 경과 시간과
 * 타임라인 스크럽. 모니터링 독 팝업(SceneSimulationMenu)과 에디터 팔레트
 * "시뮬레이션 > 태그" 탭이 함께 쓴다.
 *
 * 경과 시간은 러너(mutable)에서 200ms 폴링으로 읽는다 — 프레임 속도 값을
 * React 상태로 올리지 않는 규칙. 스크럽은 시나리오가 있을 때만(길이가 있어야
 * 슬라이더 범위가 정해진다) — 파형만이면 경과 시간과 리셋뿐이다.
 */
const NONE = '__none__';

export function SceneSimulationPanel({
  className,
  onStop,
}: {
  className?: string;
  /** 종료 뒤 화면 쪽 후처리(카메라 원래 위치·포커스 해제). 모니터링 독이 넘긴다. */
  onStop?: () => void;
}) {
  const { t } = useTranslation();
  useRigLivePoll(200);
  const isRunning = useVirtualTagStore((s) => s.isRunning);
  const start = useVirtualTagStore((s) => s.start);
  const pause = useVirtualTagStore((s) => s.pause);
  const speed = useVirtualTagStore((s) => s.speed);
  const setSpeed = useVirtualTagStore((s) => s.setSpeed);
  const scenarios = useVirtualTagStore((s) => s.scenarios);
  const activeScenarioId = useVirtualTagStore((s) => s.activeScenarioId);
  const setActiveScenario = useVirtualTagStore((s) => s.setActiveScenario);
  const updateScenario = useVirtualTagStore((s) => s.updateScenario);
  const seek = useVirtualTagStore((s) => s.seek);
  const load = useVirtualTagStore((s) => s.load);
  // 실시간 모드는 useSceneData 가 정의를 읽지 않는다 — 시나리오 목록을 보이려면
  // 여기서 읽는다(load 는 한 번만 실제로 읽고 이후 no-op).
  useEffect(() => {
    void load();
  }, [load]);

  const scenario = scenarios.find((s) => s.id === activeScenarioId) ?? null;
  const durationMs = scenario ? scenarioDurationMs(scenario) : 0;
  const elapsed = virtualTagRuntime.elapsed;
  const timeMs = scenario
    ? scenarioTimeMs(elapsed, durationMs, scenario.loop)
    : elapsed;

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
              className="h-6 px-1.5 font-mono text-[10px]"
            >
              ×{option}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="flex items-center gap-2 text-[11px]">
        <span className="text-muted-foreground shrink-0 font-medium">
          {t('monitoring:simulation.scenario')}
        </span>
        <Select
          value={activeScenarioId ?? NONE}
          onValueChange={(value: string) =>
            setActiveScenario(value === NONE ? null : value)
          }
        >
          <SelectTrigger
            aria-label={t('monitoring:simulation.scenario')}
            className="bg-muted h-7 min-w-0 flex-1 rounded-sm px-2 text-xs font-normal"
          >
            <span className="truncate">
              {scenario
                ? scenario.name || t('monitoring:simulation.unnamed')
                : t('monitoring:simulation.none')}
            </span>
          </SelectTrigger>
          <SelectPopup align="start" className="min-w-44">
            <SelectItem value={NONE}>
              {t('monitoring:simulation.none')}
            </SelectItem>
            {scenarios.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.name || t('monitoring:simulation.unnamed')}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
      </div>

      {scenario ? (
        <>
          <label className="flex items-center justify-between gap-2 text-[11px]">
            <span className="text-muted-foreground font-medium">
              {t('monitoring:simulation.loop')}
            </span>
            <Switch
              checked={scenario.loop}
              onCheckedChange={(loop) => updateScenario(scenario.id, { loop })}
              aria-label={t('monitoring:simulation.loop')}
            />
          </label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={Math.max(durationMs, 1)}
              step={100}
              value={Math.min(timeMs, durationMs)}
              aria-label={t('monitoring:simulation.seek')}
              className="accent-primary h-2 min-w-0 flex-1 cursor-pointer"
              onChange={(event) => seek(Number(event.target.value))}
            />
            <span className="text-muted-foreground shrink-0 font-mono text-[10px] tabular-nums">
              {formatSimClock(timeMs)} / {formatSimClock(durationMs)}
            </span>
          </div>
          {!isRunning &&
          !scenario.loop &&
          durationMs > 0 &&
          elapsed >= durationMs ? (
            <p className="text-muted-foreground text-[10px]">
              {t('monitoring:simulation.finished')}
            </p>
          ) : null}
        </>
      ) : (
        <div className="text-muted-foreground flex items-center justify-between text-[11px]">
          <span className="font-medium">{t('monitoring:simulation.time')}</span>
          <span className="font-mono text-[10px] tabular-nums">
            {formatSimClock(elapsed)}
          </span>
        </div>
      )}
    </div>
  );
}
