import { RadioTower } from 'lucide-react';

import './main-header.css';

const TEXT = {
  liveConnected: '\uc2e4\uc2dc\uac04 \uc5f0\uacb0\ub428',
} as const;

interface MainHeaderProps {
  dateTime: string;
  clockLabel: string;
}

function HanwhaIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 120 120"
      width="36"
      height="36"
      aria-label="Hanwha"
      role="img"
    >
      <title>Hanwha</title>
      <g transform="translate(-318 -450)">
        <path
          d="M364.49,513.29c-1.46-13.33,12.5-24,31.2-23.88s35,11.07,36.5,24.38-12.49,24-31.19,23.87-35-11.06-36.51-24.37m71.18,4.13c-1.69-16.53-20.5-30.06-42-30.24s-37.6,13.08-35.9,29.6,20.5,30.06,42,30.25,37.6-13.08,35.9-29.6"
          style={{ fill: '#fbb584' }}
        />
        <path
          d="M403.18,547.35c-10.59,11.09-27.61,12-38,2.06s-10.21-27,.4-38,27.62-12,38-2.05,10.2,27-.4,38M363.91,511c-12.32,12.86-12.52,32.67-.45,44.23s31.85,10.49,44.16-2.39,12.53-32.67.46-44.23-31.84-10.49-44.17,2.39"
          style={{ fill: '#f89b6c' }}
        />
        <path
          d="M365,469.56c22-8.26,43.84.1,48.68,18.66s-9.09,40.33-31.14,48.59-43.85-.09-48.69-18.66S343,477.83,365,469.56m-20.47,7.1c-22.87,18.1-28.69,44.35-13,58.6s46.94,11.13,69.82-7,28.7-44.34,13-58.6-46.95-11.14-69.82,7"
          style={{ fill: '#f37321' }}
        />
      </g>
    </svg>
  );
}

export function MainHeader({ dateTime, clockLabel }: MainHeaderProps) {
  return (
    <header className="main-page__header">
      <div className="main-page__brand">
        <HanwhaIcon />
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
