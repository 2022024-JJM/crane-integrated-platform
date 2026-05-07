import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
} from '@crane/ui/molecules/select';

export type GridSize = 1 | 2 | 3 | 4;

export const GRID_SIZES: readonly GridSize[] = [1, 2, 3, 4] as const;

interface VisionGridControlsProps {
  value: GridSize;
  onChange: (value: GridSize) => void;
}

const formatLabel = (size: GridSize) => `${size}×${size}`;

export function VisionGridControls({
  value,
  onChange,
}: VisionGridControlsProps) {
  const { t } = useTranslation('goliath-crane');
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
        {t('vision.layout')}
      </span>
      <Select
        value={String(value)}
        onValueChange={(next: string) => onChange(Number(next) as GridSize)}
      >
        <SelectTrigger
          className="font-mono"
          label={formatLabel(value)}
          aria-label={t('vision.layout')}
        />
        <SelectPopup>
          {GRID_SIZES.map((size) => (
            <SelectItem
              key={size}
              value={String(size)}
              className="font-mono"
            >
              {formatLabel(size)}
            </SelectItem>
          ))}
        </SelectPopup>
      </Select>
    </div>
  );
}
