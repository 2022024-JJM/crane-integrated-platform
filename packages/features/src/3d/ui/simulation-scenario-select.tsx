import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@crane/core/lib/utils';
import {
  scenariosOfSceneFile,
  useScenarioStore,
} from '../model/use-scenario-store';

const SELECT_CLASS =
  'border-border bg-background h-7 w-44 min-w-0 rounded-md border px-2 text-[11px]';

/**
 * 시뮬레이션 시나리오 선택 — 3D 플레이 트랜스포트 바의 시뮬레이션 슬롯. 붙어
 * 있는 씬 파일의 시나리오만 고를 수 있고(우측 시나리오 패널의 선택과 같은 값),
 * 없으면 안내 문구다. 재생·종료·배속·경과는 트랜스포트 바가 맡는다.
 */
export function SimulationScenarioSelect({
  className,
}: {
  className?: string;
}) {
  const { t } = useTranslation();
  const load = useScenarioStore((s) => s.load);
  const scenarios = useScenarioStore((s) => s.scenarios);
  const sceneFile = useScenarioStore((s) => s.sceneFile);
  const activeScenarioId = useScenarioStore((s) => s.activeScenarioId);
  const setActiveScenario = useScenarioStore((s) => s.setActiveScenario);
  // 정의가 아직 없으면 읽는다(load 는 한 번만 실제로 읽고 이후 no-op).
  useEffect(() => {
    void load();
  }, [load]);

  const candidates = scenariosOfSceneFile(scenarios, sceneFile);
  if (candidates.length === 0) {
    return (
      <span
        className={cn(
          'max-w-44 truncate text-[11px] text-amber-500',
          className,
        )}
        title={t('monitoring:simulation.noScenarioHint')}
      >
        {t('monitoring:simulation.noScenario')}
      </span>
    );
  }
  return (
    <select
      className={cn(SELECT_CLASS, className)}
      value={activeScenarioId ?? ''}
      aria-label={t('monitoring:simulation.scenario')}
      title={t('monitoring:simulation.scenario')}
      onChange={(event) => setActiveScenario(event.target.value || null)}
    >
      {candidates.map((scenario) => (
        <option key={scenario.id} value={scenario.id}>
          {scenario.name}
        </option>
      ))}
    </select>
  );
}
