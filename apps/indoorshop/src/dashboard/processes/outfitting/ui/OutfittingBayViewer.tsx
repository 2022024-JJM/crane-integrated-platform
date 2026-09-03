import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import { LidarPointCloudViewer } from '../../../shared/features/bay-viewer/ui/LidarPointCloudViewer'
import { PointCloudViewControls } from '../../../shared/features/bay-viewer/ui/PointCloudViewControls'
import { PointCloudLegend } from '../../../shared/features/bay-viewer/ui/PointCloudLegend'
import { ViewportHelp } from '../../../shared/features/bay-viewer/ui/ViewportHelp'
import { ViewportToolbar } from '../../../shared/features/bay-viewer/ui/ViewportToolbar'
import {
  viewportEdgeColors,
  type ViewerDisplayMode,
} from '../../../shared/features/bay-viewer/lib/displayModes'
import {
  colorModesFor,
  reconcileColorMode,
  type PointColorMode,
} from '../../../shared/features/bay-viewer/lib/colorModes'
import { formatDetectionId } from '../../../shared/features/bay-viewer/model/lidarBlock'
import { SpinnerOverlay } from '../../../shared/ui/atoms/Spinner'
import { useAsyncData } from '../../../shared/lib/useAsyncData'
import { cn } from '../../../shared/lib/utils'
import { CloseIcon } from '../../../shared/ui/icons'
import { fetchOutfittingBayScene } from '../api/outfittingBayScene'
import type { OutfittingBlock } from '../model/block'

/*
 * 의장 베이 3D 뷰 — 조립 베이 뷰어(shared bay-viewer)의 의장 소비자.
 *
 * 맵의 베이 드릴에서 열리는 전면 오버레이다. 점군·베이·블록·유리 도구줄·범례·도움말이
 * 전부 조립 베이 화면과 같은 부품(shared)이고, 이 파일이 들고 있는 것은 **의장 몫**뿐이다:
 * mock 장면 소스(`fetchOutfittingBayScene`), 표시 상태 소유, 닫기. 실측 점군이 오면
 * 장면 소스만 실측 조회로 바뀐다(조립 PBS 5BAY 와 같은 이음새).
 *
 * ⚠️ **뷰어 문법은 조립, 데이터는 의장이다.** 의장은 블록 하나가 작업 단위이고 그 아래
 * 계층(소조·중조·ASSY)이 없으므로, 여기 서는 인식 대상은 언제나 로스터 블록 1건이다 —
 * 선택 칩도 `BLK {블록번호}` 로 읽힌다(`formatDetectionId`).
 */

interface OutfittingBayViewerProps {
  factory: string
  /** 지번 fixture 의 베이 번호(공장 내 유일)와 화면 라벨 */
  bayNo: string
  bayLabel: string
  /** 이 베이의 로스터 블록 — 뷰어에 서는 인식 대상의 신원이 여기서 나온다 */
  bayBlocks: readonly OutfittingBlock[]
  onClose: () => void
  className?: string
}

