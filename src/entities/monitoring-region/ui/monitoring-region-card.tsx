import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import type {
  MonitoringRegion,
  MonitoringRegionStatus,
} from '@/entities/monitoring-region/model/monitoring-region';
import { cn } from '@/shared/lib/utils';

import './monitoring-region-card.css';

const TEXT = {
  craneLabel: '\ud06c\ub808\uc778',
  craneUnit: '\uae30',
} as const;

function getCardStripeClassName(status: MonitoringRegionStatus) {
  if (status === 'warning') {
    return 'main-page__card-stripe--warning';
  }

  if (status === 'error') {
    return 'main-page__card-stripe--error';
  }

  return undefined;
}

function getCardStatusDotClassName(status: MonitoringRegionStatus) {
  if (status === 'warning') {
    return 'main-page__card-status-dot--warning';
  }

  if (status === 'error') {
    return 'main-page__card-status-dot--error';
  }

  return 'main-page__card-status-dot--normal';
}

function getCardFooterStatusClassName(status: MonitoringRegionStatus) {
  if (status === 'warning') {
    return 'main-page__card-footer-status--warning';
  }

  if (status === 'error') {
    return 'main-page__card-footer-status--error';
  }

  return 'main-page__card-footer-status--normal';
}

function RegionCraneIllustration() {
  return (
    <svg
      className="main-page__card-crane"
      width="80"
      height="70"
      viewBox="0 0 80 70"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="35" y="5" width="5" height="55" fill="#f5a623" rx="1" />
      <rect x="25" y="5" width="45" height="3" fill="#f5a623" rx="1" />
      <rect x="15" y="5" width="21" height="2" fill="#c77a1f" rx="1" />
      <line
        x1="58"
        y1="8"
        x2="58"
        y2="38"
        stroke="#8a96a3"
        strokeWidth="1"
        strokeDasharray="2 2"
      />
      <rect x="53" y="38" width="10" height="7" rx="1" fill="#4a525a" />
      <rect x="27" y="58" width="18" height="8" rx="2" fill="#2a2c32" />
      <rect x="22" y="64" width="28" height="5" rx="1" fill="#3a3d45" />
    </svg>
  );
}

interface MonitoringRegionCardProps {
  region: MonitoringRegion;
  animationDelay: number;
}

export function MonitoringRegionCard({
  region,
  animationDelay,
}: MonitoringRegionCardProps) {
  return (
    <Link
      className="main-page__card"
      to={region.route}
      state={{ regionId: region.id, regionName: region.name }}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <div
        className={cn(
          'main-page__card-stripe',
          getCardStripeClassName(region.status),
        )}
      />
      <div className="main-page__card-visual">
        <RegionCraneIllustration />
        <div
          className={cn(
            'main-page__card-status-dot',
            getCardStatusDotClassName(region.status),
          )}
        />
      </div>
      <div className="main-page__card-body">
        <div className="main-page__card-region">{region.name}</div>
        <div className="main-page__card-site">
          {region.siteName} {TEXT.craneLabel} {region.craneCount}
          {TEXT.craneUnit}
        </div>
        <div className="main-page__card-screens">
          {region.screens.map((screen) => (
            <div key={screen} className="main-page__screen-chip">
              <span className="main-page__screen-dot" />
              {screen}
            </div>
          ))}
        </div>
      </div>
      <div className="main-page__card-footer">
        <span className={getCardFooterStatusClassName(region.status)}>
          {region.statusLabel}
        </span>
        <ArrowRight size={14} className="main-page__card-arrow" />
      </div>
    </Link>
  );
}
