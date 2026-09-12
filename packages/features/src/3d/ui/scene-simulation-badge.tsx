import { FlaskConical, Square } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@crane/core/lib/utils';
import { Button } from '@crane/ui/atoms/button';
import { stopSimulation } from '../model/stop-simulation';
import { useVirtualTagStore } from '../model/use-virtual-tag-store';

/**
 * "시뮬레이션 중" 표시 — 시뮬레이션 세션이 살아 있는 동안(재생 중이거나
 * 일시정지로 자세가 남아 있는 동안) 캔버스 위에 붙는다. 두 가지를 그린다.
 * - 캔버스 가장자리 하늘색 테두리(`SceneSimulationFrame`, inset box-shadow):
 *   카메라가 어디를 보든, 전체화면이든 "지금 보는 움직임은 실제 값이 아니다"
 *   를 알린다. 경보 비네트(빨강·황색)와 색이 겹치지 않는다. 오버레이 루트
 *   (캔버스 영역 inset-0)에 직접 마운트해야 한다 — 좌측 상단 열 안에 두면
 *   그 열 크기만 두른다.
 * - 좌측 상단 배지: 재생 중엔 맥동 점 + "시뮬레이션 중", 일시정지면 흐린
 *   "시뮬레이션 일시정지". 시나리오 이름·배속을 잇고 ■ 로 바로 종료(관제
 *   복귀)한다. 종료 후처리(카메라 원래 위치)는 부모가 `onStop` 으로.
 *
 * 실시간 화면에서 독 ▶ 로 켠 시뮬레이션이 실제 값을 덮어쓰는 것을 사용자가
 * 놓치지 않게 하는 것이 목적이다(2026-09-12).
 */
export function SceneSimulationBadge({
  onStop,
  className,
}: {
  onStop?: () => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const hasSession = useVirtualTagStore((s) => s.hasSession);
  const isRunning = useVirtualTagStore((s) => s.isRunning);
  const speed = useVirtualTagStore((s) => s.speed);
  const scenarios = useVirtualTagStore((s) => s.scenarios);
  const activeScenarioId = useVirtualTagStore((s) => s.activeScenarioId);
  if (!hasSession) return null;

  const scenario = scenarios.find((s) => s.id === activeScenarioId) ?? null;
  const detail = [
    scenario ? scenario.name || t('monitoring:simulation.unnamed') : null,
    speed !== 1 ? `×${speed}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <div
        role="status"
        aria-live="polite"
        data-slot="scene-simulation-badge"
        className={cn(
          'pointer-events-auto inline-flex h-8 items-center gap-2 rounded-md border px-2.5 text-xs font-semibold shadow-md backdrop-blur-sm',
          isRunning
            ? 'border-sky-400/70 bg-sky-600/90 text-white'
            : 'border-sky-400/40 bg-black/60 text-sky-200',
          className,
        )}
      >
        {isRunning ? (
          <span className="relative flex size-2.5" aria-hidden>
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-white/80 motion-reduce:animate-none" />
            <span className="relative inline-flex size-2.5 rounded-full bg-white" />
          </span>
        ) : (
          <FlaskConical className="size-3.5" aria-hidden />
        )}
        <span>
          {t(
            isRunning
              ? 'monitoring:simulation.badgeRunning'
              : 'monitoring:simulation.badgePaused',
          )}
          {detail ? (
            <span className="ml-1.5 font-mono text-[11px] font-normal opacity-90">
              {detail}
            </span>
          ) : null}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="-mr-1 text-white/90 hover:bg-white/20 hover:text-white"
          aria-label={t('monitoring:simulation.stop')}
          title={t('monitoring:simulation.stopHint')}
          onClick={() => {
            stopSimulation();
            onStop?.();
          }}
        >
          <Square className="size-3" />
        </Button>
      </div>
    </>
  );
}

/** 캔버스 전체 테두리 — 오버레이 루트에 마운트. 세션이 없으면 아무것도 없음. */
export function SceneSimulationFrame() {
  const hasSession = useVirtualTagStore((s) => s.hasSession);
  const isRunning = useVirtualTagStore((s) => s.isRunning);
  if (!hasSession) return null;
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-0 z-10',
        isRunning
          ? 'shadow-[inset_0_0_0_3px_rgba(14,165,233,0.75)]'
          : 'shadow-[inset_0_0_0_3px_rgba(14,165,233,0.35)]',
      )}
    />
  );
}
