import {
  CheckCircle2,
  Download,
  Keyboard,
  Loader2,
  Save,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/utils';
import { Badge } from '@/shared/ui/atoms/badge';
import { Button } from '@/shared/ui/atoms/button';
import { CardHeader } from '@/shared/ui/molecules/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/ui/molecules/tooltip';

interface PaletteHeaderProps {
  onSave: () => void;
  onExport: () => void;
  saveDisabled: boolean;
  exportDisabled: boolean;
  isDirty: boolean;
  isSaving: boolean;
}

export function PaletteHeader({
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
    <CardHeader className="border-b border-border px-2.5 py-2.5">
      <div className="flex items-center justify-between gap-2">
        {!saveDisabled ? (
          <Badge
            variant="outline"
            className={cn(
              'h-5 rounded-sm border px-1.5 text-[9px] font-medium tracking-[0.02em]',
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
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={saveDisabled || isSaving}
            className="h-6 cursor-pointer rounded-sm border-border bg-muted px-2 text-[11px] text-foreground hover:bg-muted/80"
            onClick={onSave}
          >
            {isSaving ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Save className="size-3.5" />
            )}
            Save
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={exportDisabled}
            className="h-6 cursor-pointer rounded-sm border-border bg-muted px-2 text-[11px] text-foreground hover:bg-muted/80"
            onClick={onExport}
          >
            <Download className="size-3.5" />
            {t('monitoring:editor.exportJson')}
          </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('monitoring:editor.keyboardShortcuts')}
                    className="size-6 cursor-pointer rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                  />
                }
              >
                <Keyboard className="size-3.5" />
              </TooltipTrigger>
              <TooltipContent side="bottom" align="end">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <kbd className="rounded bg-muted px-1 font-mono text-[10px]">
                      Ctrl+Z
                    </kbd>
                    <span>{t('monitoring:history.undo')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <kbd className="rounded bg-muted px-1 font-mono text-[10px]">
                      Ctrl+Y
                    </kbd>
                    <span>{t('monitoring:history.redo')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <kbd className="rounded bg-muted px-1 font-mono text-[10px]">
                      Del
                    </kbd>
                    <span>{t('monitoring:editor.deleteSelected')}</span>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </CardHeader>
  );
}
