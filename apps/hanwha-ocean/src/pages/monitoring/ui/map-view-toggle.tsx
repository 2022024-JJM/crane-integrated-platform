import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Map as MapIcon, Satellite } from 'lucide-react';
import { cn } from '@crane/core/lib/utils';
import {
  MAP_OVERLAY_LABEL,
  MAP_OVERLAY_PLATE,
} from '../model/map-overlay-style';
import { GlassSurface } from './glass-surface';

export type MapView = 'roadmap' | 'hybrid';

interface MapViewToggleProps {
  value: MapView;
  onChange: (next: MapView) => void;
}

/**
 * 배경 지도 전환 — 일반 지도 / 위성.
 *
 * 선택 상태는 유리판 위에 **떠 있는 흰 칸**이 나른다. 이전에는
 * `bg-foreground/10` 이라 배경 위에서 거의 구분되지 않았다 — 지금 무엇을
 * 보고 있는지 컨트롤이 말해 주지 않았다는 뜻이다. 선택 칸이 자기 그림자를
 * 갖기 때문에 색을 세게 쓰지 않고도 한 겹 위로 읽히고, 상태색(초록·주황·
 * 빨강)과 겹치지 않아 지도의 알람 체계와 섞이지 않는다.
 */
export function MapViewToggle({ value, onChange }: MapViewToggleProps) {
  const { t } = useTranslation();

  return (
    <GlassSurface className={cn('pointer-events-auto', MAP_OVERLAY_PLATE)}>
      <div
        role="group"
        aria-label={t('monitoring-overview:map.view.toggleAriaLabel')}
        className="flex items-stretch gap-1 p-1.5"
      >
        <ToggleButton
          active={value === 'roadmap'}
          onClick={() => onChange('roadmap')}
        >
          <MapIcon className="size-[18px] shrink-0" strokeWidth={1.75} />
          {t('monitoring-overview:map.view.map')}
        </ToggleButton>
        <ToggleButton
          active={value === 'hybrid'}
          onClick={() => onChange('hybrid')}
        >
          <Satellite className="size-[18px] shrink-0" strokeWidth={1.75} />
          {t('monitoring-overview:map.view.satellite')}
        </ToggleButton>
      </div>
    </GlassSurface>
  );
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-sm px-3.5',
        'transition-all duration-200 ease-out',
        'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset',
        MAP_OVERLAY_LABEL,
        active
          ? cn(
              'text-foreground font-semibold',
              'bg-white shadow-[0_1px_2px_rgb(0_0_0/0.2),0_0_0_1px_rgb(0_0_0/0.09)]',
              'dark:bg-white/22 dark:shadow-[0_1px_2px_rgb(0_0_0/0.5),inset_0_1px_0_rgb(255_255_255/0.22)]',
            )
          : 'text-foreground/60 hover:bg-foreground/[0.06] hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}
