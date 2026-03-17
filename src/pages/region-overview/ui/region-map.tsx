import { Map } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function RegionMap() {
  const { t } = useTranslation();

  return (
    <div className="border-muted-foreground/25 text-muted-foreground flex min-h-80 flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed">
      <Map className="size-10 stroke-1" />
      <p className="text-sm font-medium">
        {t('region-overview:mapComingSoon')}
      </p>
    </div>
  );
}
