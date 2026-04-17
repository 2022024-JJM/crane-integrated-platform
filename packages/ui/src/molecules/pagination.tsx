import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '@crane/core/lib/utils';

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  siblingCount?: number;
  labels?: {
    rowsPerPage?: string;
    of?: string;
    page?: string;
  };
}

function getPageRange(current: number, totalPages: number, siblings: number): Array<number | 'ellipsis'> {
  const range: Array<number | 'ellipsis'> = [];
  const left = Math.max(2, current - siblings);
  const right = Math.min(totalPages - 1, current + siblings);

  range.push(1);
  if (left > 2) range.push('ellipsis');
  for (let i = left; i <= right; i++) range.push(i);
  if (right < totalPages - 1) range.push('ellipsis');
  if (totalPages > 1) range.push(totalPages);
  return range;
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  siblingCount = 1,
  labels = {},
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, totalPages);
  const start = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const end = Math.min(current * pageSize, total);
  const range = getPageRange(current, totalPages, siblingCount);
  const rowsPerPageLabel = labels.rowsPerPage ?? 'Rows per page';
  const ofLabel = labels.of ?? 'of';

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 bg-muted/30 px-4 py-2 text-xs">
      {/* 왼쪽: 페이지 크기 + 총 건수 */}
      <div className="flex items-center gap-4">
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">{rowsPerPageLabel}</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="cursor-pointer rounded-md border border-border bg-background px-2 py-1 text-xs outline-none hover:border-primary/40 focus:border-ring focus:ring-1 focus:ring-ring/30"
            >
              {pageSizeOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        )}
        <span className="tabular-nums text-muted-foreground">
          {start}–{end} <span className="mx-0.5">{ofLabel}</span> <span className="font-semibold text-foreground">{total.toLocaleString()}</span>
        </span>
      </div>

      {/* 오른쪽: 페이지 네비 */}
      <div className="flex items-center gap-1">
        <PageButton onClick={() => onPageChange(1)} disabled={current === 1} aria-label="First page">
          <ChevronsLeft className="size-3.5" />
        </PageButton>
        <PageButton onClick={() => onPageChange(current - 1)} disabled={current === 1} aria-label="Previous page">
          <ChevronLeft className="size-3.5" />
        </PageButton>

        <div className="flex items-center gap-0.5">
          {range.map((p, i) =>
            p === 'ellipsis' ? (
              <span key={`e-${i}`} className="px-1.5 text-muted-foreground">…</span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                className={cn(
                  'cursor-pointer rounded-md px-2 py-1 text-xs font-medium tabular-nums transition-colors',
                  p === current
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {p}
              </button>
            ),
          )}
        </div>

        <PageButton onClick={() => onPageChange(current + 1)} disabled={current === totalPages} aria-label="Next page">
          <ChevronRight className="size-3.5" />
        </PageButton>
        <PageButton onClick={() => onPageChange(totalPages)} disabled={current === totalPages} aria-label="Last page">
          <ChevronsRight className="size-3.5" />
        </PageButton>
      </div>
    </div>
  );
}

function PageButton({
  onClick,
  disabled,
  children,
  ...rest
}: {
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
  'aria-label'?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      {...rest}
      className="flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
    >
      {children}
    </button>
  );
}
