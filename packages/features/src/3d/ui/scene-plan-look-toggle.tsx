import { useTranslation } from 'react-i18next';
import { cn } from '@crane/core/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@crane/ui/molecules/tooltip';
import { usePlanLookStore } from '../model/use-plan-look-store';

// 판 — 캔버스 위 버튼(SCENE_TOOLBAR_BUTTON_CLASS)과 같은 반투명 판. 높이는
// 고정 뷰 줄의 버튼(size="sm")과 같은 28px.
const PLATE_CLASS =
  'pointer-events-auto flex h-7 items-stretch gap-0.5 rounded-md bg-white/40 p-0.5 backdrop-blur-sm dark:bg-black/40';

const SEGMENT_CLASS =
  'min-w-8 cursor-pointer rounded-sm px-2 text-xs font-semibold tabular-nums transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50';

// 선택 칸은 판 위에 떠 있는 흰 칸 — 관제 지도의 지도/위성 전환
// (MapViewToggle)과 같은 표현. 상태색(초록·주황·빨강)을 쓰지 않는다.
const SELECTED_CLASS =
  'bg-white text-black shadow-[0_1px_2px_rgb(0_0_0/0.2),0_0_0_1px_rgb(0_0_0/0.09)] dark:bg-white/22 dark:text-white dark:shadow-[0_1px_2px_rgb(0_0_0/0.5),inset_0_1px_0_rgb(255_255_255/0.22)]';

const UNSELECTED_CLASS =
  'text-black/60 hover:bg-white/30 hover:text-black dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white';

/**
 * 2D/3D 탑뷰 전환 — 탑뷰 중에만 우상단 고정 뷰 줄 바로 아래(줄이 없으면 맨
 * 위)에 뜨는 두 칸 토글. 직교 카메라는 그대로 두고 평면도 룩 스위치
 * (use-plan-look-store)만 바꾼다 — 2D = 직교 + 평면도 룩, 3D = 직교만.
 * 모니터링·3D 플레이·에디터가 같은 컴포넌트를 쓰고 스위치가 전역이라 한
 * 화면에서 고른 모드가 다른 화면의 탑뷰에도 따라간다. 보일지는 호출자가
 * 탑뷰 상태로 정한다.
 */
export function ScenePlanLookToggle({ className }: { className?: string }) {
  const { t } = useTranslation();
  const planLook = usePlanLookStore((s) => s.enabled);
  const setPlanLook = usePlanLookStore((s) => s.setEnabled);

  const segment = (wantPlanLook: boolean, text: string, label: string) => {
    const selected = planLook === wantPlanLook;
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-label={label}
              aria-pressed={selected}
              className={cn(
                SEGMENT_CLASS,
                selected ? SELECTED_CLASS : UNSELECTED_CLASS,
              )}
            />
          }
          onClick={() => setPlanLook(wantPlanLook)}
        >
          {text}
        </TooltipTrigger>
        <TooltipContent side="bottom">{label}</TooltipContent>
      </Tooltip>
    );
  };

  return (
    <TooltipProvider delay={150}>
      <div
        role="group"
        aria-label={t('common:viewer3d.topView')}
        className={cn(PLATE_CLASS, className)}
      >
        {segment(true, '2D', t('common:viewer3d.topView2d'))}
        {segment(false, '3D', t('common:viewer3d.topView3d'))}
      </div>
    </TooltipProvider>
  );
}
