import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Card } from '@crane/ui/molecules/card';
import { cn } from '@crane/core/lib/utils';
import { QUICK_LINKS, type QuickLink } from '../constants/quick-links';

interface QuickLinksListProps {
  items?: QuickLink[];
}

export function QuickLinksList({ items = QUICK_LINKS }: QuickLinksListProps) {
  const { t } = useTranslation('philly-dashboard');
  const total = items.length;

  return (
    <Card
      size="sm"
      className="relative border border-border ring-1 ring-border/60 shadow-sm"
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-0.5 rounded-l-xl bg-border"
      />
      <div className="grid grid-cols-1 md:grid-cols-2">
        {items.map((item, idx) => {
          const Icon = item.icon;
          const rowEnd = idx % 2 === 1;
          const isBottomRow = idx >= total - (total % 2 === 0 ? 2 : 1);
          return (
            <Link
              key={item.i18nKey}
              to={item.to}
              className={cn(
                'group flex items-center justify-between px-4 py-3 transition-colors hover:bg-accent/40',
                !rowEnd && 'md:border-r border-border/60',
                !isBottomRow && 'border-b border-border/60',
              )}
            >
              <div className="flex items-center gap-3">
                <Icon className="text-muted-foreground size-4 group-hover:text-foreground transition-colors" />
                <span className="text-sm font-medium text-foreground">
                  {t(item.i18nKey)}
                </span>
              </div>
              <ChevronRight className="text-muted-foreground/60 size-4 group-hover:translate-x-0.5 group-hover:text-foreground transition" />
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
