import { Download, Loader2, Save } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
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
  isSaving: boolean;
}

export const PaletteHeader = memo(function PaletteHeader({
  onSave,
  onExport,
  saveDisabled,
  exportDisabled,
  isSaving,
}: PaletteHeaderProps) {
  const { t } = useTranslation();

  return (
    <CardHeader className="border-border border-b border-b-0 px-2.5 py-2">
      <div className="flex items-center justify-end gap-2">
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
