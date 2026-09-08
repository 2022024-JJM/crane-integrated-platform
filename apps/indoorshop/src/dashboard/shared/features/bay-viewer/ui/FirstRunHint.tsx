import { useEffect, useState } from 'react'
import { useTranslation } from '../../../lib/i18n/useTranslation'
import { cn } from '../../../lib/utils'

/*
 * 첫 진입 조작 힌트 (PRD FR-9).
 *
 * 공장뷰를 처음 여는 사람에게 조작 문법(회전·줌·선택)을 한 번만 알려주고,
 * 이후에는 오른쪽 아래 `조작 ?` 도움말이 같은 내용을 상시 제공한다.
 * "본 적 있음"은 localStorage 에 남는다 — 저장이 막힌 환경(사생활 모드 등)에서는
 * 매번 보이는 쪽보다 안 보이는 쪽이 낫다고 보고 조용히 숨긴다.
 */
const STORAGE_KEY = 'assembly.viewer.hintSeen'
/** 손대지 않아도 이 시간 뒤에는 스스로 내려간다 — 읽고 남을 만큼만 머문다 */
const AUTO_DISMISS_MS = 15000

function hasSeenHint(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return true
  }
}

function markHintSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    // 저장 실패는 치명적이지 않다 — 다음 진입에 한 번 더 보일 뿐이다
  }
}

export function FirstRunHint({ className }: { className?: string }) {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(() => !hasSeenHint())

  useEffect(() => {
    if (!visible) return
    const timer = window.setTimeout(() => {
      markHintSeen()
      setVisible(false)
    }, AUTO_DISMISS_MS)
    return () => window.clearTimeout(timer)
  }, [visible])

  if (!visible) return null

  const dismiss = () => {
    markHintSeen()
    setVisible(false)
  }

  return (
    <div
      className={cn(
        'pointer-events-auto flex max-w-[calc(100%-2rem)] items-center gap-2 rounded-inshop-lg glass-panel py-1.5 pl-3 pr-1.5',
        'animate-fade-in',
        className,
      )}
    >
      <p className="min-w-0 text-2xs leading-relaxed text-glass-foreground/85">
        {t('viewer.firstRun.hint')}{' '}
        <span className="text-glass-foreground/54">{t('viewer.firstRun.more')}</span>
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t('viewer.firstRun.dismiss')}
        className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-inshop-md text-glass-foreground/68',
          'transition-colors hover:bg-glass-hover hover:text-glass-foreground',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-glass-accent',
        )}
      >
        <svg aria-hidden="true" viewBox="0 0 12 12" className="h-3 w-3">
          <path d="m3 3 6 6M9 3l-6 6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}
