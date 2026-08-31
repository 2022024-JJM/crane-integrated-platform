import { useTranslation } from '../../../../shared/lib/i18n/useTranslation'

/** 휠이 페이지 스크롤로 전달된 이유와 다음 행동을 짧게 알려주는 맥락형 안내. */
export function WheelZoomHint() {
  const { t } = useTranslation()

  return (
    <div className="pointer-events-none absolute left-1/2 top-3 z-20 flex -translate-x-1/2 animate-fade-in items-center gap-2.5 whitespace-nowrap rounded-inshop-lg border border-glass-border/80 bg-black/75 px-3 py-2 shadow-xl backdrop-blur-md">
      <span className="grid h-8 w-8 place-items-center rounded-inshop-md bg-white/10 text-glass-foreground" aria-hidden="true">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
          <rect x="7" y="2.5" width="10" height="19" rx="5" />
          <path d="M12 6v4" strokeLinecap="round" />
          <path d="m9.8 14.8 2.2 2.2 2.2-2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span>
        <strong className="block text-inshop-xs font-semibold text-glass-foreground">{t('viewer.focusHintTitle')}</strong>
        <span className="mt-0.5 block text-2xs text-glass-foreground/62">{t('viewer.focusHintAction')}</span>
      </span>
    </div>
  )
}
