import { CheckCircle2, Download, Loader2, Save } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@crane/core/lib/utils';
import { Badge } from '@crane/ui/atoms/badge';
import { Button } from '@crane/ui/atoms/button';
import { CardHeader } from '@crane/ui/molecules/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@crane/ui/molecules/tooltip';

interface PaletteHeaderProps {
  onSave: () => void;
  onExport: () => void;
  saveDisabled: boolean;
  exportDisabled: boolean;
  isDirty: boolean;
  isSaving: boolean;
}

export const PaletteHeader = memo(function PaletteHeader({
  onSave,
  onExport,
  saveDisabled,
  exportDisabled,
  isDirty,
  isSaving,
}: PaletteHeaderProps) {
  const { t } = useTranslation();
  const saveStatusLabel = isSaving
    ? t('monitoring:editor.statusSaving')
    : isDirty
      ? t('monitoring:editor.statusUnsaved')
      : t('monitoring:editor.statusSaved');
  const saveStatusClassName = isSaving
    ? 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-100'
    : isDirty
      ? 'border-orange-500/25 bg-orange-500/10 text-orange-700 dark:text-orange-100'
      : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-100';

  return (
    <CardHeader className="border-border border-b border-b-0 px-2.5 py-2">
      <div className="flex items-center justify-between gap-2">
        {!saveDisabled ? (
          <Badge
            variant="outline"
            className={cn(
              'h-6 rounded-sm border px-1.5 text-[10px] font-medium tracking-[0.02em]',
              saveStatusClassName,
            )}
          >
            {isSaving ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="size-3.5" />
            )}
            {saveStatusLabel}
          </Badge>
        ) : (
          <div />
        )}
        <TooltipProvider delay={150}>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-xs"
                    aria-label={t('monitoring:editor.save')}
                    disabled={saveDisabled || isSaving}
                    className="border-border bg-muted text-foreground hover:bg-muted/80 rounded-sm"
                  />
                }
                onClick={onSave}
              >
                {isSaving ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Save className="size-3.5" />
                )}
              </TooltipTrigger>
              <TooltipContent>{t('monitoring:editor.save')}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-xs"
                    aria-label={t('monitoring:editor.exportJson')}
                    disabled={exportDisabled}
                    className="border-border bg-muted text-foreground hover:bg-muted/80 rounded-sm"
                  />
                }
                onClick={onExport}
              >
                <Download className="size-3.5" />
              </TooltipTrigger>
              <TooltipContent>
                {t('monitoring:editor.exportJson')}
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>
    </CardHeader>
  );
});
