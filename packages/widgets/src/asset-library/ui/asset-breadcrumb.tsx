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
 * 계층 위의 위치 표기 — 라이브러리 › 조선소 › 종류 › 분류. 앞 마디를 누르면
 * 그 위치로 올라간다.
 */
export function AssetBreadcrumb({
  scope,
  renderCrumb,
  trailing,
  hideRoot = false,
  className,
}: AssetBreadcrumbProps) {
  const { t } = useTranslation();
  // 뿌리는 라이브러리 전체다. 조선소를 고르지 않은 위치는 뿌리 바로 아래에
  // 종류가 온다.
  const crumbs: { scope: AssetScope; label: string }[] = hideRoot
    ? []
    : [
        {
          scope: { site: 'all', kind: null, category: null },
          label: t('asset-library:tree.root'),
        },
      ];
  if (scope.site !== 'all') {
    crumbs.push({
      scope: { site: scope.site, kind: null, category: null },
      label: t(`asset-library:site.${scope.site}`),
    });
  }
  if (scope.kind !== null) {
    crumbs.push({
      scope: { site: scope.site, kind: scope.kind, category: null },
      label: t(`asset-library:kind.${scope.kind}`),
    });
    if (scope.category !== null) {
      crumbs.push({ scope, label: scope.category });
    }
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
