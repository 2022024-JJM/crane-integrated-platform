import type { OperationInfoCard } from '@/entities/monitoring/operation/model/types';

const SECTION_TITLE_CLASS =
  'mb-2.5 text-[18px] font-bold text-[var(--outdoor-page-text-strong)]';

interface Props {
  cards: readonly OperationInfoCard[];
}

export function OperationInfoCardsSection({ cards }: Props) {
  return (
    <section className="min-h-0 border-b border-[var(--outdoor-page-panel-border)] p-3">
      <div className={SECTION_TITLE_CLASS}>운행 정보</div>
      <div className="grid grid-cols-1 gap-2">
        {cards.map(([label, value]) => (
          <div
            key={label}
            className="border border-[var(--outdoor-page-card-border)] bg-[var(--outdoor-page-card-bg)] p-3"
          >
            <div className="mb-1.5 text-[11px] text-[var(--outdoor-page-card-label)]">
              {label}
            </div>
            <div className="text-[13px] leading-[1.5] font-semibold text-[var(--outdoor-page-card-value)]">
              {value}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
