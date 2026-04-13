import { Move3d, RotateCw, Scale3d } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@crane/core/lib/utils';
import { Button } from '@crane/ui/atoms/button';
import { ToggleGroup, ToggleGroupItem } from '@crane/ui/molecules/toggle-group';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@crane/ui/molecules/tooltip';
import type { SceneTransformMode } from '../model/types';

interface SceneTransformModeToggleProps {
  mode: SceneTransformMode;
  className?: string;
  onModeChange: (mode: SceneTransformMode) => void;
  leadingContent?: ReactNode;
  trailingContent?: ReactNode;
}

const TRANSFORM_MODES: SceneTransformMode[] = ['translate', 'rotate', 'scale'];
const TRANSFORM_MODE_ICON = {
  translate: Move3d,
  rotate: RotateCw,
  scale: Scale3d,
} as const;

function isSceneTransformMode(value: string): value is SceneTransformMode {
  return TRANSFORM_MODES.includes(value as SceneTransformMode);
}

export function SceneTransformModeToggle({
  mode,
  className,
  onModeChange,
  leadingContent,
  trailingContent,
}: SceneTransformModeToggleProps) {
  const { t } = useTranslation();

  const handleValueChange = (values: string[]) => {
    if (values.length === 0) {
      return;
    }

    const nextMode = values[values.length - 1];
    if (!isSceneTransformMode(nextMode)) {
      return;
    }

    onModeChange(nextMode);
  };

  return (
    <TooltipProvider>
      <div className={cn('flex items-center gap-2', className)}>
        {leadingContent}
        <ToggleGroup
          value={[mode]}
          onValueChange={handleValueChange}
          aria-label={t('monitoring:transform.title')}
          className="bg-background/95 border-border/80 h-[34px] rounded-lg border p-px shadow-sm backdrop-blur-sm"
        >
          {TRANSFORM_MODES.map((transformMode) => {
            const label = t(`monitoring:transform.mode.${transformMode}`);
            const Icon = TRANSFORM_MODE_ICON[transformMode];

            return (
              <Tooltip key={transformMode}>
                <TooltipTrigger
                  render={
                    <ToggleGroupItem
                      value={transformMode}
                      aria-label={label}
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground aria-pressed:bg-muted aria-pressed:text-foreground size-8 rounded-md"
                        />
                      }
                    />
                  }
                >
                  <Icon className="size-4" />
                </TooltipTrigger>
                <TooltipContent>{label}</TooltipContent>
              </Tooltip>
            );
          })}
        </ToggleGroup>
        {trailingContent}
      </div>
    </TooltipProvider>
  );
}
