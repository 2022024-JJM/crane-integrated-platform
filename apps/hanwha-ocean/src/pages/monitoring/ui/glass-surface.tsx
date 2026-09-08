import type { ReactNode } from 'react';
import { cn } from '@crane/core/lib/utils';
import { GLASS_SURFACE } from '../model/map-overlay-style';

interface GlassSurfaceProps {
  className?: string;
  /**
   * 위쪽 정반사 시트를 그린다. 판이 클 때만 두께로 읽히고, 높이 44px 짜리
   * 컨트롤 줄에서는 그냥 위쪽이 밝아 보이는 얼룩이라 기본은 꺼 둔다.
   */
  sheen?: boolean;
  children: ReactNode;
}

/**
 * 지도 위에 떠 있는 유리판. 재질·반지름은 `map-overlay-style.ts` 한 곳에서 온다.
 *
 * `overflow-hidden` 을 걸어 시트가 모서리를 넘지 않게 하므로, 안쪽 버튼의
 * 포커스 링은 `ring-inset` 이어야 잘리지 않는다.
 */
export function GlassSurface({
  className,
  sheen = false,
  children,
}: GlassSurfaceProps) {
  return (
    <div className={cn('relative overflow-hidden', GLASS_SURFACE, className)}>
      {sheen ? (
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-x-0 top-0 h-1/2',
            'bg-gradient-to-b from-white/45 to-transparent',
            'dark:from-white/[0.07] dark:to-transparent',
          )}
        />
      ) : null}
      <div className="relative flex h-full">{children}</div>
    </div>
  );
}
