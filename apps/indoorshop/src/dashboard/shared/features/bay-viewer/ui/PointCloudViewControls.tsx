import { useTranslation } from '../../../lib/i18n/useTranslation'
import { cn } from '../../../lib/utils'
import { Segmented } from '../../../ui/atoms/Segmented'
import { ToggleButton } from '../../../ui/atoms/ToggleButton'
import { DISPLAY_MODES, type ViewerDisplayMode } from '../lib/displayModes'
import { colorModesFor, type ColorModeOption, type PointColorMode } from '../lib/colorModes'

interface PointCloudViewControlsProps {
  displayMode: ViewerDisplayMode
  colorMode: PointColorMode
  showOutline: boolean
  onDisplayModeChange: (mode: ViewerDisplayMode) => void
  onColorModeChange: (mode: PointColorMode) => void
  onShowOutlineChange: (show: boolean) => void
  /**
   * 색상 규칙 선택지 override — 데이터가 규칙을 못 받치는 화면(실측 스캔은
   * 객체·진척 분류가 없다)에서 그 옵션을 아예 내놓지 않기 위한 것.
   */
  colorOptions?: ColorModeOption[]
  /**
   * 어떤 바탕 위에 서는가 — `glass` 는 3D 뷰포트 위에 뜨는 유리 도구줄용이다.
   * 그 위에서는 줄 간격도 좁힌다: 떠 있는 판이 클수록 가리는 3D 도 넓어진다.
   */
  tone?: 'surface' | 'glass'
  className?: string
}

export function PointCloudViewControls({
  displayMode,
  colorMode,
  showOutline,
  onDisplayModeChange,
  onColorModeChange,
  onShowOutlineChange,
  colorOptions,
  tone = 'surface',
  className,
}: PointCloudViewControlsProps) {
  const { t } = useTranslation()

  return (
    <div
      className={cn(
        'flex flex-wrap items-center',
        tone === 'glass' ? 'gap-x-3 gap-y-1.5' : 'gap-x-4 gap-y-2',
        className,
      )}
    >
      <Segmented
        legend={t('viewer.display.legend')}
        value={displayMode}
        options={DISPLAY_MODES}
        onChange={onDisplayModeChange}
        tone={tone}
      />
      {/* 표시 모드에 따라 색상 옵션 목록 자체가 교체된다 (비활성이 아니라 교체) */}
      <Segmented
        legend={t('viewer.color.legend')}
        value={colorMode}
        options={colorOptions ?? colorModesFor(displayMode)}
        onChange={onColorModeChange}
        tone={tone}
      />
      <ToggleButton pressed={showOutline} onPressedChange={onShowOutlineChange} tone={tone}>
        {t('viewer.outline')} {showOutline ? t('viewer.outlineShown') : t('viewer.outlineHidden')}
      </ToggleButton>
    </div>
  )
}
