import { useTranslation } from '../../../lib/i18n/useTranslation'
import type { AxisViewState } from '../lib/axisGizmo'
import type { ViewDirection } from '../lib/blenderControls'
import { ViewportAxisGizmo } from './ViewportAxisGizmo'
import {
  useViewportOverlay,
  type ViewportOverlayStore,
} from '../lib/viewportOverlayStore'
import { cn } from '../../../lib/utils'

/**
 * 카메라를 따라 움직이는 오버레이의 **잎(leaf)** 들.
 *
 * 뷰어 본체는 이것들을 한 번만 심고 다시는 리렌더되지 않는다 — 카메라가 움직일 때
 * 다시 그려지는 것은 여기 두 컴포넌트뿐이다. 그 이유는 `lib/viewportOverlayStore` 주석에
 * 적어 두었다(요약: 기즈모 하나 때문에 2천 줄짜리 뷰어를 초당 60번 재조정하고 있었다).
 */

/** 축 기즈모 — 저장소를 구독해 제 자리에서만 다시 그린다 */
export function LiveAxisGizmo({
  store,
  onSelectDirection,
  onGoHome,
  className,
}: {
  store: ViewportOverlayStore<AxisViewState | null>
  onSelectDirection: (direction: ViewDirection) => void
  onGoHome: () => void
  className?: string
}) {
  const view = useViewportOverlay(store)
  return (
    <ViewportAxisGizmo
      view={view}
      onSelectDirection={onSelectDirection}
      onGoHome={onGoHome}
      className={className}
    />
  )
}

/** 화면 밖 이상 정반 표식 하나 (FR-9) */
export interface OffscreenMark {
  id: string
  name: string
  error: boolean
  x: number
  y: number
  angleDeg: number
}

/** 표식이 하나도 없을 때 쓰는 **고정 참조** — 매번 새 배열을 내면 잎이 헛돈다 */
export const NO_OFFSCREEN_MARKS: readonly OffscreenMark[] = []

/**
 * 화면 밖 이상 정반 표식 (FR-9) — 이상 정반이 시야 밖으로 나가면 가장 가까운
 * 가장자리에 방향 화살표가 선다. 누르면 그 정반을 선택하고 카메라가 맞춰진다.
 */
export function LiveOffscreenMarks({
  store,
  onSelect,
}: {
  store: ViewportOverlayStore<readonly OffscreenMark[]>
  onSelect: (id: string) => void
}) {
  const { t } = useTranslation()
  const marks = useViewportOverlay(store)

  return (
    <>
      {marks.map((mark) => (
        <button
          key={mark.id}
          type="button"
          onClick={() => onSelect(mark.id)}
          aria-label={t('viewer.offscreen.aria', { name: mark.name })}
          style={{ left: mark.x, top: mark.y }}
          className={cn(
            // 도구줄(z-10)보다 위 — 이상 알람 표식이 도구에 가려 못 누르면 존재 이유가 없다
            'absolute z-20 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full',
            'glass-panel py-0.5 pl-1 pr-2 text-2xs font-medium transition-colors hover:bg-glass-hover',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-glass-accent',
            mark.error
              ? 'text-glass-unhealthy ring-1 ring-glass-unhealthy/70'
              : 'text-glass-foreground/85 ring-1 ring-glass-border',
          )}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 12 12"
            className="h-3 w-3 shrink-0"
            style={{ transform: `rotate(${mark.angleDeg}deg)` }}
          >
            <path
              d="M2 6h6M5.5 2.8 8.8 6l-3.3 3.2"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="max-w-24 truncate">{mark.name}</span>
        </button>
      ))}
    </>
  )
}
