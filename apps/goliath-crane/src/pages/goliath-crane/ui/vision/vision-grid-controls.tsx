import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
} from '@crane/ui/molecules/select';
import {
  VISION_SOURCE_FILTERS,
  type VisionSourceFilter,
} from './types';

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
        <SelectPopup align="end">
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

interface VisionSourceFilterControlsProps {
  value: VisionSourceFilter;
  onChange: (value: VisionSourceFilter) => void;
}

export function VisionSourceFilterControls({
  value,
  onChange,
}: VisionSourceFilterControlsProps) {
  const { t } = useTranslation('goliath-crane');
  const optionLabel = (filter: VisionSourceFilter) =>
    t(`vision.sourceOption.${filter}`);
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
        {t('vision.source')}
      </span>
      <Select
        value={value}
        onValueChange={(next: string) => onChange(next as VisionSourceFilter)}
      >
        <SelectTrigger
          label={optionLabel(value)}
          aria-label={t('vision.source')}
        />
        <SelectPopup align="end">
          {VISION_SOURCE_FILTERS.map((filter) => (
            <SelectItem key={filter} value={filter}>
              {optionLabel(filter)}
            </SelectItem>
          ))}
        </SelectPopup>
      </Select>
    </div>
  );
}

