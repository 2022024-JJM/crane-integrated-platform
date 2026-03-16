import type {
  OperationStatusCard,
  OperationStatusTone,
} from '@/entities/monitoring/operation/model/types';
import { cn } from '@/shared/lib/utils';

const SECTION_TITLE_CLASS =
  'mb-2.5 text-[18px] font-bold text-[var(--outdoor-page-text-strong)]';

function getStatValueClass(tone: OperationStatusTone) {
  return cn(
    'mt-2.5 text-center text-[20px] leading-none font-bold',
    tone === 'ok' && 'text-[var(--outdoor-page-ok)]',
    tone === 'danger' && 'text-[var(--outdoor-page-danger)]',
    tone === 'neutral' && 'text-[var(--outdoor-page-neutral)]',
  );
}

interface Props {
  cards: readonly OperationStatusCard[];
}

export function OperationStatusCardsSection({ cards }: Props) {
  const statusCards = cards.map(([label, value, tone]) => ({
    label,
    tone,
    value,
  }));

  return (
    <section className="min-h-0 border-b border-[var(--outdoor-page-panel-border)] p-3">
      <div className={SECTION_TITLE_CLASS}>운행 현황</div>
      <div className="grid grid-cols-2 gap-px overflow-hidden border border-[var(--outdoor-page-card-border)] bg-[var(--outdoor-page-card-grid-gap)]">
        {statusCards.map((card) => (
          <div
            key={card.label}
            className="min-h-[82px] bg-[var(--outdoor-page-card-bg)] p-2.5"
          >
            <div className="text-[11px] text-[var(--outdoor-page-card-label)]">
              {card.label}
            </div>
            <div className={getStatValueClass(card.tone)}>{card.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
