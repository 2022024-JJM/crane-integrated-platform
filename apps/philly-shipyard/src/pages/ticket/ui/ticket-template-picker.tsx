import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
import { REPAIR_TEMPLATES, type RepairTemplate } from '@crane/features/ticket';
import { cn } from '@crane/core/lib/utils';
import { TOGGLE_ACTIVE, TOGGLE_BASE, TOGGLE_INACTIVE } from '../../../shared/ui/form';

interface TicketTemplatePickerProps {
  selectedId: string | null;
  onApply: (template: RepairTemplate) => void;
}

/** 자주 쓰는 수리 유형 원클릭 템플릿 — 선택 시 폼 대부분이 자동으로 채워진다. */
export function TicketTemplatePicker({ selectedId, onApply }: TicketTemplatePickerProps) {
  const { t } = useTranslation('ticket');

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-2.5 flex items-center gap-1.5">
        <Sparkles className="size-3.5 text-muted-foreground" />
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-foreground">
          {t('templates.title')}
        </h3>
        <span className="ml-auto text-[10px] text-muted-foreground/70">
          {t('templates.hint')}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {REPAIR_TEMPLATES.map((tpl) => {
          const isActive = selectedId === tpl.id;
          return (
            <button
              key={tpl.id}
              type="button"
              onClick={() => onApply(tpl)}
              title={t(tpl.descKey)}
              className={cn(TOGGLE_BASE, isActive ? TOGGLE_ACTIVE + ' shadow-sm' : TOGGLE_INACTIVE)}
            >
              {t(tpl.labelKey)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
