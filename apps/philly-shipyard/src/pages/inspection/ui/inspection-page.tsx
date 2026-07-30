import { useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Calendar, User, ClipboardCheck, Plus } from 'lucide-react';
import { useInspectionList } from '@crane/features/inspection';
import type { InspectionStatus, InspectionType, InspectionWO } from '@crane/domain/inspection';
import { Badge } from '@crane/ui/atoms/badge';
import { Pagination } from '@crane/ui/molecules/pagination';
import { cn } from '@crane/core/lib/utils';
import { TABLE_EMPTY, PAGE_TITLE, PAGE_SUBTITLE, PAGE_CONTAINER } from '../../../shared/ui/page';
import { SURFACE_PANEL } from '../../../shared/ui/surface';
import { buttonVariants } from '@crane/ui/atoms/button';
import { PILL_INACTIVE, TONE_DOT, TONE_PILL_ACTIVE, TONE_TEXT } from '../../../shared/ui/tone';
import {
  INSPECTION_RESULT_VARIANT as RESULT_VARIANT,
  INSPECTION_STATUS_TONE,
  INSPECTION_STATUS_VARIANT as STATUS_VARIANT,
  INSPECTION_TYPE_VARIANT as TYPE_VARIANT,
} from '../../../shared/ui/status-variants';
import { formatRelativeDate } from '../../../shared/lib/relative-date';
import { InspectionQueue } from './inspection-queue';
import { FOCUS_RING } from '../../../shared/ui/controls';

// 컬럼: 상태바 · WO/크레인 · 유형 · 예정일 · 담당자 · 진행률 · 상태 · 결과/화살표
const GRID_TEMPLATE = '4px minmax(220px,2fr) 110px 110px minmax(100px,1fr) minmax(120px,1fr) 100px 100px';

const STATUS_OPTIONS = ['all', 'scheduled', 'in_progress', 'completed', 'overdue'] as const;
// 유형 union 전체를 옵션으로 — emergency/special 점검도 필터·딥링크 가능. 빈 유형 pill은 렌더에서 숨긴다.
const TYPE_OPTIONS = ['all', 'frequent', 'periodic', 'emergency', 'special'] as const;
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

type FilterStatus = 'all' | InspectionStatus;
type FilterType = 'all' | InspectionType;

function InspectionRow({ wo }: { wo: InspectionWO }) {
  const { t } = useTranslation('inspection');
  const completedItems = wo.checklistItems.filter((i) => i.judgment !== null).length;
  const totalItems = wo.checklistItems.length;
  const { label: dateLabel, overdue: dateOverdue } = formatRelativeDate(wo.scheduledDate);
  const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  return (
    <Link
      to={`/inspection/${wo.id}`}
      className="group grid cursor-pointer items-center gap-3 border-b border-border/40 pr-3 text-sm transition-colors hover:bg-muted/40"
      style={{ gridTemplateColumns: GRID_TEMPLATE }}
    >
      {/* 상태 accent 바 */}
      <div className={`h-11 ${TONE_DOT[INSPECTION_STATUS_TONE[wo.status]]}`} />

      {/* WO / 크레인 */}
      <div className="min-w-0 py-2.5">
        <p className="truncate font-semibold tabular-nums">{wo.woNumber}</p>
        <p className="truncate text-xs text-muted-foreground">{wo.craneName} · {wo.siteName}</p>
      </div>

      {/* 유형 */}
      <div>
        <Badge variant={TYPE_VARIANT[wo.woType]}>
          {t(`type.${wo.woType}`)}
        </Badge>
      </div>

      {/* 예정일 */}
      <div className="flex items-center gap-1.5">
        <Calendar className="h-3 w-3 text-muted-foreground/60 shrink-0" />
        <div className="min-w-0">
          {/* 완료된 행의 지난 기한은 이미 끝난 일 — 위험색을 칠하지 않는다 */}
          <p
            className={cn(
              'text-xs font-semibold tabular-nums',
              dateOverdue && wo.status !== 'completed' && TONE_TEXT.critical,
            )}
          >
            {dateLabel}
          </p>
          <p className="text-[10px] text-muted-foreground tabular-nums">{wo.scheduledDate}</p>
        </div>
      </div>

      {/* 담당자 */}
      <div className="flex items-center gap-1.5 min-w-0">
        <User className="h-3 w-3 text-muted-foreground/60 shrink-0" />
        <span className="truncate text-xs">{wo.assignedTo}</span>
      </div>

      {/* 진행률 */}
      <div className="min-w-0">
        {totalItems > 0 ? (
          <>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary/70 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-1 flex items-center justify-end gap-1 text-muted-foreground">
              <ClipboardCheck className="h-2.5 w-2.5" />
              <span className="text-[10px] tabular-nums">{completedItems}/{totalItems}</span>
            </div>
          </>
        ) : (
          <span className="text-[10px] text-muted-foreground/50">—</span>
        )}
      </div>

      {/* 상태 */}
      <div className="flex justify-end">
        <Badge variant={STATUS_VARIANT[wo.status]}>
          {t(`status.${wo.status}`)}
        </Badge>
      </div>

      {/* 결과 + 화살표 */}
      <div className="flex items-center justify-end gap-1.5">
        {wo.result ? (
          <Badge variant={RESULT_VARIANT[wo.result]}>
            {t(`result.${wo.result}`)}
          </Badge>
        ) : (
          <span className="text-[10px] text-muted-foreground/50">—</span>
        )}
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
      </div>
    </Link>
  );
}

