import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@crane/core/lib/utils';
import { Button } from '@crane/ui/atoms/button';
import {
  Popover,
  PopoverPopup,
  PopoverTrigger,
} from '@crane/ui/molecules/popover';
import { ToggleGroup, ToggleGroupItem } from '@crane/ui/molecules/toggle-group';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@crane/ui/molecules/tooltip';
import type { SceneTransformPivot, SceneTransformSpace } from '../model/types';

interface SceneTransformPivotMenuProps {
  space: SceneTransformSpace;
  onSpaceChange: (space: SceneTransformSpace) => void;
  pivot: SceneTransformPivot;
  onPivotChange: (pivot: SceneTransformPivot) => void;
  /** 씬 미로드 — 트리거 자체를 잠근다. */
  disabled?: boolean;
  className?: string;
}

const TRANSFORM_SPACES: SceneTransformSpace[] = ['local', 'world'];
const TRANSFORM_PIVOTS: SceneTransformPivot[] = ['individual', 'primary'];

function isSceneTransformSpace(value: unknown): value is SceneTransformSpace {
  return (
    typeof value === 'string' &&
    TRANSFORM_SPACES.includes(value as SceneTransformSpace)
  );
}

function isSceneTransformPivot(value: unknown): value is SceneTransformPivot {
  return (
    typeof value === 'string' &&
    TRANSFORM_PIVOTS.includes(value as SceneTransformPivot)
  );
}

/** 세그먼트에서 마지막으로 눌린 값. 빈 배열(같은 항목 재클릭)은 무시한다. */
function lastValue(values: string[]): string | undefined {
  return values[values.length - 1];
}

// 스냅 단위 팝업(editor-header-bar 의 SnapSplitButton)과 같은 행 골격 —
// 고정 폭 라벨 + 남은 폭을 균등 분배하는 세그먼트.
const ROW_CLASS = 'flex items-center gap-3 text-xs';
const ROW_LABEL_CLASS = 'text-muted-foreground w-14 shrink-0';
const SEGMENT_CLASS = 'h-7 w-auto flex-1';
const SEGMENT_ITEM_CLASS =
  'text-muted-foreground aria-pressed:bg-muted aria-pressed:text-foreground h-full min-w-0 flex-1 basis-0 px-2 text-[11px] font-medium';

/**
 * "피벗" 팝업 — 기즈모 좌표축(로컬/월드)과 다중 선택 원점(개별/마지막 선택)을
 * 한 트리거로 묶는다. 둘 다 "기즈모가 무엇을 기준으로 움직이는가" 라 툴바
 * 에서는 피벗 하나로 부르고, 팝업 안에서 행으로 나눈다.
 *
 * 트리거는 텍스트만(아이콘 없음) 두고 현재 값은 hover 툴팁에 병기한다 —
 * SelectTrigger ghost 와 같은 상자·글자색이라 이웃 컨트롤과 높이가 맞는다.
 * 팝업 행은 스냅 단위 팝업과 같은 골격이다.
 *
 * 크기 모드에서도 좌표축 행을 잠그지 않는다 — three TransformControls 는
 * scale 에서 어차피 local 로 동작하고, 선택값은 이동/회전 모드로 돌아올 때
 * 그대로 이어진다.
 */
export function SceneTransformPivotMenu({
  space,
  onSpaceChange,
  pivot,
  onPivotChange,
  disabled = false,
  className,
}: SceneTransformPivotMenuProps) {
  const { t } = useTranslation();
  const triggerLabel = t('monitoring:transform.pivotMenu.trigger');
  const spaceTitle = t('monitoring:transform.space.title');
  const pivotTitle = t('monitoring:transform.pivot.title');
  const tooltip = `${triggerLabel} (${t(`monitoring:transform.space.${space}`)} · ${t(`monitoring:transform.pivot.${pivot}`)})`;

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={tooltip}
                  disabled={disabled}
                  className={cn(
                    'text-muted-foreground hover:text-foreground data-popup-open:bg-muted data-popup-open:text-foreground h-7 gap-1.5 rounded-md px-2 text-xs',
                    className,
                  )}
                />
              }
            />
          }
        >
          <span>{triggerLabel}</span>
          <ChevronDown className="size-3 shrink-0 text-current" />
        </TooltipTrigger>
        <TooltipContent side="bottom">{tooltip}</TooltipContent>
      </Tooltip>
      <PopoverPopup side="bottom" align="end" className="w-72 p-3">
        <p className="text-foreground mb-2 text-sm font-semibold">
          {t('monitoring:transform.pivotMenu.title')}
        </p>
        <div className="flex flex-col gap-2">
          <div className={ROW_CLASS}>
            <span className={ROW_LABEL_CLASS}>{spaceTitle}</span>
            <ToggleGroup
              value={[space]}
              onValueChange={(values) => {
                const next = lastValue(values);
                if (isSceneTransformSpace(next) && next !== space) {
                  onSpaceChange(next);
                }
              }}
              spacing={0}
              variant="outline"
              size="sm"
              aria-label={spaceTitle}
              className={SEGMENT_CLASS}
            >
              {TRANSFORM_SPACES.map((option) => (
                <ToggleGroupItem
                  key={option}
                  value={option}
                  className={SEGMENT_ITEM_CLASS}
                >
                  {t(`monitoring:transform.space.${option}`)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <div className={ROW_CLASS}>
            <span className={ROW_LABEL_CLASS}>{pivotTitle}</span>
            <ToggleGroup
              value={[pivot]}
              onValueChange={(values) => {
                const next = lastValue(values);
                if (isSceneTransformPivot(next) && next !== pivot) {
                  onPivotChange(next);
                }
              }}
              spacing={0}
              variant="outline"
              size="sm"
              aria-label={pivotTitle}
              className={SEGMENT_CLASS}
            >
              {TRANSFORM_PIVOTS.map((option) => (
                <ToggleGroupItem
                  key={option}
                  value={option}
                  className={SEGMENT_ITEM_CLASS}
                >
                  {t(`monitoring:transform.pivot.${option}`)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </div>
      </PopoverPopup>
    </Popover>
  );
}
