import { CalendarDays, Clock3, RadioTower } from 'lucide-react';

import { ModeToggle } from '@/features/theme-toggle';
import { HanwhaIcon } from '@/shared/ui/atoms/hanwha-icon';
import {
  Topbar,
  TopbarBrand,
  TopbarContent,
} from '@/shared/ui/organisms/topbar';
import { TopStatusCard } from '@/shared/ui/molecules/top-status-card';
import { Brand } from '@/shared/ui/molecules/brand';
import { useClock } from '@/shared/hooks/use-clock';

const TEXT = {
  liveConnected: '온라인',
} as const;

export function MainHeader() {
  const { ymdLabel, hmsLabel } = useClock();

  const mainStatusCardClassName =
    '[--top-status-card-border:var(--main-page-status-card-border)] [--top-status-card-bg:var(--main-page-status-card-bg)] [--top-status-card-icon-bg:var(--main-page-status-icon-bg)] [--top-status-card-icon:var(--main-page-status-icon)] [--top-status-card-label:var(--main-page-status-label)] [--top-status-card-value:var(--main-page-status-value)] [--top-status-card-subvalue:var(--main-page-status-subvalue)]';
  const mainSuccessStatusCardClassName =
    '[--top-status-card-border:var(--main-page-status-success-border)] [--top-status-card-bg:var(--main-page-status-success-bg)] [--top-status-card-icon-bg:var(--main-page-status-success-icon-bg)] [--top-status-card-icon:var(--main-page-status-success-icon)] [--top-status-card-label:var(--main-page-status-success-label)] [--top-status-card-value:var(--main-page-status-success-value)] [--top-status-card-subvalue:var(--main-page-status-success-subvalue)]';

  return (
    <Topbar className="px-[clamp(20px,4vw,40px)] py-4">
      <TopbarBrand>
        <HanwhaIcon />
        <Brand />
      </TopbarBrand>
      <TopbarContent>
        <TopStatusCard
          icon={<CalendarDays size={15} />}
          label="Date"
          value={ymdLabel}
          className={mainStatusCardClassName}
        />
        <TopStatusCard
          icon={<Clock3 size={15} />}
          label="Time"
          value={<time className="font-mono">{hmsLabel}</time>}
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
      </TopbarContent>
    </Topbar>
  );
}
