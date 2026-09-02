import { useTranslation } from '../../../lib/i18n/useTranslation'
import type { InshopKey } from '../../../lib/i18n/keys'
import { cn } from '../../../lib/utils'
import { MATCH_NEUTRALS } from '../lib/displayModes'
import type { PointColorMode } from '../lib/colorModes'
import { OBJECT_COLORS, ELEVATION_STOPS, SEGMENT_COLORS } from '../lib/pointColorRules'
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
  /*
   * 실측 뷰어는 `CAD 정합`에서 **블록별** 범례를 직접 낸다 (RealScanViewer) — 색이 13종이라
   * 대표색 몇 개로는 "무슨 색이 무슨 블록"에 답이 안 되기 때문이다. 여기 것은 블록 목록을
   * 못 받는 자리를 위한 요약본이라, 대표 색은 반드시 SEGMENT_COLORS 앞쪽과 같아야 한다.
   */
  match: {
    titleKey: 'viewer.legend.match',
    entries: [
      {
        swatch: `linear-gradient(to right,${SEGMENT_COLORS[0]},${SEGMENT_COLORS[4]},${SEGMENT_COLORS[1]})`,
        labelKey: 'viewer.legend.matchedPoint',
      },
      { swatch: MATCH_NEUTRALS.rest, labelKey: 'viewer.legend.unmatchedPoint' },
      { swatch: MATCH_NEUTRALS.floor, labelKey: 'viewer.legend.floor' },
      // 도면 껍데기는 같은 블록색을 흰색 쪽으로 당긴 색 — 점과 짝이라는 것을 색이 나른다
      { swatch: 'linear-gradient(to right,#ef6f8d,#f8ab72,#7bcb85)', labelKey: 'viewer.legend.matchedCad' },
    ],
  },
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
            {/* 테는 흰색에 가까운 색을 위한 것 — 밝은 유리 위에서 색만으로는 안 보인다 */}
            <span
              aria-hidden="true"
              className="h-2 w-5 shrink-0 rounded-inshop-xs ring-1 ring-glass-border"
              style={{ background: entry.swatch }}
            />
            <span className="text-2xs text-glass-foreground/80">{t(entry.labelKey)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
