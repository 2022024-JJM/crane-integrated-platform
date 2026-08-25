import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import type { InshopKey } from '../../../shared/lib/i18n/keys'
import { cn } from '../../../shared/lib/utils'
import { Segmented, type SegmentedOption } from '../../../shared/ui/atoms/Segmented'
import { ToggleButton } from '../../../shared/ui/atoms/ToggleButton'
import { formatYardDate } from '../model/types'
import type { MapThemeSetting } from '../lib/basemapStyle'
import type { YardViewMode } from '../lib/projection'
import type { YardLayers } from './YardMap'

interface YardMapControlsProps {
  layers: YardLayers
  onLayersChange: (layers: YardLayers) => void
  lotOpacity: number
  onLotOpacityChange: (opacity: number) => void
  mapTheme: MapThemeSetting
  onMapThemeChange: (theme: MapThemeSetting) => void
  viewMode: YardViewMode
  onViewModeChange: (mode: YardViewMode) => void
  /** 이동 기록이 있는 날 (오름차순) */
  dates: string[]
  date: string
  onDateChange: (date: string) => void
  moveCount: number
  planCount: number
  className?: string
}

/* 순서는 설정 화면의 테마 고르기와 같다(밝음 · 어두움 · 자동) — 같은 것을 두 곳에서
 * 다른 차례로 내면 매번 다시 찾아야 한다 */
const MAP_THEMES: SegmentedOption<MapThemeSetting>[] = [
  {
    value: 'light',
    labelKey: 'yard.mapTheme.light',
    descriptionKey: 'yard.mapTheme.lightDescription',
  },
  { value: 'dark', labelKey: 'yard.mapTheme.dark', descriptionKey: 'yard.mapTheme.darkDescription' },
  { value: 'auto', labelKey: 'yard.mapTheme.auto', descriptionKey: 'yard.mapTheme.autoDescription' },
]

const VIEW_MODES: SegmentedOption<YardViewMode>[] = [
  { value: '2d', labelKey: 'yard.viewMode.flat', descriptionKey: 'yard.viewMode.flatDescription' },
  {
    value: '3d',
    labelKey: 'yard.viewMode.tilted',
    descriptionKey: 'yard.viewMode.tiltedDescription',
  },
]

const LAYER_LABELS: { key: keyof YardLayers; labelKey: InshopKey }[] = [
  { key: 'basemap', labelKey: 'yard.layers.basemap' },
  { key: 'facilities', labelKey: 'yard.layers.facilities' },
  { key: 'lots', labelKey: 'yard.layers.lots' },
  { key: 'blocks', labelKey: 'yard.layers.blocks' },
  { key: 'moves', labelKey: 'yard.layers.moves' },
  { key: 'plans', labelKey: 'yard.layers.plans' },
  { key: 'shops', labelKey: 'yard.layers.shops' },
]

/**
 * 맵 위에 무엇을 겹칠지 정하는 줄.
 *
 * 레이어를 끄고 켜는 일은 **비교**를 위한 것이다 — 블록만 켜면 야드가 얼마나 찼는지가
 * 보이고, 이동만 켜면 어느 길이 붐볐는지가 보인다. 그래서 다섯 개를 전부 상시 노출한다:
 * 메뉴 안에 접어 두면 있는 줄도 모르고, 있는 줄 알아도 켜고 끄기를 반복하지 않게 된다.
 *
 * 날짜는 이동 레이어에만 걸린다. 지번·블록은 "지금"의 스냅샷이고, 이동은 하루 단위의
 * 기록이라 **날을 고르지 않으면 아무것도 그릴 수 없다**.
 *
 * 지도 밝기는 기본적으로 **앱 테마를 따라간다**(자동). 화면 절반을 차지하는 지도가
 * 혼자 다른 밝기로 있으면 설정이 빠진 것처럼 보이기 때문이다. 그래도 밝음·어두움을
 * 따로 고를 수 있는 것은, 밝기가 취향이 아니라 목적인 경우가 있어서다 — 어두운 지도는
 * 지번 색을, 밝은 지도는 건물·도로를 앞에 세운다.
 *
 * 2D/3D 도 같은 이유로 여기 있다. 평면은 **재는** 화면이고(거리·배치가 왜곡 없이 남는다),
 * 기울인 화면은 **보는** 화면이다(건물과 정반의 높이로 야드의 깊이가 잡힌다). 둘 중
 * 무엇이 옳은 것이 아니라 지금 무엇을 묻고 있느냐가 정하므로, 레이어·밝기와 나란히 둔다.
 */
