import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from '../../../lib/i18n/useTranslation'
import { cn } from '../../../lib/utils'
import { useEscapeClaim } from '../../../lib/escapeClaims'
import { CloseIcon } from '../../../ui/icons'

/**
 * 실적 화면의 **띄운 창** 틀 — 절점 세부 · 수집 현황이 같은 틀을 쓴다.
 *
 * - 높이를 고정한다 — 안의 줄 수가 달라도 창의 세로가 바뀌지 않는다(사용자 확정). 넘치면 안에서 스크롤한다
 * - 떠 있는 동안 뒤 화면 스크롤을 잠근다(전역 검색 · 모바일 드로어와 같은 규칙, 사용자 확정)
 * - 닫기는 ×, ESC, 바깥 클릭. ESC 우선권을 쥐어 뒤의 드릴다운 ESC 가 함께 움직이지 않게 한다
 */
export function PerfDialog({
  label,
  title,
  subtitle,
  onClose,
  className,
  children,
}: {
  /** 창의 접근 이름 */
  label: string
  title: ReactNode
  subtitle?: ReactNode
  onClose: () => void
  /** 폭 등 창 틀에 더할 클래스 */
  className?: string
  children: ReactNode
}) {
  const { t } = useTranslation()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEscapeClaim(true)
  useEffect(() => closeRef.current?.focus(), [])
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      e.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8">
      <div aria-hidden="true" className="absolute inset-0 bg-black/60 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={cn(
          'relative flex h-full max-h-[44rem] w-full max-w-6xl flex-col overflow-hidden rounded-inshop-xl border border-border bg-surface shadow-[0_24px_64px_rgba(0,0,0,0.5)] animate-fade-in',
          className
        )}
      >
        <header className="flex shrink-0 items-start gap-3 border-b border-border px-5 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-inshop-base font-semibold">{title}</h2>
            {subtitle && <p className="mt-0.5 text-inshop-xs text-foreground/50">{subtitle}</p>}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={t('performance.stageDetail.close')}
            title={t('performance.stageDetail.close')}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-inshop-lg border border-border text-foreground/60 transition-colors hover:bg-surface-secondary hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <CloseIcon size={16} />
          </button>
        </header>
        {children}
      </section>
    </div>,
    document.body
  )
}
