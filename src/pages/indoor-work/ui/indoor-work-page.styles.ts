import type { IndoorStatTone } from '@/pages/indoor-work/model/types';
import { cn } from '@/shared/lib/utils';

export const panelSurfaceClass =
  'min-h-0 overflow-hidden bg-[linear-gradient(180deg,var(--outdoor-page-panel-surface-from),var(--outdoor-page-panel-surface-to))]';

export const sectionTitleClass =
  'mb-2.5 text-[18px] font-bold text-[var(--outdoor-page-text-strong)]';

export const viewerControlClass =
  'grid h-[34px] w-[34px] cursor-pointer place-items-center rounded-lg border border-[var(--outdoor-page-control-border)] bg-[var(--outdoor-page-control-bg)] text-[var(--outdoor-page-control-text)] shadow-[var(--outdoor-page-control-shadow)]';

export const resizeHandleClass =
  'outdoor-work-page-resize-handle group flex items-center justify-center transition-colors';

export const resizeGripClass =
  'grid select-none place-items-center rounded-full border border-[var(--outdoor-page-resize-grip-border)] bg-[var(--outdoor-page-resize-grip-bg)] text-[12px] leading-none text-[var(--outdoor-page-resize-grip-text)]';

export const tableCellClass =
  'border-r border-b border-[var(--outdoor-page-table-border)] px-2 py-2 text-center font-mono text-[11px] text-[var(--outdoor-page-table-text)]';

export const tableHeadClass =
  'border-r border-b border-[var(--outdoor-page-table-border)] bg-[var(--outdoor-page-table-head-bg)] px-2 py-[9px] text-[11px] font-medium text-[var(--outdoor-page-table-head-text)]';

export function getStatValueClass(tone: IndoorStatTone) {
  return cn(
    'mt-2.5 text-center text-[20px] leading-none font-bold',
    tone === 'ok' && 'text-[var(--outdoor-page-ok)]',
    tone === 'danger' && 'text-[var(--outdoor-page-danger)]',
    tone === 'neutral' && 'text-[var(--outdoor-page-neutral)]',
  );
}