export function InspectionPage() {
  const { inspections, summary } = useInspectionList();
  const { t } = useTranslation('inspection');
  // 필터/페이지 상태는 ?status=&type=&page=&pageSize= URL 파라미터가 단일 소스 —
  // 상세 진입 후 뒤로 와도 유지되고, KPI 카드 딥링크와 같은 경로를 쓴다. 기본값은 URL에서 생략.
  const [searchParams, setSearchParams] = useSearchParams();
  const rawStatus = searchParams.get('status');
  const filterStatus: FilterStatus = (STATUS_OPTIONS as readonly string[]).includes(rawStatus ?? '')
    ? (rawStatus as FilterStatus)
    : 'all';
  const rawType = searchParams.get('type');
  const filterType: FilterType = (TYPE_OPTIONS as readonly string[]).includes(rawType ?? '')
    ? (rawType as FilterType)
    : 'all';
  const rawPageSize = Number(searchParams.get('pageSize'));
  const pageSize = PAGE_SIZE_OPTIONS.includes(rawPageSize) ? rawPageSize : 10;
  const rawPage = Number(searchParams.get('page'));
  const page = Number.isInteger(rawPage) && rawPage > 1 ? rawPage : 1;

  const updateParams = (mutate: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(searchParams);
    mutate(next);
    setSearchParams(next, { replace: true });
  };
  const setFilterStatus = (s: FilterStatus) => updateParams((next) => {
    if (s === 'all') next.delete('status');
    else next.set('status', s);
    next.delete('page');
  });
  const setFilterType = (v: FilterType) => updateParams((next) => {
    if (v === 'all') next.delete('type');
    else next.set('type', v);
    next.delete('page');
  });
  const setPageSize = (size: number) => updateParams((next) => {
    if (size === 10) next.delete('pageSize');
    else next.set('pageSize', String(size));
    next.delete('page');
  });
  const setPage = (p: number) => updateParams((next) => {
    if (p <= 1) next.delete('page');
    else next.set('page', String(p));
  });

  const filtered = useMemo(() => inspections.filter((w) => {
    const matchStatus = filterStatus === 'all' || w.status === filterStatus;
    const matchType = filterType === 'all' || w.woType === filterType;
    return matchStatus && matchType;
  }), [inspections, filterStatus, filterType]);

  // 필터 pill 카운트 — 각 pill은 "다른 축 필터"를 반영한 실제 결과 수. 클릭하면 정확히 그 수만큼 나온다.
  const statusCountBase = useMemo(
    () => inspections.filter((w) => filterType === 'all' || w.woType === filterType),
    [inspections, filterType],
  );
  const typeCountBase = useMemo(
    () => inspections.filter((w) => filterStatus === 'all' || w.status === filterStatus),
    [inspections, filterStatus],
  );
  const statusCount = (s: FilterStatus) =>
    s === 'all' ? statusCountBase.length : statusCountBase.filter((w) => w.status === s).length;
  const typeCount = (ty: FilterType) =>
    ty === 'all' ? typeCountBase.length : typeCountBase.filter((w) => w.woType === ty).length;
  // 데이터에 실재하는 유형만 pill로 노출 (+선택된 유형은 0건이어도 유지 — 딥링크 대응)
  const presentTypes = useMemo(() => new Set(inspections.map((w) => w.woType)), [inspections]);

  const pageStart = (page - 1) * pageSize;
  const paginated = filtered.slice(pageStart, pageStart + pageSize);

  const tableRef = useRef<HTMLDivElement>(null);
  const showAllOpen = () => {
    updateParams((next) => {
      next.delete('status');
      next.delete('type');
      next.delete('page');
    });
    tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className={PAGE_CONTAINER}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className={PAGE_TITLE}>{t('title')}</h1>
          <p className={cn(PAGE_SUBTITLE, 'mt-0.5')}>{t('description')}</p>
        </div>
        <Link
          to="/ticket/create?type=inspection"
          className={buttonVariants({ size: 'lg' })}
        >
          <Plus className="h-4 w-4" />
          {t('createButton', { ns: 'ticket', defaultValue: 'New Ticket' })}
        </Link>
      </div>

      {/* 작업 큐 — 지연/오늘/예정 우선순위로 바로 시작 (기존 지연 배너를 대체) */}
      <InspectionQueue inspections={inspections} onShowAll={showAllOpen} />

      {/* 필터 — pill이 곧 요약. 각 pill의 카운트가 별도 메트릭 카드 행을 대체한다. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded border border-border p-1">
          {TYPE_OPTIONS.filter(
            (type) => type === 'all' || presentTypes.has(type) || filterType === type,
          ).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={cn(FOCUS_RING,
                'flex cursor-pointer items-center gap-1.5 rounded px-3 py-1 text-xs font-medium transition-colors',
                filterType === type ? TONE_PILL_ACTIVE.neutral : PILL_INACTIVE,
              )}
            >
              {type === 'all' ? t('filter.allTypes') : t(`type.${type}`)}
              <span className="tabular-nums opacity-60">{typeCount(type)}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-1 rounded border border-border p-1">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={cn(FOCUS_RING,
                'flex cursor-pointer items-center gap-1.5 rounded px-3 py-1 text-xs font-medium transition-colors',
                filterStatus === s
                  ? TONE_PILL_ACTIVE[s === 'all' ? 'neutral' : INSPECTION_STATUS_TONE[s]]
                  : PILL_INACTIVE,
              )}
            >
              {s === 'all' ? t('filter.allStatus') : t(`status.${s}`)}
              <span className="tabular-nums opacity-60">{statusCount(s)}</span>
            </button>
          ))}
        </div>

        {/* 완료율 — 필터로 나뉘지 않는 전체 KPI라 우측에 인라인 표기 */}
        <div className="ml-auto flex items-center gap-1.5 self-center text-xs text-muted-foreground">
          <span>{t('metrics.completionRate')}</span>
          <span className={cn('font-semibold tabular-nums', summary.completionRate < 80 ? TONE_TEXT.warning : 'text-foreground')}>
            {summary.completionRate}%
          </span>
        </div>
      </div>

      {/* 테이블 */}
      <div ref={tableRef} className={cn(SURFACE_PANEL, 'overflow-hidden scroll-mt-4')}>
        {/* 좁은 화면에서는 컬럼을 자르지 않고 가로 스크롤로 접근 */}
        <div className="overflow-x-auto">
          <div className="min-w-[970px]">
            {/* 헤더 */}
            <div
              className="grid items-center gap-3 border-b border-border/60 bg-muted/40 pr-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
              style={{ gridTemplateColumns: GRID_TEMPLATE }}
            >
              <span />
              <span>{t('table.woNumber')}</span>
              <span>{t('table.type')}</span>
              <span>{t('table.scheduled')}</span>
              <span>{t('table.assignedTo')}</span>
              <span className="text-right">{t('table.progress', { defaultValue: 'Progress' })}</span>
              <span className="text-right">{t('table.status')}</span>
              <span className="text-right">{t('table.result')}</span>
            </div>

            {/* 바디 */}
            {filtered.length > 0 && (
              <div>
                {paginated.map((wo) => <InspectionRow key={wo.id} wo={wo} />)}
              </div>
            )}
          </div>
        </div>

        {/* 빈 상태 — 스크롤 래퍼 밖에서 뷰포트 기준 중앙 정렬 */}
        {filtered.length === 0 && (
          <div className={TABLE_EMPTY}>
            {t('empty')}
          </div>
        )}

        {/* 페이지네이션 */}
        {filtered.length > 0 && (
          <Pagination
            page={page}
            pageSize={pageSize}
            total={filtered.length}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            labels={{
              rowsPerPage: t('pagination.rowsPerPage', { defaultValue: 'Rows per page' }),
              of: t('pagination.of', { defaultValue: 'of' }),
            }}
          />
        )}
      </div>
    </div>
  );
}
