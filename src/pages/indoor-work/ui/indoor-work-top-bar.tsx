import { ChevronLeft, CloudSun, Clock3 } from 'lucide-react';
import { Link } from 'react-router-dom';

import { ModeToggle } from '@/features/theme-toggle/ui/mode-toggle';
import { INDOOR_WORK_TEXT } from '@/pages/indoor-work/config/indoor-work-content';
import { HanwhaIcon } from '@/shared/ui/atoms/hanwha-icon';
import { TopStatusCard } from '@/shared/ui/molecules/top-status-card';

interface IndoorWorkTopBarProps {
  clockLabel: string;
  dateTime: string;
  siteLabel: string;
  temperatureLabel: string;
  weatherLabel: string;
}

export function IndoorWorkTopBar({
  clockLabel,
  dateTime,
  siteLabel,
  temperatureLabel,
  weatherLabel,
}: IndoorWorkTopBarProps) {
  return (
    <div className="grid min-h-[52px] grid-cols-[320px_1fr_220px] items-center gap-4 border-b border-b-[var(--outdoor-page-topbar-border)] bg-[linear-gradient(180deg,var(--outdoor-page-topbar-from),var(--outdoor-page-topbar-to))] px-3.5 py-2 shadow-[var(--outdoor-page-topbar-shadow)] max-[1080px]:grid-cols-1 max-[1080px]:justify-items-start">
      <div className="flex items-center gap-3.5">
        <Link
          to="/"
          aria-label="뒤로가기"
          className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-[var(--outdoor-page-accent-soft-border)] bg-[var(--outdoor-page-accent-soft-bg)] text-[var(--outdoor-page-accent-button-text)] no-underline"
        >
          <ChevronLeft size={18} />
        </Link>
        <div className="flex items-center gap-2.5">
          <HanwhaIcon
            className="h-[26px] w-[26px] shrink-0"
            width={26}
            height={26}
          />
          <div>
            <div className="text-[18px] leading-none tracking-[0.1em] text-[var(--outdoor-page-text-strong)]">
              CRANE
              <span className="text-[var(--outdoor-page-accent)]">OPS</span>
            </div>
            <div className="text-[9px] tracking-[0.14em] text-[var(--outdoor-page-text-dim)]">
              3D Monitoring System
            </div>
          </div>
        </div>
      </div>

      <div className="flex min-w-0 items-center justify-center gap-3 max-[1080px]:flex-wrap max-[1080px]:justify-start">
        <div className="rounded-lg border border-[var(--outdoor-page-accent-soft-border)] bg-[var(--outdoor-page-accent-soft-bg)] px-3 py-1.5 text-[12px] font-bold text-[var(--outdoor-page-accent-chip-text)]">
          {INDOOR_WORK_TEXT.topTag}
        </div>
        <div className="text-[13px] whitespace-nowrap text-[var(--outdoor-page-text-soft)]">
          {INDOOR_WORK_TEXT.topDescription}
        </div>
      </div>

      <div className="flex items-center gap-2 justify-self-end max-[1080px]:justify-self-start max-[720px]:flex-wrap">
        <TopStatusCard
          icon={<CloudSun size={15} />}
          label="Weather"
          value={`${siteLabel} ${weatherLabel}`}
          subValue={temperatureLabel}
        />
        <TopStatusCard
          icon={<Clock3 size={15} />}
          label="Time"
          value={
            <time className="font-mono" dateTime={dateTime}>
              {clockLabel}
            </time>
          }
          className="[--top-status-card-current-icon-bg:var(--outdoor-page-status-clock-icon-bg)] [--top-status-card-current-icon:var(--outdoor-page-status-clock-icon)]"
        />
        <TopStatusCard
          icon={
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--outdoor-page-status-indicator)] shadow-[var(--outdoor-page-status-indicator-shadow)]" />
          }
          label="Status"
          value={INDOOR_WORK_TEXT.live}
          tone="success"
        />
        <ModeToggle />
      </div>
    </div>
  );
}
