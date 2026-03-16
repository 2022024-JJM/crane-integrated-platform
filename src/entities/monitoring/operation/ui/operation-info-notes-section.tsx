import { OPERATION_INFO_NOTES } from '@/entities/monitoring/operation/model/operation-panel-content';
import { PanelNoteList } from '@/entities/monitoring/operation/ui/panel-note-list';

const SECTION_TITLE_CLASS =
  'mb-2.5 text-[18px] font-bold text-[var(--outdoor-page-text-strong)]';

export function OperationInfoNotesSection() {
  return (
    <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] p-3">
      <div className={SECTION_TITLE_CLASS}>운행 메모</div>
      <PanelNoteList items={OPERATION_INFO_NOTES} />
    </section>
  );
}
