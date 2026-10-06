import { useState, type ReactNode } from 'react';
import { cn } from '@crane/core/lib/utils';

interface PaletteTileThumbnailProps {
  /** 라이브러리에 저장된 썸네일 주소(toPaletteThumbnailUrl). 없으면 fallback. */
  url: string | undefined;
  alt: string;
  /**
   * 물체(지도)는 투명 배경 PNG 라 받침 위에 띄우고(contain), 배경은 화면을
   * 가득 채운 그림이라 자리를 채운다(cover) — 라이브러리 카드와 같은 규칙.
   */
  fit: 'contain' | 'cover';
  /** 썸네일이 없거나 못 읽었을 때 놓을 종류 아이콘. */
  fallback: ReactNode;
  className?: string;
}

/**
 * 팔레트 맵·배경 타일의 그림 자리. 그림이 없거나 못 읽으면 종류 아이콘을
 * 놓는다 — 깨진 이미지 표시를 남기지 않는다. 모델 타일은 런타임 미리보기로
 * 폴백해야 해서 따로다(SceneModelPreview).
 */
export function PaletteTileThumbnail({
  url,
  alt,
  fit,
  fallback,
  className,
}: PaletteTileThumbnailProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = url !== undefined && url !== '' && failedUrl !== url;

  return (
    <div
      className={cn(
        'bg-muted/40 relative h-12 w-full overflow-hidden rounded-sm',
        className,
      )}
    >
      {showImage ? (
        <img
          src={url}
          alt={alt}
          loading="lazy"
          draggable={false}
          className={cn(
            'absolute inset-0 h-full w-full',
            fit === 'cover' ? 'object-cover' : 'object-contain p-[4%]',
          )}
          onError={() => setFailedUrl(url)}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          {fallback}
        </div>
      )}
    </div>
  );
}
