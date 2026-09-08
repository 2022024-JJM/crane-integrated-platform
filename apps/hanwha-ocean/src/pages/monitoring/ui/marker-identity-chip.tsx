import type { ReactNode } from 'react';
import { cn } from '@crane/core/lib/utils';
import { identityAlpha, type MapIdentityStyle } from '../lib/marker-identity';

/**
 * 도크 코드 칩 — 마커 플레이트와 hover 카드가 같은 조각을 쓴다.
 *
 * 두 곳의 칩이 같은 색·같은 글자여야 "이 카드가 저 마커의 것" 이라는 연결이
 * 설명 없이 성립한다. 그래서 스타일을 각자 쓰지 않고 여기 하나로 둔다.
 */
export function MarkerIdentityChip({
  identity,
  children,
  className,
}: {
  identity: MapIdentityStyle;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-[24px] shrink-0 items-center justify-center rounded-sm',
        'text-[12px] leading-none font-bold tracking-tight tabular-nums',
        identity.textClass,
        className,
      )}
      style={{
        backgroundColor: identityAlpha(identity, 0.18),
        boxShadow: `inset 0 0 0 1px ${identityAlpha(identity, 0.5)}`,
      }}
    >
      {children}
    </span>
  );
}
