import { useTranslation } from 'react-i18next';
import { cn } from '@crane/core/lib/utils';
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
} from '@crane/ui/molecules/select';
import type { SceneTransformPivot } from '../model/types';

interface SceneTransformPivotSelectProps {
  pivot: SceneTransformPivot;
  onPivotChange: (pivot: SceneTransformPivot) => void;
  disabled?: boolean;
  className?: string;
}

const TRANSFORM_PIVOTS: SceneTransformPivot[] = ['individual', 'primary'];

function isSceneTransformPivot(value: unknown): value is SceneTransformPivot {
  return (
    typeof value === 'string' &&
    TRANSFORM_PIVOTS.includes(value as SceneTransformPivot)
  );
}

/**
 * 다중 선택 변형 기준점(개별 원점/기준 원점) 콤보박스 —
 * SceneTransformSpaceSelect 와 같은 모양·높이. 단일 선택·이동 모드에서는
 * 효과가 없지만 세션 설정이라 잠그지 않는다.
 */
export function SceneTransformPivotSelect({
  pivot,
  onPivotChange,
  disabled = false,
  className,
}: SceneTransformPivotSelectProps) {
  const { t } = useTranslation();

  return (
    <Select
      value={pivot}
      onValueChange={(value: unknown) => {
        if (isSceneTransformPivot(value) && value !== pivot) {
          onPivotChange(value);
        }
      }}
      disabled={disabled}
    >
      <SelectTrigger
        variant="ghost"
        aria-label={t('monitoring:transform.pivot.title')}
        label={t(`monitoring:transform.pivot.${pivot}`)}
        className={cn('h-7 rounded-md px-2', className)}
      />
      <SelectPopup align="end">
        {TRANSFORM_PIVOTS.map((transformPivot) => (
          <SelectItem key={transformPivot} value={transformPivot}>
            {t(`monitoring:transform.pivot.${transformPivot}`)}
          </SelectItem>
        ))}
      </SelectPopup>
    </Select>
  );
}
