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

/** 미완료 점검을 지연 → 오늘 → 예정 순의 작업 큐로 정렬한다. */
function buildQueue(inspections: InspectionWO[]): QueueItem[] {
  const open = inspections.filter(
    (w) => w.status === 'scheduled' || w.status === 'in_progress' || w.status === 'overdue',
  );
  const items: QueueItem[] = open.map((wo) => {
    const { diff } = formatRelativeDate(wo.scheduledDate);
    const group: QueueGroup = diff < 0 ? 'overdue' : diff === 0 ? 'today' : 'upcoming';
    return { wo, group };
  });
  const byDate = (a: QueueItem, b: QueueItem) =>
    a.wo.scheduledDate.localeCompare(b.wo.scheduledDate);
  const overdue = items.filter((i) => i.group === 'overdue').sort(byDate).slice(0, MAX_OVERDUE_CARDS);
  const today = items.filter((i) => i.group === 'today').sort(byDate);
  const upcoming = items
    .filter(
      (i) => i.group === 'upcoming' && formatRelativeDate(i.wo.scheduledDate).diff <= UPCOMING_WINDOW_DAYS,
    )
    .sort(byDate);
  return [...overdue, ...today, ...upcoming].slice(0, MAX_CARDS);
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
        <Badge variant={wo.woType === 'frequent' ? 'secondary' : 'warning'}>
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
export function InspectionQueue({ inspections }: { inspections: InspectionWO[] }) {
  const { t } = useTranslation('inspection');
  const queue = buildQueue(inspections);

  const counts = {
    overdue: queue.filter((q) => q.group === 'overdue').length,
    today: queue.filter((q) => q.group === 'today').length,
    upcoming: queue.filter((q) => q.group === 'upcoming').length,
  };

  return (
    <section aria-label={t('queue.title')}>
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-foreground">
          {t('queue.title')}
        </h2>
        {(['overdue', 'today', 'upcoming'] as const).map(
          (g) =>
            counts[g] > 0 && (
              <span
                key={g}
                className={cn(
                  'rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
                  TONE_CHIP[GROUP_TONE[g]],
                )}
              >
                {t(`queue.${g}`)} {counts[g]}
              </span>
            ),
        )}
      </div>

      {queue.length > 0 ? (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {queue.map((item) => (
            <QueueCard key={item.wo.id} item={item} />
          ))}
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
