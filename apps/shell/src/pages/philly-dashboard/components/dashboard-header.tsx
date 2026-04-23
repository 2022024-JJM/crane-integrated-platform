import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';

export function DashboardHeader() {
  const { t } = useTranslation('philly-dashboard');
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('header.title')}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t('header.subtitle')}</p>
      </div>
      <Link
        to="/ticket/create"
        className="shrink-0 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        <Plus className="h-4 w-4" />
        {t('createButton', { ns: 'ticket', defaultValue: 'New Ticket' })}
      </Link>
    </div>
  );
}
