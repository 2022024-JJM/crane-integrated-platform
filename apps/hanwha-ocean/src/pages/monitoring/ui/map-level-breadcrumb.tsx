import { useTranslation } from 'react-i18next';
import { ChevronRight, Globe2 } from 'lucide-react';
import { cn } from '@crane/core/lib/utils';
import type { Site } from '@crane/domain/region';
import {
  MAP_OVERLAY_LABEL,
  MAP_OVERLAY_PLATE,
} from '../model/map-overlay-style';
import { getStatusPalette, withAlpha } from '../model/region-map-types';
import { useSiteRealtimeStatus } from '../model/use-site-realtime-status';
import { GlassSurface } from './glass-surface';

interface MapLevelBreadcrumbProps {
  /** 진입한 사이트. null 이면 세계 레벨 */
  site: Site | null;
  onReturnToWorld: () => void;
}

/**
 * 지도의 현재 위치와 되돌아가는 길을 한 줄로 잡는 컨트롤.
 *
 * 이전에는 세 조각이 이 일을 나눠 갖고 있었다 — 상단 중앙의 고정 문구
 * ("Crane Ops / Global Fleet Map"), 우상단의 사이트 칩, 그 옆의 "세계 보기"
 * 버튼. 첫 번째는 항상 같은 글자라 정보가 없었고, 뒤의 둘은 "여기가 어디"와
 * "어떻게 나가나"를 굳이 갈라 놓아 관계가 보이지 않았다.
 *
 * 브레드크럼은 셋을 하나로 합친다. 세계 레벨에서는 칸이 하나뿐이라 클릭
 * 대상이 아니고(현재 위치), 사이트로 들어가면 앞 칸이 버튼이 되면서
 * 되돌아갈 곳이 그 자리에 그대로 드러난다.
 */
export function MapLevelBreadcrumb({
  site,
  onReturnToWorld,
}: MapLevelBreadcrumbProps) {
  const { t } = useTranslation();
  const globalLabel = t('monitoring-overview:map.breadcrumb.global');
  const inSite = site !== null;

  return (
    <GlassSurface className={cn('pointer-events-auto', MAP_OVERLAY_PLATE)}>
      <nav
        aria-label={t('monitoring-overview:map.breadcrumb.ariaLabel')}
        className="flex items-stretch p-1.5"
      >
        {inSite ? (
          <button
            type="button"
            onClick={onReturnToWorld}
            title={t('monitoring-overview:map.breadcrumb.backToGlobal')}
            className={cn(
              'text-foreground/55 hover:text-foreground hover:bg-foreground/8',
              'flex cursor-pointer items-center gap-2 rounded-sm px-3',
              'focus-visible:ring-ring transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset',
              MAP_OVERLAY_LABEL,
            )}
          >
            <Globe2 className="size-[18px] shrink-0" strokeWidth={1.75} />
            {globalLabel}
          </button>
        ) : (
          <span
            aria-current="page"
            className={cn(
              'text-foreground flex items-center gap-2 px-3',
              MAP_OVERLAY_LABEL,
            )}
          >
            <Globe2 className="size-[18px] shrink-0" strokeWidth={1.75} />
            {globalLabel}
          </span>
        )}

        {inSite ? (
          <>
            <ChevronRight
              aria-hidden
              className="text-foreground/30 size-4 shrink-0 self-center"
              strokeWidth={2}
            />
            <SiteCrumb site={site} />
          </>
        ) : null}
      </nav>
    </GlassSurface>
  );
}

/**
 * 사이트 칸. 실시간 상태 훅을 부르므로 사이트가 있을 때만 마운트되도록
 * 컴포넌트를 따로 뒀다 (훅을 조건부로 호출할 수 없다).
 */
function SiteCrumb({ site }: { site: Site }) {
  const { t } = useTranslation();
  const status = useSiteRealtimeStatus(site);
  const palette = getStatusPalette(status);
  const country = t(site.countryKey, { defaultValue: '' });

  return (
    <span
      aria-current="page"
      className={cn('flex items-center gap-2 px-3', MAP_OVERLAY_LABEL)}
      style={{ animation: 'map-crumb-reveal 260ms ease-out both' }}
    >
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-full"
        style={{
          backgroundColor: palette.fillColor,
          boxShadow: `0 0 0 3px ${withAlpha(palette, 0.18)}`,
        }}
      />
      <span className="text-foreground max-w-[220px] truncate font-semibold">
        {t(site.displayNameKey)}
      </span>
      {country ? <span className="text-foreground/45">{country}</span> : null}
    </span>
  );
}
