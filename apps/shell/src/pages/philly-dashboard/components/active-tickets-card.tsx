import { useTranslation } from 'react-i18next';
import { Ticket } from 'lucide-react';
import { SectionCard } from './section-card';
import { MetricWithUnderline } from './metric-with-underline';

interface ActiveTicketsCardProps {
  periodLabel: string;
  open: number;
  completed: number;
  onHold: number;
}

export function ActiveTicketsCard({
  periodLabel,
  open,
  completed,
  onHold,
}: ActiveTicketsCardProps) {
  const { t } = useTranslation('philly-dashboard');

  return (
    <SectionCard
      title={t('activeTickets.title')}
      icon={Ticket}
      accent="info"
      caption={periodLabel}
      href="/maintenance"
    >
      <div className="grid grid-cols-3 divide-x divide-border">
        <div className="px-2 first:pl-0 last:pr-0">
          <MetricWithUnderline
            value={open}
            label={t('activeTickets.open')}
            accent="info"
          />
        </div>
        <div className="px-2 first:pl-0 last:pr-0">
          <MetricWithUnderline
            value={completed}
            label={t('activeTickets.completed')}
            accent="success"
          />
        </div>
        <div className="px-2 first:pl-0 last:pr-0">
          <MetricWithUnderline
            value={onHold}
            label={t('activeTickets.onHold')}
            accent={onHold > 0 ? 'production' : 'neutral'}
          />
        </div>
      </div>
    </SectionCard>
  );
}
