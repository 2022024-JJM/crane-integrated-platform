import { useTranslation } from 'react-i18next';
import { Ticket } from 'lucide-react';
import { SectionCard } from './section-card';
import { StatTile } from './stat-tile';

interface ActiveTicketsCardProps {
  open: number;
  completed: number;
  onHold: number;
}

export function ActiveTicketsCard({ open, completed, onHold }: ActiveTicketsCardProps) {
  const { t } = useTranslation('philly-dashboard');

  return (
    <SectionCard
      title={t('activeTickets.title')}
      icon={Ticket}
      accent="info"
      href="/maintenance"
    >
      <div className="grid grid-cols-3 gap-2.5">
        <StatTile value={open} label={t('activeTickets.open')} tone="info" to="/maintenance" />
        {/* 완료(이달)는 통합 이력의 수리 이벤트가 대상 — ?kind= URL 필터로 연결.
            진행/보류는 현재 스냅샷이라 완료에만 기간을 라벨로 명시한다 */}
        <StatTile
          value={completed}
          label={t('activeTickets.completedThisMonth', { defaultValue: 'Completed this month' })}
          tone="positive"
          to="/history?kind=repair"
        />
        <StatTile value={onHold} label={t('activeTickets.onHold')} tone="warning" />
      </div>
    </SectionCard>
  );
}
