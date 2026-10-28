import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { isScenarioSetStoredLocallyOnly } from '@crane/domain/virtual-tag';
import { serializeScenarioSet, useScenarioStore } from '@crane/features/3d';
import {
  useSceneUnsavedChangesGuard,
  type SceneUnsavedChangesPrompt,
} from '@crane/widgets/scene-editor';

export interface ScenarioDraftState {
  isDirty: boolean;
  isSaving: boolean;
  /** 저장. 성공 true. 실패는 재시도 버튼이 있는 토스트와 함께 false. */
  save: () => Promise<boolean>;
  unsavedChangesPrompt: SceneUnsavedChangesPrompt;
}

/**
 * 시나리오 편집본의 수명 — 3D 플레이 우측 패널이 사는 동안 하나. 배포 파일
 * 로드, 저장(토스트·재시도), 미저장 이탈 가드, Ctrl+S, 언마운트 시 폐기를
 * 든다. 시나리오 탭이 아니라 사이드 패널에 거는 이유: 스토어가 전역이라
 * 리포트 탭·리플레이 소스로 갔다 와도 편집본이 남아야 하고, 편집본이 있는
 * 채로 페이지를 떠나면 어느 탭에 있든 물어야 한다. 저장하지 않고 떠나면
 * 언마운트에서 마지막 저장본으로 되돌린다. 이탈 다이얼로그는 호출한 쪽이
 * `SceneUnsavedChangesDialog` 로 그린다.
 */
export function useScenarioDraft(): ScenarioDraftState {
  const { t } = useTranslation();
  const load = useScenarioStore((s) => s.load);
  const save = useScenarioStore((s) => s.save);
  const discard = useScenarioStore((s) => s.discard);
  const scenarios = useScenarioStore((s) => s.scenarios);
  const tickSec = useScenarioStore((s) => s.tickSec);
  const savedSnapshot = useScenarioStore((s) => s.savedSnapshot);
  const isSaving = useScenarioStore((s) => s.isSaving);

  // dirty 는 스냅샷 비교 — 스토어의 isDirty() 는 구독이 안 되므로 여기서 파생.
  const isDirty = useMemo(
    () => serializeScenarioSet({ tickSec, scenarios }) !== savedSnapshot,
    [savedSnapshot, scenarios, tickSec],
  );

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => () => discard(), [discard]);

  const handleSaveRef = useRef<() => Promise<boolean>>(() =>
    Promise.resolve(false),
  );
  const handleSave = useCallback(async (): Promise<boolean> => {
    const ok = await save();
    if (ok) {
      if (isScenarioSetStoredLocallyOnly()) {
        toast.success(t('monitoring:editor.statusSavedLocalOnly'), {
          description: t('monitoring:editor.statusSavedLocalOnlyHint'),
        });
      } else {
        toast.success(t('monitoring:editor.statusSaved'));
      }
      return true;
    }
    toast.error(t('monitoring:scenario.saveFailed'), {
      action: {
        label: t('monitoring:editor.retry'),
        onClick: () => {
          void handleSaveRef.current();
        },
      },
    });
    return false;
  }, [save, t]);
  useEffect(() => {
    handleSaveRef.current = handleSave;
  }, [handleSave]);

  const { unsavedChangesPrompt } = useSceneUnsavedChangesGuard({
    isDirty,
    isSaving,
    onSave: handleSave,
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.code === 'KeyS') {
        event.preventDefault();
        if (isDirty && !isSaving) void handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, isDirty, isSaving]);

  return { isDirty, isSaving, save: handleSave, unsavedChangesPrompt };
}
