import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@crane/ui/atoms/badge';

interface Props {
  emergencyRepairs: number;
  overdue: number;
  expiredCerts: number;
}

export function DashboardAlertBanner({ emergencyRepairs, overdue, expiredCerts }: Props) {
  const { t } = useTranslation('philly-dashboard');
  const hasAlerts = emergencyRepairs > 0 || overdue > 0 || expiredCerts > 0;
  if (!hasAlerts) return null;

  return (
    <div className="inline-flex w-full flex-wrap items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-2">
      <div className="flex items-center gap-1.5">
        <AlertTriangle className="size-4 shrink-0 text-red-500" />
        <p className="text-xs font-semibold text-red-600 dark:text-red-400">
          {t('alert.actionRequired')}
        </p>
      </div>
      {emergencyRepairs > 0 && (
        <Link to="/maintenance">
          <Badge className="border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 cursor-pointer hover:bg-red-500/20">
            {t('alert.emergencyRepair', { count: emergencyRepairs })}
          </Badge>
        </Link>
      )}
      {overdue > 0 && (
        <Link to="/inspection">
          <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 cursor-pointer hover:bg-amber-500/20">
            {t('alert.overdueInspection', { count: overdue })}
          </Badge>
        </Link>
      )}
      {expiredCerts > 0 && (
        <Link to="/compliance">
          <Badge className="border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400 cursor-pointer hover:bg-orange-500/20">
            {t('alert.expiredCert', { count: expiredCerts })}
          </Badge>
        </Link>
      )}
    </div>
  );
}
