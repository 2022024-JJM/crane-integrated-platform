import { Box } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getRegionById, getRegionTitleKey } from '@/entities/region';
import { Card, CardContent } from '@/shared/ui/molecules/card';

interface PreparationMonitoringViewerProps {
  regionId: string;
}

export function Preparing3dView({
  regionId,
}: PreparationMonitoringViewerProps) {
  const { t } = useTranslation();
  const region = getRegionById(regionId);

  return (
    <Card className="flex h-full flex-col">
      <CardContent className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-3">
        <Box className="size-12 stroke-1" />
        <div className="text-center">
          <p className="text-lg font-medium">{t('monitoring:title')}</p>
          <p className="text-sm">
            {t('monitoring:subtitle', {
              region: region ? t(getRegionTitleKey(region.id)) : regionId,
            })}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
