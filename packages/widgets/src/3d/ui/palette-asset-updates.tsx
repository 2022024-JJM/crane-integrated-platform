import { ArrowRight, RefreshCw } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  SceneAssetIssues,
  SceneAssetUpdate,
} from '@crane/features/asset-library';
import { AppLink } from '@crane/ui/atoms/app-link';
import { Button } from '@crane/ui/atoms/button';

interface PaletteAssetUpdatesProps {
  /** 새 버전으로 갱신할 수 있는 자산(listSceneAssetUpdates). */
  updates: SceneAssetUpdate[];
  /** 라이브러리로 관리되지 않는 객체 수(countSceneAssetIssues). */
  issues: SceneAssetIssues;
  /** 한 자산을 새 버전으로 — 씬 안의 그 자산 전부(updateSceneAsset). */
  onUpdate: (update: SceneAssetUpdate) => void;
}

/**
 * 씬에 놓인 자산의 새 버전 알림 — Project 팔레트 맨 아래에 고정된다.
 *
 * 씬은 놓을 때의 버전을 기억하고 라이브러리의 현재 버전을 따라가지 않는다.
 * 현재 버전이 달라진 자산을 여기에 한 줄씩 보이고, "갱신" 을 누르면 이 씬에
 * 놓인 그 자산이 **전부** 새 버전으로 바뀐다. 파일만 바뀌고 배치·태그 맵핑·
 * 영역은 그대로다 — 결과는 캔버스에서 확인하고, 되돌리기 한 번으로 돌아간다.
 * 저장해야 모니터링에 반영된다.
 *
 * 갱신할 것도, 알릴 것도 없으면 아무것도 그리지 않는다.
 */
export const PaletteAssetUpdates = memo(function PaletteAssetUpdates({
  updates,
  issues,
  onUpdate,
}: PaletteAssetUpdatesProps) {
  const { t } = useTranslation();
  const unmanaged = issues.unmanaged + issues.missing;
  if (updates.length === 0 && unmanaged === 0) return null;

  return (
    <div className="border-border flex max-h-[40%] shrink-0 flex-col gap-1.5 overflow-y-auto border-t px-2 py-2">
      {updates.length > 0 ? (
        <>
          <p className="text-foreground text-[11px] font-medium">
            {t('monitoring:assetUpdates.title', { count: updates.length })}
          </p>
          <ul className="flex flex-col gap-1">
            {updates.map((update) => (
              <li
                key={update.assetId}
                className="border-border bg-muted/40 flex items-center gap-2 rounded-md border px-2 py-1.5"
              >
                <div className="min-w-0 flex-1">
                  <AppLink
                    to={`/asset-library/${update.assetId}?tab=versions`}
                    className="text-foreground block truncate text-[11px] font-medium hover:underline"
                    title={t('monitoring:assetUpdates.openAsset')}
                  >
                    {update.name}
                  </AppLink>
                  <p className="text-muted-foreground mt-0.5 flex items-center gap-1 text-[10px] leading-none tabular-nums">
                    <span>
                      {update.fromVersions
                        .map((version) => `v${version}`)
                        .join(', ')}
                    </span>
                    <ArrowRight className="size-2.5" aria-hidden />
                    <span className="text-foreground">v{update.toVersion}</span>
                    <span aria-hidden>·</span>
                    <span>
                      {t(`monitoring:assetUpdates.count.${update.kind}`, {
                        count: update.count,
                      })}
                    </span>
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 shrink-0 gap-1 px-2 text-[10px]"
                  onClick={() => onUpdate(update)}
                >
                  <RefreshCw className="size-3" aria-hidden />
                  {t('monitoring:assetUpdates.update')}
                </Button>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground text-[10px] leading-relaxed">
            {t('monitoring:assetUpdates.hint')}
          </p>
        </>
      ) : null}
      {unmanaged > 0 ? (
        <p className="text-muted-foreground text-[10px] leading-relaxed">
          {t('monitoring:assetUpdates.unmanaged', { count: unmanaged })}
        </p>
      ) : null}
    </div>
  );
});
