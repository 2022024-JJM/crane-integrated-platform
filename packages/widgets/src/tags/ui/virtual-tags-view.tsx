import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { isVirtualTagSetStoredLocallyOnly } from '@crane/domain/virtual-tag';
import { serializeVirtualTagSet, useVirtualTagStore } from '@crane/features/3d';
import { useProgressNavigate } from '@crane/core/lib/use-progress-navigate';
import {
  SceneUnsavedChangesDialog,
  useSceneUnsavedChangesGuard,
} from '@crane/widgets/scene-editor';
import { virtualTagsPath } from '../lib/tags-route';
import { VirtualEquipmentDetail } from './virtual-equipment-detail';
import { VirtualEquipmentDialog } from './virtual-equipment-dialog';
import { VirtualEquipmentList } from './virtual-equipment-list';
import { VirtualSimulationBar } from './virtual-simulation-bar';

/**
 * 가상 태그 탭 — 장비 목록 또는 장비 상세. 저장·재생 바는 두 화면에 공통이다.
 *
 * 정의 편집은 스토어(메모리)를 지나고 저장 버튼이 배포 파일/localStorage 에
 * 기록한다 — 저장 상태는 씬 편집과 같이 저장 버튼의 점(미저장)·스피너(저장
 * 중)로 나타내고 결과는 토스트로 알리며, 미저장 이탈 경고는 같은 훅을 쓴다.
 * 스토어가 전역이라 페이지를 떠나도 편집본이 남는다 — 저장하지 않고 나가면
 * 언마운트에서 마지막 저장본으로 되돌린다.
 */
export function VirtualTagsView({
  equipmentId,
  basePath,
}: {
  /** `tags/virtual/{equipmentId}` 의 장비. 목록이면 null. */
  equipmentId: string | null;
  basePath: string;
}) {
  const { t } = useTranslation();
  const navigate = useProgressNavigate();
  const load = useVirtualTagStore((s) => s.load);
  const save = useVirtualTagStore((s) => s.save);
  const discard = useVirtualTagStore((s) => s.discard);
  const equipments = useVirtualTagStore((s) => s.equipments);
  const tickMs = useVirtualTagStore((s) => s.tickMs);
  const savedSnapshot = useVirtualTagStore((s) => s.savedSnapshot);
  const isSaving = useVirtualTagStore((s) => s.isSaving);
  const [registerOpen, setRegisterOpen] = useState(false);
  // dirty 는 스냅샷 비교 — 스토어의 isDirty() 는 구독이 안 되므로 여기서 파생.
  const isDirty = useMemo(
    () => serializeVirtualTagSet({ tickMs, equipments }) !== savedSnapshot,
    [savedSnapshot, equipments, tickMs],
  );

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => () => discard(), [discard]);

  // 저장 결과는 씬 편집(use-scene-persistence)과 같은 토스트로 알린다. 운영
  // (localStorage 전용) 저장은 "이 브라우저에만" 고지를 함께 띄운다. 실패
  // 토스트의 재시도는 자기 자신을 다시 부르는데, 선언 전 참조를 react-hooks
  // 규칙이 막으므로 ref 를 거친다.
  const handleSaveRef = useRef<() => Promise<boolean>>(() =>
    Promise.resolve(false),
  );
  const handleSave = useCallback(async (): Promise<boolean> => {
    const ok = await save();
    if (ok) {
      if (isVirtualTagSetStoredLocallyOnly()) {
        toast.success(t('monitoring:editor.statusSavedLocalOnly'), {
          description: t('monitoring:editor.statusSavedLocalOnlyHint'),
        });
      } else {
        toast.success(t('monitoring:editor.statusSaved'));
      }
      return true;
    }
    toast.error(t('monitoring:virtualTags.saveFailed'), {
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

  const openList = () => navigate(virtualTagsPath(basePath));
  const openDetail = (id: string) => navigate(virtualTagsPath(basePath, id));
  const equipment = equipmentId
    ? (equipments.find((e) => e.id === equipmentId) ?? null)
    : null;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-4">
      <SceneUnsavedChangesDialog
        open={unsavedChangesPrompt.open}
        isSaving={isSaving}
        onSaveAndLeave={() => unsavedChangesPrompt.choose('save')}
        onLeaveWithoutSaving={() => unsavedChangesPrompt.choose('discard')}
        onStay={() => unsavedChangesPrompt.choose('stay')}
      />
      <VirtualEquipmentDialog
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        onCreated={(id) => {
          setRegisterOpen(false);
          openDetail(id);
        }}
      />
      <VirtualSimulationBar
        isDirty={isDirty}
        isSaving={isSaving}
        onSave={() => void handleSave()}
      />
      {equipmentId ? (
        <VirtualEquipmentDetail
          equipmentId={equipmentId}
          equipment={equipment}
          onBack={openList}
        />
      ) : (
        <VirtualEquipmentList
          equipments={equipments}
          onOpen={openDetail}
          onRegister={() => setRegisterOpen(true)}
        />
      )}
    </div>
  );
}
