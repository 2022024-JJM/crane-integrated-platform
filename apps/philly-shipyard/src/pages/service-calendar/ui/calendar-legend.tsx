import { useTranslation } from 'react-i18next';
import { cn } from '@crane/core/lib/utils';
import { LEGEND } from '../model/colors';

/** 색상 범례 — 점검(상태축) / 정비(우선순위축)를 그룹으로 분리해 색 의미를 명시 */
export function CalendarLegend() {
  const { t } = useTranslation('calendar');

  const groups = [
    { label: t('source.inspection'), items: LEGEND.inspection, kind: 'status' as const },
    { label: t('source.repair'), items: LEGEND.repair, kind: 'priority' as const },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2">
      {groups.map((group) => (
        <div key={group.label} className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {group.label}
          </span>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {group.items.map((item) => (
              <span key={item.key} className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <span className={cn('size-2 rounded-full', item.accent)} />
                {t(`${group.kind}.${item.key}`)}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
