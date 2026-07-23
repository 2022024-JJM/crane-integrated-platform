import { Link } from 'react-router-dom';
import { ChevronRight, ClipboardCheck, Package, Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { HistoryEvent, HistoryEventKind } from '@crane/features/history';
import { Badge } from '@crane/ui/atoms/badge';
import { cn } from '@crane/core/lib/utils';
import { TONE_DOT, TONE_TEXT, type Tone } from '../../../shared/ui/tone';
import {
  INSPECTION_RESULT_VARIANT,
  INSPECTION_STATUS_TONE,
  INSPECTION_STATUS_VARIANT,
  PARTS_REQUEST_STATUS_TONE,
  PARTS_REQUEST_STATUS_VARIANT,
  REPAIR_STATUS_TONE,
  REPAIR_STATUS_VARIANT,
} from '../../../shared/ui/status-variants';
import { formatRelativeDate } from '../../../shared/lib/relative-date';

// 종류 구분은 아이콘+라벨로만 — 색(도트)은 상태 의미 전용 (tone.ts 원칙)
const KIND_ICON: Record<HistoryEventKind, React.ReactNode> = {
  inspection: <ClipboardCheck className="size-3.5" />,
  repair: <Wrench className="size-3.5" />,
  parts_request: <Package className="size-3.5" />,
};

function eventTone(e: HistoryEvent): Tone {
  switch (e.kind) {
    case 'inspection':
      return INSPECTION_STATUS_TONE[e.status];
    case 'repair':
      return REPAIR_STATUS_TONE[e.status];
    case 'parts_request':
      return PARTS_REQUEST_STATUS_TONE[e.status];
  }
}

/** 미결 이벤트(예정·진행중)만 D-day 라벨 표시 — 완료 이력엔 노이즈 */
function isOpen(e: HistoryEvent): boolean {
  if (e.kind === 'inspection') return e.status !== 'completed' && e.status !== 'cancelled';
  if (e.kind === 'repair') return e.status !== 'completed';
  return e.status === 'pending';
}

function StatusBadge({ event }: { event: HistoryEvent }) {
  const { t: tInspection } = useTranslation('inspection');
  const { t: tMaintenance } = useTranslation('maintenance');
  const { t: tHistory } = useTranslation('history');

  if (event.kind === 'inspection') {
    return (
      <>
        <Badge variant={INSPECTION_STATUS_VARIANT[event.status]} className="shrink-0">
          {tInspection(`status.${event.status}`)}
        </Badge>
        {event.result && (
          <Badge variant={INSPECTION_RESULT_VARIANT[event.result]} className="shrink-0">
            {tInspection(`result.${event.result}`)}
          </Badge>
        )}
      </>
    );
  }
  if (event.kind === 'repair') {
    return (
      <Badge variant={REPAIR_STATUS_VARIANT[event.status]} className="shrink-0">
        {tMaintenance(`status.${event.status}`)}
      </Badge>
    );
  }
  return (
    <Badge variant={PARTS_REQUEST_STATUS_VARIANT[event.status]} className="shrink-0">
      {tHistory(`requestStatus.${event.status}`)}
    </Badge>
  );
}

function EventRow({ event }: { event: HistoryEvent }) {
  const { t: tHistory } = useTranslation('history');
  const rel = formatRelativeDate(event.date);
  const showRelative = isOpen(event);

  // 둘째 줄: 종류별 부제 (컴포넌트 / 요청자) + 설명
  const subtitle =
    event.kind === 'repair'
      ? event.componentName
      : event.kind === 'parts_request'
        ? event.requester
        : null;

  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="shrink-0 text-muted-foreground">{KIND_ICON[event.kind]}</span>
          <span className="truncate text-sm font-medium tabular-nums">{event.refNumber}</span>
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {tHistory(`kind.${event.kind}`)}
          </span>
        </span>
        <div className="flex shrink-0 items-center gap-1.5">
          <StatusBadge event={event} />
          {event.href && (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-foreground" />
          )}
        </div>
      </div>

      {(subtitle || event.description) && (
        <p className="line-clamp-1 text-xs text-muted-foreground">
          {subtitle && <span className="font-medium text-foreground/80">{subtitle}</span>}
          {subtitle && event.description && ' — '}
          {event.description}
        </p>
      )}

      {event.parts.length > 0 && (
        <ul className="space-y-0.5">
          {event.parts.map((p) => (
            <li key={p.partId} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="size-1 shrink-0 rounded-full bg-muted-foreground/40" />
              <span className="truncate">{p.partName}</span>
              <span className="shrink-0 tabular-nums">× {p.qty}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-muted-foreground tabular-nums">
        {showRelative && (
          <span className={cn('mr-1.5 font-semibold', rel.overdue ? TONE_TEXT.critical : 'text-foreground')}>
            {rel.label}
          </span>
        )}
        {event.date}
      </p>
    </>
  );

  const rowClass =
    'group relative flex flex-col gap-1.5 rounded border border-border/90 bg-card/70 px-3.5 py-3 transition-all';

  return (
    <div className="relative">
      {/* 타임라인 도트 — 상태 톤, 레일(border-l) 중앙 정렬 */}
      <span
        aria-hidden
        className={cn(
          'absolute -left-5 top-4 size-2 rounded-full ring-4 ring-background',
          TONE_DOT[eventTone(event)],
        )}
      />
      {event.href ? (
        <Link to={event.href} className={cn(rowClass, 'hover:border-primary/40 hover:bg-card')}>
          {body}
        </Link>
      ) : (
        <div className={rowClass}>{body}</div>
      )}
    </div>
  );
}

// ── 탭: 통합 이력 — 점검·수리·부품요청 월별 타임라인 (최신순) ──
export function AssetHistoryTab({ events }: { events: HistoryEvent[] }) {
  const { t } = useTranslation('asset-management');

  if (events.length === 0) {
    return (
      <div className="rounded border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
        {t('detail.noHistory')}
      </div>
    );
  }

  // 이미 최신순 정렬 — 순서 유지하며 월 단위로만 묶는다
  const groups: { month: string; items: HistoryEvent[] }[] = [];
  for (const e of events) {
    const month = e.date.slice(0, 7);
    const last = groups[groups.length - 1];
    if (last && last.month === month) last.items.push(e);
    else groups.push({ month, items: [e] });
  }

  return (
    <div className="flex flex-col gap-6">
      {groups.map((g) => (
        <section key={g.month}>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground tabular-nums">
            {g.month}
          </p>
          <div className="ml-1 flex flex-col gap-2 border-l border-border pl-4">
            {g.items.map((e) => (
              <EventRow key={e.key} event={e} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
