import { useTranslation } from 'react-i18next';
import { Wrench, ClipboardCheck, Package, Ticket as TicketIcon, Calendar, User, MapPin, AlertTriangle, Hash } from 'lucide-react';
import { cn } from '@crane/core/lib/utils';
import type { TicketType } from './ticket-type-selector';

const PREVIEW_CONFIG: Record<TicketType, {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  prefix: string;
  accent: string;
  accentBorder: string;
  accentText: string;
  accentBg: string;
  gradient: string;
}> = {
  repair: {
    icon: Wrench,
    label: 'REPAIR',
    prefix: 'RPR',
    accent: 'bg-amber-500',
    accentBorder: 'border-amber-500/40',
    accentText: 'text-amber-600 dark:text-amber-400',
    accentBg: 'bg-amber-500/10',
    gradient: 'from-amber-500/5 to-amber-500/0',
  },
  inspection: {
    icon: ClipboardCheck,
    label: 'INSPECTION',
    prefix: 'INS',
    accent: 'bg-emerald-500',
    accentBorder: 'border-emerald-500/40',
    accentText: 'text-emerald-600 dark:text-emerald-400',
    accentBg: 'bg-emerald-500/10',
    gradient: 'from-emerald-500/5 to-emerald-500/0',
  },
  parts: {
    icon: Package,
    label: 'PARTS REQUEST',
    prefix: 'PRQ',
    accent: 'bg-blue-500',
    accentBorder: 'border-blue-500/40',
    accentText: 'text-blue-600 dark:text-blue-400',
    accentBg: 'bg-blue-500/10',
    gradient: 'from-blue-500/5 to-blue-500/0',
  },
};

const PRIORITY_COLOR: Record<string, string> = {
  emergency: 'bg-red-500 text-white',
  urgent:    'bg-red-500 text-white',
  high:      'bg-orange-500 text-white',
  normal:    'bg-slate-500 text-white',
  low:       'bg-slate-400 text-white',
  scheduled: 'bg-blue-500 text-white',
};

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
      <div className={cn('relative overflow-hidden rounded-xl border bg-card shadow-lg', cfg.accentBorder)}>
        {/* 상단 배경 그라디언트 */}
        <div className={cn('absolute inset-x-0 top-0 h-32 bg-gradient-to-b', cfg.gradient)} />

        {/* 헤더 */}
        <div className="relative flex items-start justify-between gap-3 border-b border-dashed border-border/70 px-5 pb-4 pt-5">
          <div className="flex items-start gap-3">
            <div className={cn('flex size-10 items-center justify-center rounded-lg', cfg.accentBg)}>
              <Icon className={cn('size-5', cfg.accentText)} />
            </div>
            <div>
              <p className={cn('text-[10px] font-bold uppercase tracking-[0.2em]', cfg.accentText)}>{cfg.label}</p>
              <p className="mt-0.5 flex items-center gap-1 font-mono text-xs text-muted-foreground">
                <Hash className="size-3" />
                {draftNum}
              </p>
            </div>
          </div>
          <span className={cn('rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider', PRIORITY_COLOR[priority] ?? 'bg-slate-500 text-white')}>
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
                {itemsCount ?? 0} {itemsCount === 1 ? 'item' : 'items'}
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
          <p className={cn('text-center text-[9px] font-bold uppercase tracking-[0.3em]', cfg.accentText)}>
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