export function YardMapControls({
  layers,
  onLayersChange,
  lotOpacity,
  onLotOpacityChange,
  mapTheme,
  onMapThemeChange,
  viewMode,
  onViewModeChange,
  dates,
  date,
  onDateChange,
  moveCount,
  planCount,
  className,
}: YardMapControlsProps) {
  const { t } = useTranslation()
  const index = dates.indexOf(date)

  const step = (delta: number) => {
    const next = dates[index + delta]
    if (next) onDateChange(next)
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-2', className)}>
      <fieldset className="flex items-center gap-1.5">
        <legend className="sr-only">{t('yard.layers.legend')}</legend>
        <span aria-hidden="true" className="text-inshop-xs font-medium text-foreground/54">
          {t('yard.layers.legend')}
        </span>
        {LAYER_LABELS.map(({ key, labelKey }) => (
          <ToggleButton
            key={key}
            pressed={layers[key]}
            onPressedChange={(pressed) => onLayersChange({ ...layers, [key]: pressed })}
          >
            {t(labelKey)}
          </ToggleButton>
        ))}
      </fieldset>

      <Segmented
        legend={t('yard.viewMode.legend')}
        value={viewMode}
        options={VIEW_MODES}
        onChange={onViewModeChange}
      />

      <Segmented
        legend={t('yard.mapTheme.legend')}
        value={mapTheme}
        options={MAP_THEMES}
        onChange={onMapThemeChange}
      />

      {/* 지번을 얼마나 진하게 깔지 — 베이스맵의 건물·도로를 읽으려면 걷어내야 한다 */}
      <label className="flex items-center gap-2 text-inshop-xs font-medium text-foreground/54">
        {t('yard.opacity')}
        <input
          type="range"
          min={0.05}
          max={0.9}
          step={0.05}
          value={lotOpacity}
          disabled={!layers.lots}
          onChange={(event) => onLotOpacityChange(Number(event.target.value))}
          className="h-1 w-24 cursor-pointer accent-accent disabled:cursor-not-allowed disabled:opacity-40"
        />
        <span className="w-7 font-mono text-2xs text-foreground/68 tabular-nums">
          {Math.round(lotOpacity * 100)}%
        </span>
      </label>

      <div className="flex items-center gap-1.5">
        <span aria-hidden="true" className="text-inshop-xs font-medium text-foreground/54">
          {t('yard.date.legend')}
        </span>
        <StepButton
          label={t('yard.date.prev')}
          disabled={index <= 0}
          onClick={() => step(-1)}
          path="M7.5 2.5 4 6l3.5 3.5"
        />
        <select
          value={date}
          onChange={(event) => onDateChange(event.target.value)}
          aria-label={t('yard.date.legend')}
          className={cn(
            'cursor-pointer rounded-inshop-md border border-border bg-surface px-2 py-1 font-mono text-inshop-xs text-foreground',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          )}
        >
          {dates.map((value) => (
            <option key={value} value={value}>
              {formatYardDate(value)}
            </option>
          ))}
        </select>
        <StepButton
          label={t('yard.date.next')}
          disabled={index < 0 || index >= dates.length - 1}
          onClick={() => step(1)}
          path="M4.5 2.5 8 6l-3.5 3.5"
        />
        <p className="ml-1 text-2xs text-foreground/54">
          {t('yard.date.counts', { moves: moveCount, plans: planCount })}
        </p>
      </div>
    </div>
  )
}

function StepButton({
  label,
  disabled,
  onClick,
  path,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  path: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-inshop-md border border-border',
        'text-foreground/68 transition-colors hover:text-foreground',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        'disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:text-foreground/68',
      )}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        <path
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}
