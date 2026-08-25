import { useTranslation } from '../../lib/i18n/useTranslation'
import { cn } from '../../lib/utils'

interface ViewportFullscreenButtonProps {
  isFullscreen: boolean
  onToggle: () => void
  className?: string
}

/**
 * 뷰포트 전체 화면 토글.
 *
 * 아이콘만 둔다 — 뷰포트 위 버튼은 형상을 가리는 만큼만 값을 해야 하고, 모서리를
 * 바깥으로 밀어내는 그림은 설명이 필요 없다. 상태에 따라 방향만 뒤집는다.
 */
export function ViewportFullscreenButton({
  isFullscreen,
  onToggle,
  className,
}: ViewportFullscreenButtonProps) {
  const { t } = useTranslation()
  const label = isFullscreen ? t('common.fullscreenExit') : t('common.fullscreenEnter')

  return (
    <button
      type="button"
      onClick={onToggle}
      title={label}
      aria-label={label}
      aria-pressed={isFullscreen}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-inshop-md glass-panel',
        'text-glass-foreground/68 transition-colors hover:bg-glass-hover hover:text-glass-accent',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-glass-accent',
        className,
      )}
    >
      <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true">
        {isFullscreen ? (
          /* 안으로 — 모서리가 가운데를 향한다 */
          <path
            d="M5.5 1.5v4h-4M8.5 1.5v4h4M5.5 12.5v-4h-4M8.5 12.5v-4h4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          /* 밖으로 — 모서리가 바깥을 향한다 */
          <path
            d="M1.5 5V1.5h3.5M12.5 5V1.5H9M1.5 9v3.5h3.5M12.5 9v3.5H9"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
    </button>
  )
}
