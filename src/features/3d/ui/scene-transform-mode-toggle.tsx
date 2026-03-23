import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/utils';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/shared/ui/molecules/toggle-group';
import type { SceneTransformMode } from '../model/types';

interface SceneTransformModeToggleProps {
  mode: SceneTransformMode;
  disabled?: boolean;
  className?: string;
  onModeChange: (mode: SceneTransformMode) => void;
}

const TRANSFORM_MODES: SceneTransformMode[] = ['translate', 'rotate', 'scale'];

function isSceneTransformMode(value: string): value is SceneTransformMode {
  return TRANSFORM_MODES.includes(value as SceneTransformMode);
}

export function SceneTransformModeToggle({
  mode,
  disabled = false,
  className,
  onModeChange,
}: SceneTransformModeToggleProps) {
  const { t } = useTranslation();

  const handleValueChange = (values: string[]) => {
    if (disabled || values.length === 0) {
      return;
    }

    const nextMode = values[values.length - 1];
    if (!isSceneTransformMode(nextMode)) {
      return;
    }

    onModeChange(nextMode);
  };

  return (
    <ToggleGroup
      value={[mode]}
      onValueChange={handleValueChange}
      aria-label={t('monitoring:transform.title')}
      className={cn(
        'bg-background/95 border-border/80 rounded-lg border p-1 shadow-sm backdrop-blur-sm',
        className,
      )}
    >
      {TRANSFORM_MODES.map((transformMode) => (
        <ToggleGroupItem
          key={transformMode}
          value={transformMode}
          disabled={disabled}
          aria-label={t(`monitoring:transform.mode.${transformMode}`)}
          className="text-muted-foreground hover:text-foreground aria-pressed:bg-muted aria-pressed:text-foreground min-w-20 justify-center rounded-md px-3 text-sm aria-pressed:shadow-sm"
        >
          {t(`monitoring:transform.mode.${transformMode}`)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
