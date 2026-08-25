import { useEffect, useState } from 'react'
import { useTranslation } from '../../../../shared/lib/i18n/useTranslation'
import { createPortal } from 'react-dom'
import type { LoadedBlockModel } from '../../model/blockModel'
import { getMergedAssemblyPositions, getRestPose } from '../../model/blockModel'
import { cn } from '../../../../shared/lib/utils'
import { renderAssemblyThumbnail } from '../../lib/renderAssemblyThumbnail'
import { AssemblyOrbitPreview } from './AssemblyOrbitPreview'

interface AssemblyThumbnailProps {
  model: LoadedBlockModel
  assemblyIds: string[]
  cacheKey: string
  onClick?: () => void
  className?: string
}

const PREVIEW_WIDTH = 420
const PREVIEW_HEIGHT = 340

/**
 * 조립체 형상의 정적 썸네일 — 마우스 호버 시 확대된 360° 회전 프리뷰가 팝업으로 뜨고,
 * 클릭 시 메인 뷰어의 단독 뷰로 연결된다.
 */
export function AssemblyThumbnail({
  model,
  assemblyIds,
  cacheKey,
  onClick,
  className,
}: AssemblyThumbnailProps) {
  const { t } = useTranslation()
  const [url, setUrl] = useState<string | null>(null)
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const soup = getMergedAssemblyPositions(model, assemblyIds)
    const rest = getRestPose(model, assemblyIds)
    setUrl(renderAssemblyThumbnail(cacheKey, soup, rest.restQuat))
  }, [model, assemblyIds, cacheKey])

  function handleMouseEnter(event: React.MouseEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const pad = 12
    let x = rect.right + pad
    if (x + PREVIEW_WIDTH > window.innerWidth - 8) x = rect.left - PREVIEW_WIDTH - pad
    if (x < 8) x = 8
    let y = rect.top
    if (y + PREVIEW_HEIGHT > window.innerHeight - 8) y = window.innerHeight - PREVIEW_HEIGHT - 8
    if (y < 8) y = 8
    setHoverPos({ x, y })
  }

  if (!url) {
    return <div className={cn('rounded-inshop-md bg-viewport', className)} />
  }

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setHoverPos(null)}
        title={t('viewer.thumbnailTitle')}
        className={cn(
          'block overflow-hidden rounded-inshop-md bg-viewport transition-opacity',
          onClick ? 'cursor-pointer hover:opacity-80' : 'cursor-default',
          className
        )}
      >
        <img src={url} alt={t('viewer.thumbnailAlt')} draggable={false} className="h-full w-full object-contain" />
      </button>

      {hoverPos &&
        createPortal(
          <div
            className="pointer-events-none fixed z-50 rounded-inshop-lg border border-border bg-surface p-1.5 shadow-2xl shadow-black/50"
            style={{ left: hoverPos.x, top: hoverPos.y, width: PREVIEW_WIDTH }}
          >
            {/* 팝업은 pointer-events-none이라 조작이 닿지 않는다 — 자동 회전만 돈다 */}
            <AssemblyOrbitPreview
              model={model}
              assemblyIds={assemblyIds}
              interactive={false}
              className="h-80 w-full"
            />
          </div>,
          document.body
        )}
    </>
  )
}
