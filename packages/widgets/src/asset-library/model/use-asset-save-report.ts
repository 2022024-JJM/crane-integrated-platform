import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useAssetLibraryStore } from '@crane/features/asset-library';

/**
 * 스토어 작업의 결과를 알린다. 자동 저장이라 성공은 조용히 지나가고,
 * 저장에 실패했을 때만 토스트를 띄운다 — 작업이 no-op 이었는지(false)와
 * 저장 실패를 구분하려고 반환값이 아니라 스토어의 saveState 를 본다.
 */
export function useAssetSaveReport() {
  const { t } = useTranslation();
  return useCallback(
    (result: Promise<unknown>) => {
      void result.then(() => {
        if (useAssetLibraryStore.getState().saveState === 'error') {
          toast.error(t('asset-library:toast.saveFailed'));
        }
      });
    },
    [t],
  );
}
