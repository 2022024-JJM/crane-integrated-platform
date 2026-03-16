import { OPERATION_INFO_CARDS } from '@/entities/monitoring/operation/model/operation-panel-content';

const SECTION_TITLE_CLASS =
  'mb-2.5 text-[18px] font-bold text-[var(--outdoor-page-text-strong)]';

export function OperationInfoCardsSection() {
  return (
    <section className="min-h-0 border-b border-[var(--outdoor-page-panel-border)] p-3">
      <div className={SECTION_TITLE_CLASS}>운행 정보</div>
      <div className="grid grid-cols-1 gap-2">
        {OPERATION_INFO_CARDS.map(([label, value]) => (
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
