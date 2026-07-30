import { useTranslation } from 'react-i18next';
import { Wrench, ClipboardCheck, Package, Ticket as TicketIcon, Calendar, User, MapPin, AlertTriangle, Hash } from 'lucide-react';
import { cn } from '@crane/core/lib/utils';
import { TONE_CHIP } from '../../../shared/ui/tone';
import { PRIORITY_TONE, type TicketPriority } from '../../../shared/ui/status-variants';
import type { TicketType } from './ticket-type-selector';

// 티켓은 모노크롬 — 타입은 아이콘·라벨로, 색은 우선순위 칩에만 남긴다.
const PREVIEW_CONFIG: Record<TicketType, {
  icon: React.ComponentType<{ className?: string }>;
  prefix: string;
}> = {
  repair: { icon: Wrench, prefix: 'RPR' },
  inspection: { icon: ClipboardCheck, prefix: 'INS' },
  parts: { icon: Package, prefix: 'PRQ' },
};

/** 우선순위 → 톤 칩 (tone.ts 단일 소스, normal/미정의는 뉴트럴) */
function priorityChip(priority: string): string {
  const tone = PRIORITY_TONE[priority as TicketPriority];
  return TONE_CHIP[tone ?? 'neutral'];
}

export function TicketPreview({
  type,
  craneName,
  siteName,
  priority,
  assignedTo,
  requester,
  scheduledStart,
  scheduledEnd,
  scheduledDate,
  componentName,
  itemsCount,
}: {
  type: TicketType;
  craneName?: string;
  siteName?: string;
  priority: string;
  assignedTo?: string;
  requester?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  scheduledDate?: string;
  componentName?: string;
  itemsCount?: number;
}) {
  const { t } = useTranslation('ticket');
  const cfg = PREVIEW_CONFIG[type];
  const Icon = cfg.icon;
  const year = new Date().getFullYear();
  const draftNum = `${cfg.prefix}-${year}-DRAFT`;

  const priorityLabel = type === 'parts'
    ? t(`requestPriority.${priority}`, { defaultValue: priority.toUpperCase() })
    : t(`priority.${priority}`, { defaultValue: priority.toUpperCase() });

  const displayDate =
    type === 'repair' && scheduledStart && scheduledEnd
      ? `${scheduledStart} → ${scheduledEnd}`
      : type === 'inspection' && scheduledDate
        ? scheduledDate
        : '—';

  const primaryPerson = type === 'parts' ? requester : assignedTo;

  return (
    <div className="sticky top-4">
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        <TicketIcon className="size-3" />
        Preview
      </div>

      {/* 티켓 본체 */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-card shadow-lg">
        {/* 헤더 */}
        <div className="relative flex items-start justify-between gap-3 border-b border-dashed border-border/70 px-5 pb-4 pt-5">
          <div className="flex items-start gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
              <Icon className="size-5 text-foreground" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground">
                {t(`preview.typeLabel.${type}`, {
                  defaultValue: type === 'parts' ? 'PARTS REQUEST' : type.toUpperCase(),
                })}
              </p>
              <p className="mt-0.5 flex items-center gap-1 font-mono text-xs text-muted-foreground">
                <Hash className="size-3" />
                {draftNum}
              </p>
            </div>
          </div>
          <span className={cn('rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider', priorityChip(priority))}>
            {priorityLabel}
          </span>
        </div>

        {/* perforation 라인 */}
        <div className="relative h-2">
          <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-between px-1">
            {Array.from({ length: 30 }).map((_, i) => (
              <div key={i} className="size-0.5 rounded-full bg-border" />
            ))}
          </div>
          <div className="absolute -left-1.5 top-1/2 size-3 -translate-y-1/2 rounded-full border border-border bg-background" />
          <div className="absolute -right-1.5 top-1/2 size-3 -translate-y-1/2 rounded-full border border-border bg-background" />
        </div>

        {/* 본문 */}
        <div className="relative space-y-3 px-5 py-4">
          <Row icon={MapPin} label={t('fields.crane')}>
            {craneName ? (
              <>
                <span className="font-medium text-foreground">{craneName}</span>
                {siteName && <span className="ml-1.5 text-muted-foreground">· {siteName}</span>}
              </>
            ) : (
              <span className="italic text-muted-foreground/60">{t('fields.cranePlaceholder')}</span>
            )}
          </Row>

          {type === 'repair' && (
            <Row icon={AlertTriangle} label={t('fields.componentName')}>
              {componentName ? (
                <span className="font-medium text-foreground">{componentName}</span>
              ) : (
                <span className="italic text-muted-foreground/60">—</span>
              )}
            </Row>
          )}

          {type === 'parts' && (
            <Row icon={Package} label={t('sections.parts')}>
              <span className={cn('font-medium', (itemsCount ?? 0) > 0 ? 'text-foreground' : 'italic text-muted-foreground/60')}>
                {t('preview.itemsCount', { count: itemsCount ?? 0, defaultValue: `${itemsCount ?? 0} item(s)` })}
              </span>
            </Row>
          )}

          <Row icon={User} label={type === 'parts' ? t('fields.requester') : t('fields.assignedTo')}>
            {primaryPerson ? (
              <span className="font-medium text-foreground">{primaryPerson}</span>
            ) : (
              <span className="italic text-muted-foreground/60">—</span>
            )}
          </Row>

          {type !== 'parts' && (
            <Row icon={Calendar} label={type === 'repair' ? t('fields.scheduledStart') : t('fields.scheduledDate')}>
              <span className={cn('font-mono', displayDate === '—' ? 'italic text-muted-foreground/60' : 'text-foreground')}>
                {displayDate}
              </span>
            </Row>
          )}
        </div>

        {/* 하단 워터마크 */}
        <div className="relative border-t border-dashed border-border/70 px-5 py-2.5">
          <p className="text-center text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground">
            · Crane Ops MRO ·
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/80">{label}</p>
        <p className="mt-0.5 truncate text-sm">{children}</p>
      </div>
    </div>
  );
}
