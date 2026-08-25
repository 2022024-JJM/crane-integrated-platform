import { useState } from 'react'
import { useTranslation } from '../../../../shared/lib/i18n/useTranslation'
import type { InshopKey } from '../../../../shared/lib/i18n/keys'
import { cn } from '../../../../shared/lib/utils'

const MOUSE: [InshopKey, InshopKey][] = [
  ['viewer.help.wheel', 'viewer.help.zoom'],
  ['viewer.help.middleDrag', 'viewer.help.rotate'],
  ['viewer.help.shiftMiddle', 'viewer.help.pan'],
  ['viewer.help.ctrlMiddle', 'viewer.help.zoom'],
  ['viewer.help.altLeft', 'viewer.help.rotate'],
]

/** 키 이름은 자판에 새겨진 그대로라 번역하지 않는다 — 동작 설명만 옮긴다 */
const KEYS: [string, InshopKey][] = [
  ['1 / 3 / 7', 'viewer.help.viewKeys'],
  ['Ctrl + 1 / 3 / 7', 'viewer.help.opposite'],
  ['.', 'viewer.help.frameSelected'],
  ['Home', 'viewer.help.home'],
  ['F', 'viewer.help.fullscreen'],
]

/**
 * 뷰포트 조작 안내.
 * 단축키는 알려주지 않으면 없는 기능이나 마찬가지라, 화면 안에 접어서 둔다.
 */
export function ViewportHelp({ className }: { className?: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <div className={cn('absolute bottom-4 right-4 flex flex-col items-end gap-2', className)}>
      {open && (
        <div className="w-60 animate-fade-in rounded-inshop-lg glass-panel p-2.5">
          <p className="mb-1 text-2xs font-semibold uppercase tracking-wide text-glass-foreground/54">
            {t('viewer.help.mouse')}
          </p>
          <dl className="mb-2.5 space-y-0.5">
            {MOUSE.map(([key, action]) => (
              <div key={key} className="flex items-baseline justify-between gap-3">
                <dt className="font-mono text-2xs text-glass-foreground/75">{typeof key === "string" && key.startsWith("viewer.") ? t(key as InshopKey) : key}</dt>
                <dd className="text-2xs text-glass-foreground/63">{t(action)}</dd>
              </div>
            ))}
          </dl>
          <p className="mb-1 text-2xs font-semibold uppercase tracking-wide text-glass-foreground/54">
            {t('viewer.help.keyboard')}
          </p>
          <dl className="space-y-0.5">
            {KEYS.map(([key, action]) => (
              <div key={key} className="flex items-baseline justify-between gap-3">
                <dt className="font-mono text-2xs text-glass-foreground/75">{typeof key === "string" && key.startsWith("viewer.") ? t(key as InshopKey) : key}</dt>
                <dd className="text-2xs text-glass-foreground/63">{t(action)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 border-t border-glass-border/70 pt-1.5 text-2xs leading-relaxed text-glass-foreground/50">
            {t('viewer.help.note')}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={t('viewer.help.label')}
        className={cn(
          'rounded-inshop-md glass-panel px-2 py-1 font-mono text-2xs transition-colors',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-glass-accent',
          open ? 'text-glass-accent' : 'text-glass-foreground/68 hover:text-glass-foreground',
        )}
      >
        {t('viewer.help.toggle')}
      </button>
    </div>
  )
}
