import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import { mainHeroShortcuts } from '@/widgets/main-hero/model/main-hero-shortcuts';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';

import './main-hero.css';

const TEXT = {
  titleLead: '크레인 통합',
  titleEmphasis: '모니터링',
  description:
    '모니터링할 지역을 선택하면 해당 지역의 3D 크레인 현황 화면으로 이동합니다. 현재 구조에 연결된 실내 작업과 실외 작업 화면도 바로 열 수 있도록 진입점을 함께 배치했습니다.',
} as const;

function HeroCraneIllustration() {
  return (
    <svg
      className="main-page__hero-art"
      width="220"
      height="160"
      viewBox="0 0 220 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="90" y="20" width="12" height="130" fill="#2a2c32" rx="2" />
      <rect
        x="90"
        y="20"
        width="12"
        height="130"
        fill="url(#towerGrad)"
        rx="2"
      />
      <rect x="60" y="20" width="130" height="5" fill="#f5a623" rx="2" />
      <rect
        x="40"
        y="20"
        width="52"
        height="4"
        fill="#c77a1f"
        rx="2"
        opacity="0.7"
      />
      <polygon points="96,8 104,8 100,20" fill="#f5a623" />
      <line
        x1="170"
        y1="25"
        x2="170"
        y2="100"
        stroke="#8a96a3"
        strokeWidth="1.5"
        strokeDasharray="4 3"
      />
      <rect x="163" y="100" width="14" height="10" rx="2" fill="#4a525a" />
      <rect x="167" y="110" width="6" height="6" rx="1" fill="#5a626a" />
      <rect x="162" y="18" width="16" height="6" rx="2" fill="#e8922a" />
      <rect x="85" y="115" width="22" height="18" rx="2" fill="#23262b" />
      <rect
        x="87"
        y="117"
        width="8"
        height="6"
        rx="1"
        fill="#00a8ff"
        opacity="0.5"
      />
      <rect x="75" y="133" width="42" height="16" rx="3" fill="#1c1e23" />
      <rect x="72" y="148" width="48" height="8" rx="2" fill="#2a2c32" />
      <rect x="55" y="154" width="82" height="4" rx="1" fill="#3a3d45" />
      <circle cx="68" cy="156" r="4" fill="#2a2c32" />
      <circle cx="68" cy="156" r="2" fill="#4a525a" />
      <circle cx="124" cy="156" r="4" fill="#2a2c32" />
      <circle cx="124" cy="156" r="2" fill="#4a525a" />
      <line
        x1="100"
        y1="22"
        x2="60"
        y2="22"
        stroke="#ffcc66"
        strokeWidth="0.8"
        opacity="0.4"
      />
      <defs>
        <linearGradient id="towerGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#f5a623" stopOpacity="0.08" />
          <stop offset="1" stopColor="transparent" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function MainHero() {
  return (
    <section className="main-page__hero">
      <div className="main-page__hero-copy">
        <div className="main-page__eyebrow">Region Control Desk</div>
        <h1 className="main-page__title">
          {TEXT.titleLead}
          <span className="mt-2">{TEXT.titleEmphasis}</span>
        </h1>
        <p className="main-page__description">{TEXT.description}</p>
        <div className="main-page__actions">
          {mainHeroShortcuts.map((shortcut, index) => (
            <Button
              key={shortcut.route}
              asChild
              variant={index === 0 ? 'outline' : 'default'}
              className={cn(
                'main-page__action',
                index === 0
                  ? 'main-page__action--secondary'
                  : 'main-page__action--primary',
              )}
            >
              <Link to={shortcut.route}>
                <span className="main-page__action-copy">
                  <span className="main-page__action-title">
                    {shortcut.title}
                  </span>
                  <span className="main-page__action-description">
                    {shortcut.description}
                  </span>
                </span>
                <ArrowRight size={16} />
              </Link>
            </Button>
          ))}
        </div>
      </div>
      <HeroCraneIllustration />
    </section>
  );
}
