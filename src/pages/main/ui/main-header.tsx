import { RadioTower } from 'lucide-react';

import { HanwhaIcon } from '@/shared/ui/atoms/hanwha-icon';

const TEXT = {
  liveConnected: '실시간 연결됨',
} as const;

interface MainHeaderProps {
  dateTime: string;
  clockLabel: string;
}

export function MainHeader({ dateTime, clockLabel }: MainHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-6 px-[clamp(20px,4vw,40px)] py-[18px] border-b border-[var(--main-page-border)] bg-[rgb(17_18_20_/_0.88)] backdrop-blur-[10px] max-[960px]:flex-col max-[960px]:items-start">
      <div className="flex items-center gap-3.5">
        <HanwhaIcon className="size-[38px] shrink-0" width={38} height={38} />
        <div className="flex flex-col gap-0.5">
          <div className="text-[#fff] text-[20px] leading-none tracking-[0.1em] font-['Noto_Sans_KR',sans-serif]">
            CRANE<span className="text-[var(--main-page-accent)]">OPS</span>
          </div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--main-page-text-dim)]">
            3D Monitoring System
          </div>
        </div>
      </div>
      <div className="flex items-center gap-7 max-[960px]:w-full max-[960px]:justify-between max-[640px]:flex-col max-[640px]:items-start max-[640px]:gap-[10px]">
        <div className="inline-flex items-center gap-2 font-mono text-[11px] text-[var(--main-page-ok)]">
          <span className="size-[7px] rounded-full bg-[var(--main-page-ok)] animate-[main-page-blink_1.8s_ease-in-out_infinite]" />
          <RadioTower size={14} />
          {TEXT.liveConnected}
        </div>
        <time
          className="font-mono text-[13px] text-[var(--main-page-text-dim)]"
          dateTime={dateTime}
        >
          {clockLabel}
        </time>
      </div>
    </header>
  );
}
