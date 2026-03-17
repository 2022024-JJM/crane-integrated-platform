import { Link } from 'react-router-dom';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/shared/ui/molecules/card';
import type { Region, StatusLevel } from '@/entities/region';

const statusDotColor: Record<StatusLevel, string> = {
  normal: 'bg-green-500',
  warning: 'bg-yellow-500',
  critical: 'bg-red-500',
};

const statusLabel: Record<StatusLevel, string> = {
  normal: '정상',
  warning: '경고',
  critical: '이상',
};

interface RegionCardProps {
  region: Region;
}

export function RegionCard({ region }: RegionCardProps) {
  const total =
    region.statusSummary.normal +
    region.statusSummary.warning +
    region.statusSummary.critical;

  return (
    <Link to={region.navigateTo} className="block focus-visible:outline-none">
      <Card className="hover:bg-muted/50 focus-visible:ring-ring transition-colors focus-visible:ring-2">
        <CardHeader className="relative">
          <div className="absolute top-0 right-4">
            <span
              className={`inline-block size-3 rounded-full ${statusDotColor[region.status]}`}
              title={statusLabel[region.status]}
            />
          </div>
          <CardTitle>{region.title}</CardTitle>
          <CardDescription>{region.subtitle}</CardDescription>
        </CardHeader>

        <CardContent>
          <ul className="space-y-2 text-sm">
            {region.links.map((link) => (
              <li
                key={link.path}
                className="border-border text-muted-foreground rounded-lg border px-3 py-2"
              >
                <span className="mr-2 text-yellow-500">›</span>
                {link.label}
              </li>
            ))}
          </ul>
        </CardContent>

        <CardFooter className="gap-4 text-xs">
          <span>
            정상
            <span className="ml-1.5 text-green-600">
              {region.statusSummary.normal}
            </span>
          </span>
          <span>
            경고
            <span className="ml-1.5 text-yellow-600">
              {region.statusSummary.warning}
            </span>
          </span>
          <span>
            이상
            <span className="ml-1.5 text-red-600">
              {region.statusSummary.critical}
            </span>
          </span>
          <span className="text-muted-foreground ml-auto">총 {total}기</span>
        </CardFooter>
      </Card>
    </Link>
  );
}
