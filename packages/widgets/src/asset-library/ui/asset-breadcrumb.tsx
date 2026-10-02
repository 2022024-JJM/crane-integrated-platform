import { ChevronRight } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { AssetScope } from '@crane/domain/asset-library';
import { cn } from '@crane/core/lib/utils';

interface AssetBreadcrumbProps {
  scope: AssetScope;
  /** 마디를 그리는 방법 — 목록은 버튼(위치 옮기기), 상세는 링크(목록으로). */
  renderCrumb: (scope: AssetScope, label: string, current: boolean) => ReactNode;
  /** 마지막에 덧붙일 것(상세의 자산 이름 등). */
  trailing?: ReactNode;
  /** 뿌리(라이브러리) 마디를 뺀다 — 좁은 자리에서 자산의 위치만 적을 때. */
  hideRoot?: boolean;
  className?: string;
}

/**
 * 계층 위의 위치 표기 — 라이브러리 › 종류. 앞 마디를 누르면 그 위치로
 * 올라간다. 고른 태그는 위치가 아니라 필터라 여기 적지 않는다(결과 위의 칩).
 */
export function AssetBreadcrumb({
  scope,
  renderCrumb,
  trailing,
  hideRoot = false,
  className,
}: AssetBreadcrumbProps) {
  const { t } = useTranslation();
  // 뿌리는 라이브러리 전체다.
  const crumbs: { scope: AssetScope; label: string }[] = hideRoot
    ? []
    : [{ scope: { kind: null }, label: t('asset-library:tree.root') }];
  if (scope.kind !== null) {
    crumbs.push({
      scope: { kind: scope.kind },
      label: t(`asset-library:kind.${scope.kind}`),
    });
  }

  return (
    <nav
      aria-label={t('asset-library:tree.path')}
      className={cn('flex min-w-0 items-center gap-1', className)}
    >
      {crumbs.map((crumb, index) => (
        <Fragment key={index}>
          {index > 0 ? (
            <ChevronRight
              aria-hidden
              className="text-muted-foreground/60 size-3.5 shrink-0"
            />
          ) : null}
          {renderCrumb(
            crumb.scope,
            crumb.label,
            !trailing && index === crumbs.length - 1,
          )}
        </Fragment>
      ))}
      {trailing ? (
        <>
          <ChevronRight
            aria-hidden
            className="text-muted-foreground/60 size-3.5 shrink-0"
          />
          {trailing}
        </>
      ) : null}
    </nav>
  );
}
