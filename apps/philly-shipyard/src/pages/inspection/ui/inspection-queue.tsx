import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import type { InspectionWO } from '@crane/domain/inspection';
import { Badge } from '@crane/ui/atoms/badge';
import { cn } from '@crane/core/lib/utils';
import { SURFACE_PANEL } from '../../../shared/ui/surface';
import {
  TONE_BORDER_ACCENT,
  TONE_CHIP,
  TONE_TEXT,
  type Tone,
} from '../../../shared/ui/tone';
import { INSPECTION_TYPE_VARIANT as TYPE_VARIANT } from '../../../shared/ui/status-variants';
import { formatRelativeDate } from '../../../shared/lib/relative-date';

type QueueGroup = 'overdue' | 'today' | 'upcoming';

const GROUP_TONE: Record<QueueGroup, Tone> = {
  overdue: 'critical',
  today: 'warning',
  upcoming: 'neutral',
};

interface QueueItem {
  wo: InspectionWO;
  group: QueueGroup;
}

const UPCOMING_WINDOW_DAYS = 14;
const MAX_CARDS = 10;
// 지연이 많아도 오늘/예정이 큐에서 밀려나지 않게 그룹별 상한을 둔다
const MAX_OVERDUE_CARDS = 5;

interface QueueData {
  items: QueueItem[];
  /** 카드 절단·기간 창과 무관한 그룹별 실제 미완료 건수 — 칩은 이 값을 쓴다 */
  totals: Record<QueueGroup, number>;
  /** 카드로 노출되지 못한 미완료 건수 */
  hidden: number;
}

/** 미완료 점검을 지연 → 오늘 → 예정 순의 작업 큐로 정렬한다. */
function buildQueue(inspections: InspectionWO[]): QueueData {
  const open = inspections.filter(
    (w) => w.status === 'scheduled' || w.status === 'in_progress' || w.status === 'overdue',
  );
  const items: QueueItem[] = open.map((wo) => {
    const { diff } = formatRelativeDate(wo.scheduledDate);
    // 상태 우선 그룹핑 — 시작한 점검(진행 중)은 기한이 지났어도 '오늘'(이어서)로 올린다.
    // '지연'은 시작도 못 한 기한 초과(status overdue)만 남아 목록의 상태 필터 숫자와 일치한다.
    const group: QueueGroup =
      wo.status === 'in_progress'
        ? 'today'
        : wo.status === 'overdue' || diff < 0
          ? 'overdue'
          : diff === 0
            ? 'today'
            : 'upcoming';
    return { wo, group };
  });
  const totals: Record<QueueGroup, number> = { overdue: 0, today: 0, upcoming: 0 };
  for (const item of items) totals[item.group] += 1;
  const byDate = (a: QueueItem, b: QueueItem) =>
    a.wo.scheduledDate.localeCompare(b.wo.scheduledDate);
  const overdue = items.filter((i) => i.group === 'overdue').sort(byDate).slice(0, MAX_OVERDUE_CARDS);
  const today = items.filter((i) => i.group === 'today').sort(byDate);
  const upcoming = items
    .filter(
      (i) => i.group === 'upcoming' && formatRelativeDate(i.wo.scheduledDate).diff <= UPCOMING_WINDOW_DAYS,
    )
    .sort(byDate);
  const shown = [...overdue, ...today, ...upcoming].slice(0, MAX_CARDS);
  return { items: shown, totals, hidden: open.length - shown.length };
}

function QueueCard({ item }: { item: QueueItem }) {
  const { t } = useTranslation('inspection');
  const { wo, group } = item;
  const { label: dateLabel } = formatRelativeDate(wo.scheduledDate);
  const judged = wo.checklistItems.filter((i) => i.judgment !== null).length;
  const total = wo.checklistItems.length;
  const started = wo.status === 'in_progress' || judged > 0;
  const tone = GROUP_TONE[group];

  return (
    <Link
      to={`/inspection/${wo.id}`}
      className={cn(
        SURFACE_PANEL,
        'group flex w-60 shrink-0 flex-col border-l-2 p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0',
        TONE_BORDER_ACCENT[tone],
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            'rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
            TONE_CHIP[tone],
          )}
        >
          {group === 'today' ? t('queue.today') : dateLabel}
        </span>
        <Badge variant={TYPE_VARIANT[wo.woType]}>
          {t(`type.${wo.woType}`)}
        </Badge>
      </div>

      <p className="mt-2 truncate text-sm font-semibold tabular-nums">{wo.woNumber}</p>
      <p className="truncate text-xs text-muted-foreground">{wo.craneName}</p>
      <p className="mt-0.5 truncate text-[11px] text-muted-foreground/80">
        {wo.assignedTo} · <span className="tabular-nums">{wo.scheduledDate}</span>
      </p>

      <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2">
        <span className="text-xs font-medium text-foreground">
          {started ? t('queue.continue') : t('queue.start')}
          {started && total > 0 && (
            <span className="ml-1.5 text-[10px] font-normal tabular-nums text-muted-foreground">
              {judged}/{total}
            </span>
          )}
        </span>
        <ArrowRight className="size-3.5 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary motion-reduce:transition-none" />
      </div>
    </Link>
  );
}

/** 점검 목록 상단 작업 큐 — "오늘 무엇을 해야 하는가"에 바로 답한다. */
export function InspectionQueue({
  inspections,
  onShowAll,
}: {
  inspections: InspectionWO[];
  /** "+N 더 보기" 클릭 시 전체 목록으로 안내 (필터 해제 + 테이블 스크롤) */
  onShowAll?: () => void;
}) {
  const { t } = useTranslation('inspection');
  const { items: queue, totals, hidden } = buildQueue(inspections);

  return (
    <section aria-label={t('queue.title')}>
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-foreground">
          {t('queue.title')}
        </h2>
        {(['overdue', 'today', 'upcoming'] as const).map(
          (g) =>
            totals[g] > 0 && (
              <span
                key={g}
                className={cn(
                  'rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
                  TONE_CHIP[GROUP_TONE[g]],
                )}
              >
                {t(`queue.${g}`)} {totals[g]}
              </span>
            ),
        )}
      </div>

      {queue.length > 0 ? (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {queue.map((item) => (
            <QueueCard key={item.wo.id} item={item} />
          ))}
          {hidden > 0 && (
            <button
              type="button"
              onClick={onShowAll}
              className={cn(
                SURFACE_PANEL,
                'flex w-28 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 border-dashed p-3 text-muted-foreground transition-colors hover:text-foreground',
              )}
            >
              <span className="text-lg font-bold tabular-nums">+{hidden}</span>
              <span className="text-[11px] font-medium">{t('queue.showAll')}</span>
            </button>
          )}
        </div>
      ) : (
        <div className={cn(SURFACE_PANEL, 'flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground')}>
          <CheckCircle2 className={cn('size-4', TONE_TEXT.positive)} />
          {t('queue.empty')}
        </div>
      )}
    </section>
  );
}
