import { Box, Globe } from 'lucide-react';
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
import type { SceneTransformSpace } from '../model/types';

interface SceneTransformSpaceToggleProps {
  space: SceneTransformSpace;
  onSpaceChange: (space: SceneTransformSpace) => void;
  /** scale 모드처럼 three 가 축 기준을 강제하는 동안 잠근다. */
  disabled?: boolean;
  className?: string;
}

const TRANSFORM_SPACES: SceneTransformSpace[] = ['local', 'world'];
const TRANSFORM_SPACE_ICON = {
  local: Box,
  world: Globe,
} as const;

function isSceneTransformSpace(value: string): value is SceneTransformSpace {
  return TRANSFORM_SPACES.includes(value as SceneTransformSpace);
}

/**
 * 기즈모 축 기준(로컬/월드) 토글. SceneTransformModeToggle 과 같은 모양의
 * 단일 선택 ToggleGroup 이라 도구 모음에서 나란히 놓인다.
 */
export function SceneTransformSpaceToggle({
  space,
  onSpaceChange,
  disabled = false,
  className,
}: SceneTransformSpaceToggleProps) {
  const { t } = useTranslation();

  const handleValueChange = (values: string[]) => {
    if (values.length === 0) {
      return;
    }

    const nextSpace = values[values.length - 1];
    if (!isSceneTransformSpace(nextSpace)) {
      return;
    }

    onSpaceChange(nextSpace);
  };

  return (
    <TooltipProvider>
      <ToggleGroup
        value={[space]}
        onValueChange={handleValueChange}
        aria-label={t('monitoring:transform.space.title')}
        className={cn(
          'bg-background/95 border-border/80 h-[34px] rounded-lg border p-px shadow-sm backdrop-blur-sm',
          className,
        )}
      >
        {TRANSFORM_SPACES.map((transformSpace) => {
          const label = t(`monitoring:transform.space.${transformSpace}`);
          const Icon = TRANSFORM_SPACE_ICON[transformSpace];

          return (
            <Tooltip key={transformSpace}>
              <TooltipTrigger
                render={
                  <ToggleGroupItem
                    value={transformSpace}
                    aria-label={label}
                    disabled={disabled}
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
    </TooltipProvider>
  );
}
