import { memo, useState } from 'react';
import { withBaseUrl } from '@crane/core/lib/asset-url';
import { cn } from '@crane/core/lib/utils';
import type { AssetRecord } from '@crane/domain/asset-library';
import { useAssetFileUrl } from '@crane/features/asset-library';
import {
  resolveThumbnailSource,
  withCacheStamp,
} from '../lib/asset-presentation';
import { AssetKindIcon } from './asset-badges';

/**
 * 자산 썸네일. 원천 순서는 lib/asset-presentation 의 resolveThumbnailSource.
 * 그림이 없거나 못 읽으면 종류 아이콘을 놓는다 — 깨진 이미지 표시를 남기지
 * 않는다.
 *
 * 썸네일은 투명 배경 PNG 라 어느 테마에서도 같은 그림을 쓴다. 바탕은 테마
 * 토큰으로 만든 부드러운 받침이다.
 */
export const AssetThumbnail = memo(function AssetThumbnail({
  asset,
  className,
}: {
  asset: AssetRecord;
  className?: string;
}) {
  const source = resolveThumbnailSource(asset);
  const file = useAssetFileUrl(
    source.kind === 'file' || source.kind === 'image' ? source.ref : null,
  );
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  let url: string | null = null;
  if (source.kind === 'static') {
    url = withBaseUrl(source.path);
  } else if (source.kind === 'file' && file.status === 'ready') {
    url = withCacheStamp(file.url, source.stamp);
  } else if (source.kind === 'image' && file.status === 'ready') {
    url = file.url;
  }
  const showImage = url !== null && failedUrl !== url;

  return (
    <div
      className={cn(
        // 가운데가 살짝 밝은 받침 — 물체가 놓인 자리로 읽히고, 모눈처럼 그림과
        // 다투는 무늬가 없다.
        'relative overflow-hidden bg-[radial-gradient(85%_70%_at_50%_42%,var(--background)_0%,var(--muted)_100%)] dark:bg-[radial-gradient(85%_70%_at_50%_42%,var(--muted)_0%,var(--background)_100%)]',
        className,
      )}
    >
      {showImage ? (
        <img
          src={url ?? undefined}
          alt=""
          loading="lazy"
          draggable={false}
          className={cn(
            'absolute inset-0 h-full w-full object-contain',
            // 도면은 종이처럼 여백을 두고, 3D 썸네일은 가장자리에 닿지 않게.
            source.kind === 'image' ? 'p-[7%]' : 'p-[4%]',
          )}
          onError={() => setFailedUrl(url)}
        />
      ) : (
        <div className="text-muted-foreground/45 absolute inset-0 flex items-center justify-center">
          <AssetKindIcon kind={asset.kind} className="size-[26%] max-h-10" />
        </div>
      )}
    </div>
  );
});
