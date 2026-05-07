import { useTranslation } from 'react-i18next';

export function HmiPage() {
  const { t } = useTranslation();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6">
      <h1 className="text-xl font-semibold">{t('common:nav.hmiDashboard')}</h1>
      <p className="text-muted-foreground text-sm">{t('common:comingSoon')}</p>
    </div>
  );
}
