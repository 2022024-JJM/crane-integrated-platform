import {
  ArrowUpCircle,
  ChevronRight,
  CircleDashed,
  Gauge,
  Hourglass,
  PencilLine,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AssetAttentionKind } from '@crane/domain/asset-library';
import { cn } from '@crane/core/lib/utils';
import { AppLink } from '@crane/ui/atoms/app-link';

/**
 * "처리할 일" 의 표기 — 이유마다 아이콘과 글자를 함께 쓴다. 급한 것(검토
 * 대기·상한 초과)만 색을 입히고 나머지는 무채색이다.
 */
const ATTENTION_ICON: Record<AssetAttentionKind, LucideIcon> = {
  review: Hourglass,
  rejected: XCircle,
  draft: PencilLine,
  newer: ArrowUpCircle,
  'over-budget': Gauge,
  unused: CircleDashed,
};

const ATTENTION_TONE: Record<AssetAttentionKind, string> = {
  review: 'text-amber-600 dark:text-amber-400',
  rejected: 'text-rose-600 dark:text-rose-400',
  draft: 'text-muted-foreground',
  newer: 'text-sky-600 dark:text-sky-400',
  'over-budget': 'text-amber-600 dark:text-amber-400',
  unused: 'text-muted-foreground',
};

export function AssetAttentionIcon({
  kind,
  className,
}: {
  kind: AssetAttentionKind;
  className?: string;
}) {
  const Icon = ATTENTION_ICON[kind];
  return (
    <Icon
      aria-hidden
      className={cn('size-3.5 shrink-0', ATTENTION_TONE[kind], className)}
    />
  );
}

/** 카드 위 표식 — 가장 급한 이유 하나만 알약으로. */
export function AssetAttentionPill({ kind }: { kind: AssetAttentionKind }) {
  const { t } = useTranslation();
  return (
    <span className="bg-background/90 text-foreground inline-flex h-6 items-center gap-1 rounded-full pr-2 pl-1.5 text-[11px] leading-none font-medium shadow-sm backdrop-blur-sm">
      <AssetAttentionIcon kind={kind} className="size-3" />
      {t(`asset-library:attention.${kind}.label`)}
    </span>
  );
}

/**
 * 미리보기·상세의 목록 — 이유와 한 줄 설명. 줄을 누르면 그 일을 처리하는
 * 곳(해당 버전·탭)으로 간다.
 */
export function AssetAttentionList({
  kinds,
  hrefFor,
}: {
  kinds: readonly AssetAttentionKind[];
  hrefFor: (kind: AssetAttentionKind) => string;
}) {
  const { t } = useTranslation();
  return (
    <ul className="-mx-2 flex flex-col">
      {kinds.map((kind) => (
        <li key={kind}>
          <AppLink
            to={hrefFor(kind)}
            className="group/attn hover:bg-muted focus-visible:ring-ring/50 flex items-start gap-2 rounded-md px-2 py-1.5 text-[13px] outline-none focus-visible:ring-2"
          >
            <AssetAttentionIcon kind={kind} className="mt-0.5" />
            <span className="min-w-0 flex-1">
              <span className="text-foreground font-medium">
                {t(`asset-library:attention.${kind}.label`)}
              </span>
              <span className="text-muted-foreground ml-1.5">
                {t(`asset-library:attention.${kind}.hint`)}
              </span>
            </span>
            <ChevronRight className="text-muted-foreground/60 group-hover/attn:text-foreground mt-0.5 size-3.5 shrink-0" />
          </AppLink>
        </li>
      ))}
    </ul>
  );
}
