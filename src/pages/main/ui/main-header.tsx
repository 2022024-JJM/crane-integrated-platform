import { CalendarDays, Clock3, RadioTower } from 'lucide-react';

import { HanwhaIcon } from '@/shared/ui/atoms/hanwha-icon';
import { TopStatusCard } from '@/shared/ui/molecules/top-status-card';
import { ModeToggle } from '@/features/theme-toggle/ui/mode-toggle';

const TEXT = {
  liveConnected: '온라인',
} as const;

const DATE_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  weekday: 'short',
});

interface MainHeaderProps {
  dateTime: string;
  clockLabel: string;
}

export function MainHeader({ dateTime, clockLabel }: MainHeaderProps) {
  const dateLabel = DATE_FORMATTER.format(new Date(dateTime));
  const mainStatusCardClassName =
    '[--top-status-card-border:var(--main-page-status-card-border)] [--top-status-card-bg:var(--main-page-status-card-bg)] [--top-status-card-icon-bg:var(--main-page-status-icon-bg)] [--top-status-card-icon:var(--main-page-status-icon)] [--top-status-card-label:var(--main-page-status-label)] [--top-status-card-value:var(--main-page-status-value)] [--top-status-card-subvalue:var(--main-page-status-subvalue)]';
  const mainSuccessStatusCardClassName =
    '[--top-status-card-border:var(--main-page-status-success-border)] [--top-status-card-bg:var(--main-page-status-success-bg)] [--top-status-card-icon-bg:var(--main-page-status-success-icon-bg)] [--top-status-card-icon:var(--main-page-status-success-icon)] [--top-status-card-label:var(--main-page-status-success-label)] [--top-status-card-value:var(--main-page-status-success-value)] [--top-status-card-subvalue:var(--main-page-status-success-subvalue)]';

  return (
    <header className="flex items-center justify-between gap-6 border-b border-[var(--main-page-border)] bg-[var(--main-page-header-bg)] px-[clamp(20px,4vw,40px)] py-[18px] backdrop-blur-[10px] max-[960px]:flex-col max-[960px]:items-start">
      <div className="flex items-center gap-3.5">
        <HanwhaIcon className="size-[38px] shrink-0" width={38} height={38} />
        <div className="flex flex-col gap-0.5">
          <div className="font-['Noto_Sans_KR',sans-serif] text-[20px] leading-none tracking-widest text-[var(--main-page-title)]">
            CRANE<span className="text-(--main-page-accent)">OPS</span>
          </div>
          <div className="text-[10px] tracking-[0.14em] text-(--main-page-text-dim) uppercase">
            3D Monitoring System
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 max-[960px]:w-full max-[960px]:flex-wrap">
        <TopStatusCard
          icon={<CalendarDays size={15} />}
          label="Date"
          value={dateLabel}
          className={mainStatusCardClassName}
        />
        <TopStatusCard
          icon={<Clock3 size={15} />}
          label="Time"
          value={
            <time className="font-mono" dateTime={dateTime}>
              {clockLabel}
            </time>
          }
          className={`${mainStatusCardClassName} [--top-status-card-icon-bg:var(--main-page-status-clock-icon-bg)] [--top-status-card-icon:var(--main-page-status-clock-icon)]`}
        />
        <TopStatusCard
          icon={<RadioTower size={15} />}
          label="Status"
          value={TEXT.liveConnected}
          tone="success"
          className={`${mainSuccessStatusCardClassName} [--top-status-card-icon:var(--main-page-ok)]`}
        />
        <ModeToggle />
      </div>
    </header>
  );
}
