import { useTranslation } from 'react-i18next';
import { cn } from '@crane/core/lib/utils';
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
} from '@crane/ui/molecules/select';
import type { SceneTransformSpace } from '../model/types';

interface SceneTransformSpaceSelectProps {
  space: SceneTransformSpace;
  onSpaceChange: (space: SceneTransformSpace) => void;
  /** scale 모드처럼 three 가 축 기준을 강제하는 동안 잠근다. */
  disabled?: boolean;
  className?: string;
}

const TRANSFORM_SPACES: SceneTransformSpace[] = ['local', 'world'];

function isSceneTransformSpace(value: unknown): value is SceneTransformSpace {
  return (
    typeof value === 'string' &&
    TRANSFORM_SPACES.includes(value as SceneTransformSpace)
  );
}

/**
 * 기즈모 축 기준(로컬/월드) 콤보박스. 아이콘만으로는 뜻이 전달되지 않아
 * 텍스트 라벨을 쓴다.
 */
export function SceneTransformSpaceSelect({
  space,
  onSpaceChange,
  disabled = false,
  className,
}: SceneTransformSpaceSelectProps) {
  const { t } = useTranslation();

  return (
    <Select
      value={space}
      onValueChange={(value: unknown) => {
        if (isSceneTransformSpace(value) && value !== space) {
          onSpaceChange(value);
        }
      }}
      disabled={disabled}
    >
      {/* 도구 모음의 고스트 아이콘 버튼과 같은 높이(h-7)·언어(ghost). */}
      <SelectTrigger
        variant="ghost"
        aria-label={t('monitoring:transform.space.title')}
        label={t(`monitoring:transform.space.${space}`)}
        className={cn('h-7 rounded-md px-2', className)}
      />
      <SelectPopup align="end">
        {TRANSFORM_SPACES.map((transformSpace) => (
          <SelectItem key={transformSpace} value={transformSpace}>
            {t(`monitoring:transform.space.${transformSpace}`)}
          </SelectItem>
        ))}
      </SelectPopup>
    </Select>
  );
}
