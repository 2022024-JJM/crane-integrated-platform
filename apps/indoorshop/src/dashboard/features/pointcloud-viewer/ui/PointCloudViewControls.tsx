import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import { cn } from '../../../shared/lib/utils'
import { Segmented } from '../../../shared/ui/atoms/Segmented'
import { ToggleButton } from '../../../shared/ui/atoms/ToggleButton'
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
  className,
}: PointCloudViewControlsProps) {
  const { t } = useTranslation()

  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-2', className)}>
      <Segmented
        legend={t('viewer.display.legend')}
        value={displayMode}
        options={DISPLAY_MODES}
        onChange={onDisplayModeChange}
      />
      {/* 표시 모드에 따라 색상 옵션 목록 자체가 교체된다 (비활성이 아니라 교체) */}
      <Segmented
        legend={t('viewer.color.legend')}
        value={colorMode}
        options={colorOptions ?? colorModesFor(displayMode)}
        onChange={onColorModeChange}
      />
      <ToggleButton pressed={showOutline} onPressedChange={onShowOutlineChange}>
        {t('viewer.outline')} {showOutline ? t('viewer.outlineShown') : t('viewer.outlineHidden')}
      </ToggleButton>
    </div>
  )
}
