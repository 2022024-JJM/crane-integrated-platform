import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Play3dReportPanel, usePlay3dStore } from '@crane/features/3d';
import { cn } from '@crane/core/lib/utils';
import { SceneUnsavedChangesDialog } from '@crane/widgets/scene-editor';
import { useScenarioDraft } from '../model/use-scenario-draft';
import { ScenarioPanel } from './scenario-panel';

type SideTab = 'report' | 'scenario';

/**
 * 3D 플레이 우측 패널 — "리포트 | 시나리오" 탭. 시나리오 탭은 시뮬레이션
 * 소스에서만 보인다(리플레이로 돌아가면 리포트로 접힌다). 탭 모양은 소스
 * 탭과 같다(role=tablist 버튼). 앱의 replay-monitoring-view 가 리포트 패널
 * 자리에 둔다.
 *
 * 시나리오 편집본의 수명(`useScenarioDraft`)은 탭이 아니라 이 패널에 건다 —
 * 리포트 탭·리플레이 소스로 갔다 와도 편집본이 남고, 페이지를 떠날 때만
 * 저장 여부를 묻고 폐기한다.
 */
export function Play3dSidePanel({ className }: { className?: string }) {
  const { t } = useTranslation();
  const source = usePlay3dStore((s) => s.source);
  const [requested, setTab] = useState<SideTab>('report');
  const draft = useScenarioDraft();
  const scenarioAvailable = source === 'simulation';
  // 고른 탭은 상태, 보이는 탭은 파생 — 리플레이로 가면 리포트로 접히고 돌아오면
  // 고른 탭이 다시 산다. effect 로 되돌리지 않는다(렌더 뒤 두 번째 렌더).
  const tab: SideTab = scenarioAvailable ? requested : 'report';
  const tabs: SideTab[] = scenarioAvailable
    ? ['report', 'scenario']
    : ['report'];

  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      <SceneUnsavedChangesDialog
        open={draft.unsavedChangesPrompt.open}
        isSaving={draft.isSaving}
        onSaveAndLeave={() => draft.unsavedChangesPrompt.choose('save')}
        onLeaveWithoutSaving={() =>
          draft.unsavedChangesPrompt.choose('discard')
        }
        onStay={() => draft.unsavedChangesPrompt.choose('stay')}
      />
      <div
        role="tablist"
        aria-label={t('monitoring:scenario.sideTabs')}
        className="bg-background border-border/60 flex shrink-0 items-end gap-1 border-b px-3"
      >
        {tabs.map((item) => {
          const selected = item === tab;
          return (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={selected}
              className={cn(
                '-mb-px cursor-pointer border-b-2 px-3 py-2 text-xs font-medium transition-colors',
                selected
                  ? 'border-primary text-foreground'
                  : 'text-muted-foreground hover:text-foreground border-transparent',
              )}
              onClick={() => setTab(item)}
            >
              {t(
                item === 'report'
                  ? 'monitoring:play3d.report'
                  : 'monitoring:scenario.tab',
              )}
            </button>
          );
        })}
      </div>
      <div className="min-h-0 flex-1">
        {tab === 'scenario' && scenarioAvailable ? (
          <ScenarioPanel
            isDirty={draft.isDirty}
            isSaving={draft.isSaving}
            onSave={draft.save}
          />
        ) : (
          <Play3dReportPanel />
        )}
      </div>
    </div>
  );
}
