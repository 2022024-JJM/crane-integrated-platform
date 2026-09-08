import { useTranslation } from 'react-i18next';
import { Button } from '@crane/ui/atoms/button';
import {
  AlertDialog,
  AlertDialogDescription,
  AlertDialogPopup,
  AlertDialogTitle,
} from '@crane/ui/molecules/alert-dialog';

interface SceneUnsavedChangesDialogProps {
  open: boolean;
  /** 저장 진행 중이면 버튼과 ESC 를 모두 막는다. */
  isSaving: boolean;
  onSaveAndLeave: () => void;
  onLeaveWithoutSaving: () => void;
  /** 취소 버튼 · ESC — 현재 화면에 머무른다. */
  onStay: () => void;
}

/**
 * 미저장 씬 상태에서 페이지를 벗어날 때 한 번만 띄우는 3버튼 확인 다이얼로그.
 * 브라우저 기본 confirm 은 2버튼뿐이라 "저장/미저장/취소" 분기를 만들려면 두 번 띄워야
 * 했는데, 그 UX 문제를 없애기 위한 컴포넌트다.
 */
export function SceneUnsavedChangesDialog({
  open,
  isSaving,
  onSaveAndLeave,
  onLeaveWithoutSaving,
  onStay,
}: SceneUnsavedChangesDialogProps) {
  const { t } = useTranslation();

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        // ESC 등으로 닫히는 경우는 "취소"와 동일하게 처리. 저장 중에는 무시.
        if (!nextOpen && !isSaving) {
          onStay();
        }
      }}
    >
      <AlertDialogPopup>
        <AlertDialogTitle>
          {t('monitoring:editor.unsavedDialog.title')}
        </AlertDialogTitle>
        <AlertDialogDescription>
          {t('monitoring:editor.unsavedDialog.description')}
        </AlertDialogDescription>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={isSaving}
            onClick={onStay}
          >
            {t('monitoring:editor.unsavedDialog.stay')}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isSaving}
            onClick={onLeaveWithoutSaving}
          >
            {t('monitoring:editor.unsavedDialog.leaveWithoutSaving')}
          </Button>
          <Button
            type="button"
            autoFocus
            disabled={isSaving}
            onClick={onSaveAndLeave}
          >
            {t('monitoring:editor.unsavedDialog.saveAndLeave')}
          </Button>
        </div>
      </AlertDialogPopup>
    </AlertDialog>
  );
}
