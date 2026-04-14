import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Layers,
  ClipboardCheck,
  Wrench,
  Package,
  ShieldCheck,
} from 'lucide-react';

const MRO_MENU_KEYS = [
  { key: 'assetManagement', path: '/asset-management', icon: Layers },
  { key: 'inspection', path: '/inspection', icon: ClipboardCheck },
  { key: 'maintenance', path: '/maintenance', icon: Wrench },
  { key: 'inventory', path: '/inventory', icon: Package },
  { key: 'compliance', path: '/compliance', icon: ShieldCheck },
] as const;

export function PhillyDashboardPage() {
  const { t } = useTranslation('common');

  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Philly Shipyard
        </h1>
        <p className="text-muted-foreground mt-1">
          {t('phillyDashboard.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {MRO_MENU_KEYS.map(({ key, path, icon: Icon }) => (
          <Link
            key={path}
            to={path}
            className="group flex flex-col gap-4 rounded-2xl border border-border/80 bg-card/70 p-5 shadow-sm transition-all hover:border-primary/40 hover:bg-card hover:shadow-md"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
              <Icon className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">{t(`phillyDashboard.${key}.label`)}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t(`phillyDashboard.${key}.description`)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
