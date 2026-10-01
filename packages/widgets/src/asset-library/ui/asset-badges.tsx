import {
  Box,
  DraftingCompass,
  FileText,
  Mountain,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type {
  AssetKind,
  AssetSiteId,
  AssetVersionStatus,
} from '@crane/domain/asset-library';
import { cn } from '@crane/core/lib/utils';
import { ASSET_STATUS_TONE } from '../lib/asset-presentation';

const KIND_ICON: Record<AssetKind, LucideIcon> = {
  model: Box,
  map: Mountain,
  drawing: FileText,
  cad: DraftingCompass,
};

export function AssetKindIcon({
  kind,
  className,
}: {
  kind: AssetKind;
  className?: string;
}) {
  const Icon = KIND_ICON[kind];
  return <Icon aria-hidden className={cn('size-3.5 shrink-0', className)} />;
}

/** 상태 — 점과 글자를 함께 쓴다(색만으로 구분하지 않는다). */
export function AssetStatusBadge({
  status,
  variant = 'badge',
  className,
}: {
  status: AssetVersionStatus;
  /** `badge` 는 테두리 있는 알약, `inline` 은 점 + 글자만. */
  variant?: 'badge' | 'inline';
  className?: string;
}) {
  const { t } = useTranslation();
  const tone = ASSET_STATUS_TONE[status];
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 text-xs leading-none font-medium whitespace-nowrap',
        variant === 'badge'
          ? cn('rounded-full border px-2.5 py-1', tone.badge)
          : 'text-foreground/80',
        className,
      )}
    >
      <span aria-hidden className={cn('size-2 rounded-full', tone.dot)} />
      {t(`asset-library:status.${status}`)}
    </span>
  );
}

/** 조선소 표기. 지정이 없으면 공용이다. */
export function AssetSiteChips({
  sites,
  className,
}: {
  sites: readonly AssetSiteId[];
  className?: string;
}) {
  const { t } = useTranslation();
  const labels =
    sites.length === 0
      ? [t('asset-library:site.commonShort')]
      : sites.map((site) => t(`asset-library:site.${site}Short`));
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1', className)}>
      {labels.map((label) => (
        <span
          key={label}
          className={cn(
            'rounded px-1.5 py-1 text-[11px] leading-none font-medium whitespace-nowrap',
            sites.length === 0
              ? 'text-muted-foreground border-border border border-dashed'
              : 'bg-foreground/8 text-foreground/85',
          )}
        >
          {label}
        </span>
      ))}
    </span>
  );
}
