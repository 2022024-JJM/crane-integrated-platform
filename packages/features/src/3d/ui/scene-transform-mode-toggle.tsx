import { Move3d, Rotate3d, Scale3d } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@crane/core/lib/utils';
import { Kbd } from '@crane/ui/atoms/kbd';
import { ToggleGroup, ToggleGroupItem } from '@crane/ui/molecules/toggle-group';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@crane/ui/molecules/tooltip';
import type { SceneTransformMode } from '../model/types';

interface SceneTransformModeToggleProps {
  mode: SceneTransformMode;
  onModeChange: (mode: SceneTransformMode) => void;
  className?: string;
  orientation?: 'horizontal' | 'vertical';
  /** 모드별 단축키 표기(툴팁에 Kbd 로 병기). 바인딩은 호출측 몫이다. */
  shortcuts?: Partial<Record<SceneTransformMode, string>>;
  /** 툴팁이 뜨는 방향. 세로 배치에서는 right 가 자연스럽다. */
  tooltipSide?: 'top' | 'bottom' | 'left' | 'right';
}

const TRANSFORM_MODES: SceneTransformMode[] = ['translate', 'rotate', 'scale'];
const TRANSFORM_MODE_ICON = {
  translate: Move3d,
  rotate: Rotate3d,
  scale: Scale3d,
} as const;

/**
 * 모달 도구(항상 하나만 활성)의 활성 표현 — 배경 채움. 상태 토글(스냅·격자)
 * 의 약한 표현(하단 점)과 구분되는 가장 강한 시각 언어다. toggleVariants 의
 * `aria-pressed:bg-muted` 는 ToggleGroupItem 안의 cn() 이 이 클래스로
 * 덮어쓴다.
 */
const MODE_ITEM_CLASS =
  // 이웃 아이콘 버튼(Button variant="ghost" size="icon-sm")과 같은 상자
  // 모양을 만든다 — Button 은 `border border-transparent bg-clip-padding`
  // 이라 배경이 1px 안쪽으로 그려지고 다크 hover 는 `bg-muted/50` 인데
  // toggleVariants 는 둘 다 없어 hover·선택 배경이 한 둘레 크고 진했다.
  'text-muted-foreground hover:text-foreground dark:hover:bg-muted/50 size-8 rounded-md border border-transparent bg-clip-padding p-0 active:translate-y-px aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary aria-pressed:hover:text-primary-foreground dark:aria-pressed:hover:bg-primary';

function isSceneTransformMode(value: string): value is SceneTransformMode {
  return TRANSFORM_MODES.includes(value as SceneTransformMode);
}

/**
 * 이동/회전/크기 라디오 그룹. 툴팁 Provider 는 감싸는 도구 모음이 제공한다.
 */
export function SceneTransformModeToggle({
  mode,
  onModeChange,
  className,
  orientation = 'horizontal',
  shortcuts,
  tooltipSide = 'top',
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
    <ToggleGroup
      value={[mode]}
      onValueChange={handleValueChange}
      orientation={orientation}
      spacing={0.5}
      aria-label={t('monitoring:transform.title')}
      className={cn('rounded-md', className)}
    >
      {TRANSFORM_MODES.map((transformMode) => {
        const label = t(`monitoring:transform.mode.${transformMode}`);
        const shortcut = shortcuts?.[transformMode];
        const Icon = TRANSFORM_MODE_ICON[transformMode];

        return (
          <Tooltip key={transformMode}>
            <TooltipTrigger
              render={
                <ToggleGroupItem
                  value={transformMode}
                  aria-label={label}
                  className={MODE_ITEM_CLASS}
                />
              }
            >
              <Icon className="size-4" />
            </TooltipTrigger>
            <TooltipContent side={tooltipSide}>
              {label}
              {shortcut ? <Kbd>{shortcut}</Kbd> : null}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </ToggleGroup>
  );
}
