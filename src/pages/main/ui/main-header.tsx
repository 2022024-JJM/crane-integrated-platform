import { CalendarDays, Clock3, RadioTower } from 'lucide-react';

import { HanwhaIcon } from '@/shared/ui/atoms/hanwha-icon';
import { TopStatusCard } from '@/shared/ui/molecules/top-status-card';

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

  return (
    <header className="flex items-center justify-between gap-6 px-[clamp(20px,4vw,40px)] py-[18px] border-b border-[var(--main-page-border)] bg-[rgb(17_18_20_/_0.88)] backdrop-blur-[10px] max-[960px]:flex-col max-[960px]:items-start">
      <div className="flex items-center gap-3.5">
        <HanwhaIcon className="size-[38px] shrink-0" width={38} height={38} />
        <div className="flex flex-col gap-0.5">
          <div className="text-white text-[20px] leading-none tracking-widest font-['Noto_Sans_KR',sans-serif]">
            CRANE<span className="text-(--main-page-accent)">OPS</span>
          </div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-(--main-page-text-dim)">
            3D Monitoring System
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 max-[960px]:w-full max-[960px]:flex-wrap">
        <TopStatusCard
          icon={<CalendarDays size={15} />}
          label="Date"
          value={dateLabel}
          className="border-white/6 bg-[rgba(24,26,32,0.92)]"
        />
        <TopStatusCard
          icon={<Clock3 size={15} />}
          label="Time"
          value={
            <time className="font-mono" dateTime={dateTime}>
              {clockLabel}
            </time>
          }
          className="border-white/6 bg-[rgba(24,26,32,0.92)] [&>div:first-child]:bg-[rgba(110,130,255,0.1)] [&>div:first-child]:text-[#9fb4ff]"
        />
        <TopStatusCard
          icon={<RadioTower size={15} />}
          label="Status"
          value={TEXT.liveConnected}
          tone="success"
          className="[&>div:first-child]:text-[var(--main-page-ok)]"
        />
      </div>
    </header>
  );
}
