import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import type { InshopKey } from '../../../shared/lib/i18n/keys'
import { cn } from '../../../shared/lib/utils'
import type { PointColorMode } from '../lib/colorModes'
import { OBJECT_COLORS, ELEVATION_STOPS } from '../lib/pointColorRules'
import { MISSING_COLOR_HEX } from '../lib/progressStatus'

interface LegendEntry {
  /** CSS 색 — 그라디언트면 background 로 들어간다 */
  swatch: string
  labelKey: InshopKey
}

/**
 * 규칙별 범례.
 * 색이 무엇을 뜻하는지 화면 안에서 읽히지 않으면 색을 입힌 의미가 없다.
 */
const LEGENDS: Record<PointColorMode, { titleKey: InshopKey; entries: LegendEntry[] } | null> = {
  sensor: null, // 센서 색은 상단 센서 목록이 이미 같은 색으로 보여준다
  height: {
    titleKey: 'viewer.legend.height',
    entries: [
      { swatch: `linear-gradient(to right, ${ELEVATION_STOPS.join(', ')})`, labelKey: 'viewer.legend.lowToHigh' },
    ],
  },
  object: {
    titleKey: 'viewer.legend.object',
    entries: [
      { swatch: OBJECT_COLORS.floor, labelKey: 'viewer.legend.floor' },
      { swatch: OBJECT_COLORS.jig, labelKey: 'viewer.legend.jig' },
      // detection 마다 hue 를 돌리므로 대표 3색으로 "여러 색" 임을 보인다
      { swatch: 'linear-gradient(to right,#4ba3d8,#d8894b,#5ec95e)', labelKey: 'viewer.legend.registeredBlock' },
      { swatch: OBJECT_COLORS.unregistered, labelKey: 'viewer.legend.unregisteredCluster' },
    ],
  },
  progress: {
    titleKey: 'viewer.legend.progress',
    entries: [
      { swatch: '#c9ccd0', labelKey: 'viewer.legend.presentPart' },
      { swatch: MISSING_COLOR_HEX, labelKey: 'viewer.legend.missingPart' },
    ],
  },
  plain: null,
}

interface PointCloudLegendProps {
  colorMode: PointColorMode
  className?: string
}

export function PointCloudLegend({ colorMode, className }: PointCloudLegendProps) {
  const { t } = useTranslation()
  const legend = LEGENDS[colorMode]
  if (!legend) return null

  return (
    <div
      className={cn(
        'pointer-events-none absolute left-4 top-4 rounded-inshop-lg',
        'glass-panel px-2.5 py-1.5',
        className,
      )}
    >
      <p className="mb-1 text-2xs font-semibold uppercase tracking-wide text-glass-foreground/54">
        {t(legend.titleKey)}
      </p>
      <ul className="space-y-0.5">
        {legend.entries.map((entry) => (
          <li key={entry.labelKey} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-2 w-5 shrink-0 rounded-inshop-xs"
              style={{ background: entry.swatch }}
            />
            <span className="text-2xs text-glass-foreground/80">{t(entry.labelKey)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
