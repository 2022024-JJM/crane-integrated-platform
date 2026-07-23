import { Wrench, ClipboardCheck, Package, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@crane/core/lib/utils';

export type TicketType = 'repair' | 'inspection' | 'parts';

// 타입 구분은 아이콘·라벨로 충분 — 선택 상태만 primary로 강조한다.
const TYPES = [
  {
    value: 'repair' as const,
    icon: Wrench,
    labelKey: 'typeSelector.repair',
    descKey: 'typeSelector.repairDesc',
  },
  {
    value: 'inspection' as const,
    icon: ClipboardCheck,
    labelKey: 'typeSelector.inspection',
    descKey: 'typeSelector.inspectionDesc',
  },
  {
    value: 'parts' as const,
    icon: Package,
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
      {TYPES.map(({ value, icon: Icon, labelKey, descKey }) => {
        const isActive = selected === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            className={cn(
              'group relative flex cursor-pointer flex-col gap-3 overflow-hidden rounded-xl border bg-card p-4 text-left transition-all duration-200',
              isActive
                ? 'border-primary ring-2 ring-primary/20 -translate-y-0.5 shadow-md'
                : 'border-border hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md',
            )}
          >
            {/* 좌측 accent 바 */}
            <div className={cn(
              'absolute left-0 top-0 h-full w-1 bg-primary transition-opacity',
              isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-30',
            )} />

            {/* 체크 마크 (active) */}
            {isActive && (
              <div className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-primary">
                <Check className="size-3 text-primary-foreground" strokeWidth={3} />
              </div>
            )}

            <div className={cn(
              'flex size-10 items-center justify-center rounded-lg border transition-all',
              isActive
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-muted text-muted-foreground group-hover:text-foreground',
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
