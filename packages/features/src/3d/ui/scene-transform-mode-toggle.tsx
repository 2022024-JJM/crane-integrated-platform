import { Move3d, RotateCw, Scale3d } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@crane/core/lib/utils';
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
          className="bg-background/95 border-border/80 rounded-lg border p-1 shadow-sm backdrop-blur-sm"
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
                      className="text-muted-foreground hover:text-foreground aria-pressed:bg-muted aria-pressed:text-foreground size-10 cursor-pointer justify-center rounded-md p-0 aria-pressed:shadow-sm"
                    >
                      <Icon className="size-4" />
                    </ToggleGroupItem>
                  }
                />
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
