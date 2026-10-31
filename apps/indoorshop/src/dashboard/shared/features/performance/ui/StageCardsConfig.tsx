import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from '../../../lib/i18n/useTranslation'
import { cn } from '../../../lib/utils'
import { OVERALL_SECTIONS, STAGE_CARD_KEYS, type StageCardKey } from './stageTileOrder'

/**
 * 「구성」 — 가공 탭에 보일 카드를 체크박스로 고른다(사용자 확정, 테스트 영역).
 *
 * 구간 셋(적치 S1~S4 · 가공 S6 · S7 · 가공 S8~S10)은 하나씩, 레거시 정산 · 종합 · 적치 단계 · 가공 단계는 칸 하나씩.
 * 마지막 하나는 끌 수 없다 — 다 끄면 화면이 빈다.
 */
export function StageCardsConfig({
  hidden,
  onChange,
}: {
  hidden: ReadonlySet<StageCardKey>
  onChange: (next: Set<StageCardKey>) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const panelId = useId()

  /* 바깥을 누르거나 Esc 면 닫는다 */
  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const label = (key: StageCardKey): string => {
    const section = OVERALL_SECTIONS.find((s) => `sec-${s.key}` === key)
    if (section) {
      const range =
        section.stages.length > 2
          ? t('performance.stages.groupRange', { from: section.stages[0], to: section.stages[section.stages.length - 1] })
          : section.stages.join(' · ')
      return `${t(`performance.stages.overallGroups.name.${section.tone}` as const)} ${range}`
    }
    if (key === 'legacy') return t('performance.stages.legacyTitle')
    if (key === 'overall') return t('performance.stages.overallAuto')
    return t(`performance.stages.group.${key as 'stack' | 'fab'}` as const)
  }

  const shownCount = STAGE_CARD_KEYS.filter((key) => !hidden.has(key)).length
  const toggle = (key: StageCardKey, show: boolean) => {
    const next = new Set(hidden)
    if (show) next.delete(key)
    else next.add(key)
    onChange(next)
  }

  const item = (key: StageCardKey) => {
    const checked = !hidden.has(key)
    const last = checked && shownCount === 1
    return (
      <label
        key={key}
        className={cn(
          'flex items-center gap-2 rounded-inshop-sm px-2 py-1 text-inshop-sm',
          last ? 'cursor-not-allowed text-foreground/50' : 'cursor-pointer hover:bg-foreground/8'
        )}
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={last}
          onChange={(e) => toggle(key, e.target.checked)}
          className="size-4 accent-accent"
        />
        <span className="whitespace-nowrap">{label(key)}</span>
      </label>
    )
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'shrink-0 rounded-inshop-md border px-3 py-1 text-inshop-xs font-medium transition-colors',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          open ? 'border-accent bg-accent/10 text-accent' : 'border-border text-foreground/68 hover:text-foreground'
        )}
      >
        {t('performance.stages.config.button')}
        {shownCount < STAGE_CARD_KEYS.length && (
          <span className="ml-1 tabular-nums text-foreground/55">
            {shownCount}/{STAGE_CARD_KEYS.length}
          </span>
        )}
      </button>
      {open && (
        <fieldset
          id={panelId}
          className="absolute right-0 top-full z-30 mt-1 flex min-w-56 flex-col gap-0.5 rounded-inshop-lg bg-material-strong p-2 shadow-material backdrop-blur-2xl backdrop-saturate-150"
        >
          <legend className="sr-only">{t('performance.stages.config.legend')}</legend>
          <div className="px-2 pb-0.5 pt-1 text-inshop-xs font-semibold text-foreground/60">
            {t('performance.stages.sectionsTitle')}
          </div>
          {STAGE_CARD_KEYS.filter((key) => key.startsWith('sec-')).map(item)}
          <div className="my-1 h-px bg-material-border" />
          {STAGE_CARD_KEYS.filter((key) => !key.startsWith('sec-')).map(item)}
        </fieldset>
      )}
    </div>
  )
}
