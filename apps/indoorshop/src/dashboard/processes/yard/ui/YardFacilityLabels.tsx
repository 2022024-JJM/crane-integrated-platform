import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import { cn } from '../../../shared/lib/utils'
import type { MapTheme } from '../lib/basemapStyle'
import {
  FACILITY_LABEL_MIN_SCALE,
  FACILITY_SMALL_SECTIONS,
  type YardFacility,
} from '../lib/facilities'
import { worldToScreen, type Viewport, type YardView } from '../lib/projection'

/** 화면 밖 라벨은 그리지 않는다 — 여백은 라벨 자체 폭만큼 */
const CULL_MARGIN = 120

/**
 * 맵 위에 뜨는 공장·샵 이름 — 네온 사인의 글자 부분이다.
 *
 * 캔버스가 아니라 DOM 인 이유는 조립공장 이름줄(YardShopChips)과 같다 — 글자가
 * 또렷해야 하고, 무엇보다 **누를 수 있어야** 한다. 공정 페이지가 연결된 공장은
 * 이름이 진짜 링크(`<a>`)라서 맵에서 이름을 누르면 그 공정 화면이 바로 열리고,
 * 연결이 없는 공장(전처리·미지정)은 눌러도 정보 카드만 뜬다.
 *
 * 글자색은 무채색(어두운 지도에서 흰색)이고 **공정색은 빛(그림자)으로만** 얹는다 —
 * 캔버스의 외곽선과 같은 규칙이라, 도형과 글자가 한 사인으로 읽힌다.
 */
export function YardFacilityLabels({
  facilities,
  view,
  viewport,
  mapTheme,
  selectedFacility,
  hoveredFacility,
  onSelectFacility,
  onHoverFacility,
  facilityHref,
}: {
  facilities: YardFacility[]
  view: YardView
  viewport: Viewport
  mapTheme: MapTheme
  selectedFacility?: string | null
  hoveredFacility?: string | null
  onSelectFacility?: (name: string | null) => void
  onHoverFacility?: (name: string | null) => void
  facilityHref?: (facility: YardFacility) => string | null
}) {
  const { t } = useTranslation()
  if (viewport.width === 0) return null

  /* 멀리서는 큰 공장만 — 작은 공장 이름까지 다 켜면 글자끼리 겹쳐 아무것도 못 읽는다 */
  const hideSmall = view.scale < FACILITY_LABEL_MIN_SCALE

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {facilities.map((facility) => {
        const active = facility.name === selectedFacility
        const hovered = facility.name === hoveredFacility
        if (hideSmall && facility.sections < FACILITY_SMALL_SECTIONS && !active && !hovered) {
          return null
        }

        const anchor = worldToScreen(view, viewport, facility.anchor.lat, facility.anchor.lon)
        if (
          anchor.sx < -CULL_MARGIN ||
          anchor.sy < -CULL_MARGIN ||
          anchor.sx > viewport.width + CULL_MARGIN ||
          anchor.sy > viewport.height + CULL_MARGIN
        ) {
          return null
        }

        const color = facility.process.color[mapTheme]
        const dim = selectedFacility !== null && !active
        /*
         * 어두운 지도: 흰 글자 + 공정색 발광 (네온). 밝은 지도: 공정색 글자 + 흰 테 —
         * 밝은 바탕에는 발광이 없으므로 색이 글자로 내려온다 (레퍼런스 뷰어의 두 모드).
         */
        const style: CSSProperties = {
          left: anchor.sx,
          top: anchor.sy,
          color: mapTheme === 'dark' ? '#ffffff' : color,
          textShadow:
            mapTheme === 'dark'
              ? `0 0 4px ${color}, 0 0 10px ${color}, 0 0 20px ${color}, 0 1px 2px #000`
              : '0 0 3px #fff, 0 0 3px #fff, 0 0 3px #fff',
          opacity: dim ? 0.25 : 1,
        }
        const className = cn(
          'pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer',
          'whitespace-nowrap font-bold tracking-wide transition-[font-size,opacity] duration-150',
          active ? 'text-inshop-sm' : 'text-2xs',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-glass-accent',
        )
        const href = facilityHref?.(facility) ?? null

        /* 공정 화면이 있는 공장은 이름이 곧 문이다 — 맵에서 이름을 누르면 바로 이동 */
        return href ? (
          <Link
            key={facility.name}
            to={href}
            style={style}
            className={className}
            title={t('yard.facility.openZone', {
              name: facility.name,
              process: facility.process.label,
            })}
            onPointerEnter={() => onHoverFacility?.(facility.name)}
            onPointerLeave={() => onHoverFacility?.(null)}
            onFocus={() => onHoverFacility?.(facility.name)}
            onBlur={() => onHoverFacility?.(null)}
          >
            {facility.name}
          </Link>
        ) : (
          <button
            key={facility.name}
            type="button"
            style={style}
            className={className}
            title={t('yard.facility.selectTitle', { name: facility.name })}
            onClick={() => onSelectFacility?.(active ? null : facility.name)}
            onPointerEnter={() => onHoverFacility?.(facility.name)}
            onPointerLeave={() => onHoverFacility?.(null)}
            onFocus={() => onHoverFacility?.(facility.name)}
            onBlur={() => onHoverFacility?.(null)}
          >
            {facility.name}
          </button>
        )
      })}
    </div>
  )
}
