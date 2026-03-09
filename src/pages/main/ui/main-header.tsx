import { RadioTower } from 'lucide-react';

import { HanwhaIcon } from '@/shared/ui/atoms/hanwha-icon';

import './main-header.css';

const TEXT = {
  liveConnected: '\uc2e4\uc2dc\uac04 \uc5f0\uacb0\ub428',
} as const;

interface MainHeaderProps {
  dateTime: string;
  clockLabel: string;
}

export function MainHeader({ dateTime, clockLabel }: MainHeaderProps) {
  return (
    <header className="main-page__header">
      <div className="main-page__brand">
        <HanwhaIcon className="main-page__brand-icon" />
        <div className="main-page__brand-copy">
          <div className="main-page__brand-title">
            CRANE<span>OPS</span>
          </div>
          <div className="main-page__brand-subtitle">3D Monitoring System</div>
        </div>
      </div>
      <div className="main-page__header-meta">
        <div className="main-page__live-badge">
          <span className="main-page__live-dot" />
          <RadioTower size={14} />
          {TEXT.liveConnected}
        </div>
        <time className="main-page__clock" dateTime={dateTime}>
          {clockLabel}
        </time>
      </div>
    </header>
  );
}
