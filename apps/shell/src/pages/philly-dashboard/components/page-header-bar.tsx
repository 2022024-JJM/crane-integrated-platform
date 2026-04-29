import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Clock, Plus } from 'lucide-react';

interface PageHeaderBarProps {
  periodLabel: string;
}

export function PageHeaderBar({ periodLabel }: PageHeaderBarProps) {
  const { t } = useTranslation('philly-dashboard');
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-3">
      <div>
        <h1 className="text-base font-semibold tracking-tight text-foreground">
          {t('header.title')}
        </h1>
        <p className="text-muted-foreground mt-0.5 text-xs">{t('header.subtitle')}</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
          <Clock className="size-3.5" />
          <span className="tabular-nums">{periodLabel}</span>
        </div>
        <Link
          to="/ticket/create"
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors"
        >
          <Plus className="size-3.5" />
          {t('quickLinks.newTicket')}
        </Link>
      </div>
    </div>
  );
}
