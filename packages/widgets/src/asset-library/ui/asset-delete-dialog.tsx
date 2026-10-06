import { Loader2, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  countAssetPlacements,
  getAssetRemoveBlock,
  type AssetRecord,
} from '@crane/domain/asset-library';
import {
  toAssetUsageState,
  useAssetLibraryStore,
} from '@crane/features/asset-library';
import { Button } from '@crane/ui/atoms/button';
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogPopup,
  AlertDialogTitle,
} from '@crane/ui/molecules/alert-dialog';
import { isAssetSaveFailed } from '../model/use-asset-save-report';

interface AssetDeleteDialogProps {
  /** 지우려는 자산. null 이면 닫혀 있다. */
  asset: AssetRecord | null;
  /** 쓰이는 자산은 지우는 대신 사용처로 보낸다 — 그리로 가는 길. */
  onOpenUsage: (asset: AssetRecord) => void;
  /** 지워진 뒤 — 상세는 목록으로 돌아가고, 목록은 미리보기를 닫는다. */
  onDeleted?: (asset: AssetRecord) => void;
  onClose: () => void;
}

/**
 * 자산 삭제 — 상세·미리보기·카드 메뉴가 함께 쓰는 창.
 *
 * 씬이나 화면 코드가 쓰는 자산은 지우지 않는다. 그때는 확인 대신 왜 못
 * 지우는지와 다음에 할 일(사용처 보기·사용처 다시 읽기)을 적는다. 지우는 순간
 * 스토어가 사용처를 다시 읽어 한 번 더 확인하므로, 화면이 아직 모르는 사용처가
 * 있어도 지워지지 않는다(그때는 토스트로 알린다).
 *
 * 파일을 다룰 수 있는 환경(dev)에서만 연다 — 여는 버튼을 그 환경에서만 낸다.
 */
export function AssetDeleteDialog({
  asset,
  onOpenUsage,
  onDeleted,
  onClose,
}: AssetDeleteDialogProps) {
  const { t } = useTranslation();
  const usageIndex = useAssetLibraryStore((state) => state.usageIndex);
  const usageStatus = useAssetLibraryStore((state) => state.usageStatus);
  const usageFailedScenes = useAssetLibraryStore(
    (state) => state.usageFailedScenes,
  );
  const loadUsage = useAssetLibraryStore((state) => state.loadUsage);
  const removeAsset = useAssetLibraryStore((state) => state.removeAsset);
  const [deleting, setDeleting] = useState(false);

  const placementCount = useMemo(
    () => (asset ? countAssetPlacements(asset, usageIndex) : 0),
    [asset, usageIndex],
  );
  const removeBlock = useMemo(
    () =>
      asset
        ? getAssetRemoveBlock(
            asset,
            toAssetUsageState({ usageIndex, usageStatus, usageFailedScenes }),
          )
        : null,
    [asset, usageFailedScenes, usageIndex, usageStatus],
  );

  const handleDelete = async () => {
    if (!asset) return;
    setDeleting(true);
    const ok = await removeAsset(asset.id);
    setDeleting(false);
    if (ok) {
      toast.success(t('asset-library:toast.deleted', { name: asset.name }));
      onClose();
      onDeleted?.(asset);
      return;
    }
    onClose();
    // 저장은 됐는데 지워지지 않았다면 그사이 어디선가 쓰이기 시작한 것이다.
    toast.error(
      t(
        isAssetSaveFailed()
          ? 'asset-library:toast.saveFailed'
          : 'asset-library:protect.removeBlocked',
      ),
    );
  };

  return (
    <AlertDialog
      open={asset !== null}
      onOpenChange={(next) => {
        if (!next && !deleting) onClose();
      }}
    >
      {asset && removeBlock ? (
        // 쓰이는 자산은 지우지 않는다 — 왜 못 지우는지와 다음에 할 일을 적는다.
        <AlertDialogPopup>
          <AlertDialogTitle>
            {t('asset-library:protect.removeTitle', { name: asset.name })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t(`asset-library:protect.remove.${removeBlock}`, {
              count: placementCount,
            })}
          </AlertDialogDescription>
          <div className="mt-4 flex justify-end gap-2">
            {removeBlock === 'in-use' ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  onOpenUsage(asset);
                }}
              >
                {t('asset-library:protect.openUsage')}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                disabled={usageStatus === 'loading'}
                onClick={() => void loadUsage()}
              >
                {usageStatus === 'loading' ? (
                  <Loader2 className="animate-spin" />
                ) : null}
                {t('asset-library:action.retry')}
              </Button>
            )}
            <AlertDialogClose render={<Button size="sm" />}>
              {t('asset-library:action.close')}
            </AlertDialogClose>
          </div>
        </AlertDialogPopup>
      ) : asset ? (
        <AlertDialogPopup>
          <AlertDialogTitle>
            {t('asset-library:detail.deleteTitle', { name: asset.name })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('asset-library:detail.deleteDescription', {
              count: asset.versions.length,
            })}
          </AlertDialogDescription>
          <div className="mt-4 flex justify-end gap-2">
            <AlertDialogClose
              render={<Button variant="outline" size="sm" disabled={deleting} />}
            >
              {t('asset-library:action.cancel')}
            </AlertDialogClose>
            <Button
              variant="destructive"
              size="sm"
              disabled={deleting}
              onClick={() => void handleDelete()}
            >
              {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
              {t('asset-library:action.delete')}
            </Button>
          </div>
        </AlertDialogPopup>
      ) : null}
    </AlertDialog>
  );
}
