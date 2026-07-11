import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Info, type LucideIcon } from 'lucide-react';
import { cn } from '@crane/core/lib/utils';
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@crane/ui/molecules/card';
import type { KccAccent } from '../constants/konecranes-colors';

// 아이콘 칩은 항상 뉴트럴 — 색은 카드 내부 데이터(도넛·언더라인)만 사용한다.
const ICON_BADGE = 'bg-muted text-muted-foreground border-border';

interface SectionCardProps {
  title: string;
  href?: string;
  icon?: LucideIcon;
  showInfo?: boolean;
  caption?: string;
  variant?: 'panel' | 'card';
  accent?: KccAccent;
  contentClassName?: string;
  children: ReactNode;
}

export function SectionCard({
  title,
  href,
  icon: Icon,
  showInfo = false,
  caption,
  variant = 'card',
  contentClassName,
  children,
}: SectionCardProps) {
  const { t } = useTranslation('common');
  return (
    <Card
      size={variant === 'panel' ? 'default' : 'sm'}
      className={cn(
        'bg-card flex h-full flex-col border border-border ring-1 ring-border/60 shadow-sm transition hover:ring-border hover:shadow-md',
      )}
    >
      <CardHeader className="pb-3">
        <CardTitle
          className={cn(
            'flex items-center gap-2.5 text-foreground',
            variant === 'panel'
              ? 'text-sm font-semibold uppercase tracking-wider'
              : 'text-sm font-semibold',
          )}
        >
          {Icon && (
            <span
              className={cn(
                'inline-flex size-7 shrink-0 items-center justify-center rounded-md border',
                ICON_BADGE,
              )}
            >
              <Icon className="size-3.5" />
            </span>
          )}
          <span>{title}</span>
          {showInfo && (
            <Info className="size-3.5 text-muted-foreground/50" aria-hidden />
          )}
        </CardTitle>
        {caption && (
          <p className="text-muted-foreground text-xs">{caption}</p>
        )}
        {href && (
          <CardAction>
            <Link
              to={href}
              aria-label={t('aria.goTo', { title })}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowRight className="size-4" />
            </Link>
          </CardAction>
        )}
      </CardHeader>
      <CardContent
        className={cn('flex flex-1 flex-col justify-center', contentClassName)}
      >
        {children}
      </CardContent>
    </Card>
  );
}
