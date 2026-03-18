import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/shared/ui/molecules/card';
import type { Region, StatusLevel } from '@/entities/region';
import {
  getRegionLinkItems,
  getRegionSubtitleKey,
  getRegionTitleKey,
} from '@/entities/region/lib/region-presentation';

const statusDotColor: Record<StatusLevel, string> = {
  normal: 'bg-green-500',
  warning: 'bg-yellow-500',
  critical: 'bg-red-500',
};

interface RegionCardProps {
  region: Region;
}

export function RegionCard({ region }: RegionCardProps) {
  const { t } = useTranslation();
  const linkItems = getRegionLinkItems(region.id);

  return (
    <Link to={region.navigateTo} className="block focus-visible:outline-none">
      <Card className="hover:bg-muted/50 focus-visible:ring-ring transition-colors focus-visible:ring-2">
        <CardHeader className="relative">
          <div className="absolute top-0 right-4">
            <span
              className={`inline-block size-3 rounded-full ${statusDotColor[region.status]}`}
              title={t(`region-overview:${region.status}`)}
            />
          </div>
          <CardTitle>{t(getRegionTitleKey(region.id))}</CardTitle>
          <CardDescription>
            {t(getRegionSubtitleKey(region.id))}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <ul className="space-y-2 text-sm">
            {linkItems.map((link) => (
              <li
                key={link.path}
                className="border-border text-muted-foreground rounded-lg border px-3 py-2"
              >
                <span className="mr-2 text-yellow-500">›</span>
                {t(link.labelKey)}
              </li>
            ))}
          </ul>
        </CardContent>

        <CardFooter className="gap-4 text-xs">
          <span>
            {t('region-overview:normal')}
            <span className="ml-1.5 text-green-600">
              {region.statusSummary.normal}
            </span>
          </span>
          <span>
            {t('region-overview:warning')}
            <span className="ml-1.5 text-yellow-600">
              {region.statusSummary.warning}
            </span>
          </span>
          <span>
            {t('region-overview:critical')}
            <span className="ml-1.5 text-red-600">
              {region.statusSummary.critical}
            </span>
          </span>
        </CardFooter>
      </Card>
    </Link>
  );
}
