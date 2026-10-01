import { RefreshCw, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAssetLibraryStore } from '@crane/features/asset-library';
import { Button } from '@crane/ui/atoms/button';

/**
 * 저장이 되지 않았을 때의 알림 줄. 다시 시도하면 풀릴 수 있는 실패(`error`)와
 * 다른 곳에서 문서가 바뀐 것(`conflict` — 다시 읽어야 풀린다)을 다르게 안내한다.
 * 자동 저장이라 실패를 조용히 넘기면 사용자는 저장된 줄 안다.
 */
export function AssetSaveBanner() {
  const { t } = useTranslation();
  const saveState = useAssetLibraryStore((state) => state.saveState);
  const retrySave = useAssetLibraryStore((state) => state.retrySave);
  const load = useAssetLibraryStore((state) => state.load);

  if (saveState !== 'error' && saveState !== 'conflict') return null;
  const conflict = saveState === 'conflict';

  return (
    <div
      role="alert"
      className="border-destructive/30 bg-destructive/10 text-destructive flex shrink-0 items-center justify-between gap-3 border-b px-5 py-2 text-xs"
    >
      <span className="flex items-center gap-2">
        <TriangleAlert className="size-3.5 shrink-0" />
        {t(conflict ? 'asset-library:save.conflict' : 'asset-library:save.failed')}
      </span>
      {conflict ? (
        <Button
          variant="outline"
          size="xs"
          onClick={() => void load({ force: true })}
        >
          <RefreshCw />
          {t('asset-library:action.reload')}
        </Button>
      ) : (
        <Button variant="outline" size="xs" onClick={() => void retrySave()}>
          {t('asset-library:action.retry')}
        </Button>
      )}
    </div>
  );
}