export function OutfittingBayViewer({
  factory,
  bayNo,
  bayLabel,
  bayBlocks,
  onClose,
  className,
}: OutfittingBayViewerProps) {
  const { t } = useTranslation()

  const { data: bayScene, loading } = useAsyncData(
    () => fetchOutfittingBayScene(factory, bayNo, bayLabel, bayBlocks),
    [factory, bayNo, bayLabel, bayBlocks]
  )

  /* 표시 상태 — 조립 워크스페이스와 같은 규칙: 소유자는 뷰어가 아니라 이 화면이다 */
  const [displayMode, setDisplayMode] = useState<ViewerDisplayMode>('overlay')
  const [colorMode, setColorMode] = useState<PointColorMode>('sensor')
  const [showOutline, setShowOutline] = useState(true)
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const rememberedColorMode = useRef<PointColorMode>('sensor')

  const handleDisplayModeChange = (next: ViewerDisplayMode) => {
    if (next === 'cad' && displayMode !== 'cad' && colorMode !== 'progress') {
      rememberedColorMode.current = colorMode
    }
    setColorMode((current) => reconcileColorMode(next, current, rememberedColorMode.current, false))
    setDisplayMode(next)
  }

  const colorOptions = colorModesFor(displayMode)
  useEffect(() => {
    if (!colorOptions.some((option) => option.value === colorMode)) {
      setColorMode(displayMode === 'cad' ? 'plain' : colorOptions[0].value)
    }
  }, [colorOptions, colorMode, displayMode])

  const viewportEdge = viewportEdgeColors(displayMode)
  const selectedBlock =
    selectedBlockId && bayScene
      ? bayScene.scene.blocks.find((block) => block.id === selectedBlockId)
      : undefined

  return (
    <div
      style={{ background: viewportEdge.background }}
      className={cn('relative overflow-hidden rounded-inshop-lg border border-border', className)}
    >
      {bayScene ? (
        <LidarPointCloudViewer
          key={bayScene.location.id}
          mode="bay"
          bays={[bayScene.scene]}
          selectedBlockId={selectedBlockId}
          displayMode={displayMode}
          colorMode={colorMode}
          showOutline={showOutline}
          onSelectBlock={setSelectedBlockId}
          className="h-full min-h-0"
        />
      ) : (
        !loading && (
          <p className="absolute inset-0 flex items-center justify-center text-inshop-sm text-foreground/55">
            {t('common.loadFailed')}
          </p>
        )
      )}

      {/* 좌상단 유리 도구줄 — 조립 베이 화면과 같은 자리·같은 부품 */}
      <div className="absolute left-4 top-4 z-10 flex max-w-[calc(100%-5rem)] flex-col items-start gap-2">
        <ViewportToolbar
          title={t('outfitting.mapEntry.viewer.title', { factory, bay: bayLabel })}
          hint={t('outfitting.mapEntry.viewer.hint')}
          className="static max-w-none"
        >
          <PointCloudViewControls
            displayMode={displayMode}
            colorMode={colorMode}
            showOutline={showOutline}
            onDisplayModeChange={handleDisplayModeChange}
            onColorModeChange={setColorMode}
            onShowOutlineChange={setShowOutline}
            colorOptions={colorOptions}
            tone="glass"
          />
        </ViewportToolbar>
      </div>

      {/* 범례 — 도구 묶음 아래 우측 (조립과 동일) */}
      <PointCloudLegend colorMode={colorMode} className="left-auto right-4 top-14" />

      {/* 우상단 도구 묶음 — 선택 해제 · 조작 도움말 · 닫기 */}
      <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
        {selectedBlock && (
          <button
            type="button"
            onClick={() => setSelectedBlockId(null)}
            className={cn(
              'flex h-7 items-center gap-1.5 rounded-inshop-md px-2',
              'glass-panel text-2xs font-medium',
              'transition-colors hover:bg-glass-hover hover:text-glass-accent',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-glass-accent'
            )}
          >
            <span className="font-mono">{formatDetectionId(selectedBlock)}</span>
            <span className="text-glass-foreground/54">{t('viewer.backToAll')}</span>
          </button>
        )}
        <ViewportHelp className="static flex-col-reverse" />
        <button
          type="button"
          onClick={onClose}
          aria-label={t('outfitting.mapEntry.viewer.close')}
          className={cn(
            'grid h-7 w-7 place-items-center rounded-inshop-md glass-panel',
            'transition-colors hover:bg-glass-hover hover:text-glass-accent',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-glass-accent'
          )}
        >
          <CloseIcon size={14} />
        </button>
      </div>

      {/* 모의 데이터 단서 — 하단 중앙, 항상 보인다 */}
      <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-inshop-md glass-panel px-2.5 py-1 text-2xs font-medium text-glass-foreground/70">
        {t('outfitting.mapEntry.viewer.mockChip')}
      </div>

      {loading && <SpinnerOverlay label={t('viewer.loadingDetection')} />}
    </div>
  )
}
