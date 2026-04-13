import { Redo2, Undo2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@crane/ui/atoms/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@crane/ui/molecules/tooltip';

interface SceneHistoryControlsProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

export function SceneHistoryControls({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: SceneHistoryControlsProps) {
  const { t } = useTranslation();

  return (
    <TooltipProvider>
      <div className="bg-background/95 border-border/80 flex h-[34px] items-center gap-1 rounded-lg border p-px shadow-sm backdrop-blur-sm">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t('monitoring:history.undo')}
                disabled={!canUndo}
                className="size-8 rounded-md"
              />
            }
            onClick={onUndo}
          >
            <Undo2 className="size-4" />
          </TooltipTrigger>
          <TooltipContent>{t('monitoring:history.undo')}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t('monitoring:history.redo')}
                disabled={!canRedo}
                className="size-8 rounded-md"
              />
            }
            onClick={onRedo}
          >
            <Redo2 className="size-4" />
          </TooltipTrigger>
          <TooltipContent>{t('monitoring:history.redo')}</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
