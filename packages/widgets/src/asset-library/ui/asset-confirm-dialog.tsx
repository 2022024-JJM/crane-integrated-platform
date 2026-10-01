import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@crane/ui/atoms/button';
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogPopup,
  AlertDialogTitle,
} from '@crane/ui/molecules/alert-dialog';

interface AssetConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  /** 되돌릴 수 없는 일(삭제)이면 확인 버튼을 경고색으로. */
  destructive?: boolean;
  /** 설명 아래에 덧붙일 것(씬 배치 경고 등). */
  children?: ReactNode;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * 한 번 더 묻는 창 — 되돌리는 걸음(반려·철회)과 지우기에 쓴다. 자동 저장이라
 * 누르는 순간 기록되므로, 잘못 눌렀을 때 물릴 자리를 여기서 준다. 앞으로 가는
 * 걸음(검토 요청·승인·게시)은 묻지 않는다.
 */
export function AssetConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  destructive = false,
  children,
  onConfirm,
  onClose,
}: AssetConfirmDialogProps) {
  const { t } = useTranslation();
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <AlertDialogPopup>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
        {children}
        <div className="mt-4 flex justify-end gap-2">
          <AlertDialogClose render={<Button variant="outline" size="sm" />}>
            {t('asset-library:action.cancel')}
          </AlertDialogClose>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            size="sm"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </AlertDialogPopup>
    </AlertDialog>
  );
}
