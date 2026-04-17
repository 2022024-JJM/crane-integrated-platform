import { Wrench, ClipboardCheck, Package, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@crane/core/lib/utils';

export type TicketType = 'repair' | 'inspection' | 'parts';

const TYPES = [
  {
    value: 'repair' as const,
    icon: Wrench,
    iconBg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
    iconBgActive: 'bg-amber-500 text-white border-amber-500',
    cardActive: 'border-amber-500 ring-2 ring-amber-500/25 shadow-[0_4px_20px_-4px_rgb(245_158_11_/_0.3)]',
    accentBar: 'bg-amber-500',
    labelKey: 'typeSelector.repair',
    descKey: 'typeSelector.repairDesc',
  },
  {
    value: 'inspection' as const,
    icon: ClipboardCheck,
    iconBg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    iconBgActive: 'bg-emerald-500 text-white border-emerald-500',
    cardActive: 'border-emerald-500 ring-2 ring-emerald-500/25 shadow-[0_4px_20px_-4px_rgb(16_185_129_/_0.3)]',
    accentBar: 'bg-emerald-500',
    labelKey: 'typeSelector.inspection',
    descKey: 'typeSelector.inspectionDesc',
  },
  {
    value: 'parts' as const,
    icon: Package,
    iconBg: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
    iconBgActive: 'bg-blue-500 text-white border-blue-500',
    cardActive: 'border-blue-500 ring-2 ring-blue-500/25 shadow-[0_4px_20px_-4px_rgb(59_130_246_/_0.3)]',
    accentBar: 'bg-blue-500',
    labelKey: 'typeSelector.parts',
    descKey: 'typeSelector.partsDesc',
  },
];

export function TicketTypeSelector({
  selected,
  onChange,
}: {
  selected: TicketType | null;
  onChange: (t: TicketType) => void;
}) {
  const { t } = useTranslation('ticket');

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {TYPES.map(({ value, icon: Icon, iconBg, iconBgActive, cardActive, accentBar, labelKey, descKey }) => {
        const isActive = selected === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            className={cn(
              'group relative flex cursor-pointer flex-col gap-3 overflow-hidden rounded-xl border bg-card p-4 text-left transition-all duration-200',
              isActive
                ? cardActive + ' -translate-y-0.5'
                : 'border-border hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md',
            )}
          >
            {/* 좌측 accent 바 */}
            <div className={cn(
              'absolute left-0 top-0 h-full w-1 transition-opacity',
              accentBar,
              isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-40',
            )} />

            {/* 체크 마크 (active) */}
            {isActive && (
              <div className={cn('absolute right-3 top-3 flex size-5 items-center justify-center rounded-full', accentBar)}>
                <Check className="size-3 text-white" strokeWidth={3} />
              </div>
            )}

            <div className={cn(
              'flex size-10 items-center justify-center rounded-lg border transition-all',
              isActive ? iconBgActive : iconBg,
            )}>
              <Icon className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">{t(labelKey)}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{t(descKey)}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
