import { PanelNoteList } from '@/entities/monitoring/operation/ui/panel-note-list';

const SECTION_TITLE_CLASS =
  'mb-2.5 text-[18px] font-bold text-[var(--outdoor-page-text-strong)]';

interface Props {
  items: readonly string[];
}

export function OperationStatusSummarySection({ items }: Props) {
  return (
    <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] p-3">
      <div className={SECTION_TITLE_CLASS}>상태 요약</div>
      <PanelNoteList items={items} />
    </section>
  );
}
