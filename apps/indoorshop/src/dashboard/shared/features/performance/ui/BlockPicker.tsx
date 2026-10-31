import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from '../../../lib/i18n/useTranslation'
import { cn } from '../../../lib/utils'
import { useDismissable } from '../../../lib/useDismissable'
import { Button } from '../../../ui/atoms/Button'
import type { BlockOption } from '../model/types'
import { MAX_BLOCKS } from '../lib/useBlockQuery'

/**
 * 블록 선택 버튼 — 누르면 그 호선의 블록을 **체크박스 목록**으로 연다(사용자 확정: 누르면 바로 탭 대신 체크박스로 되돌림).
 *
 * 체크는 창 안의 초안일 뿐이고 **확인** 을 눌러야 탭이 바뀐다 — 닫거나 취소하면 초안은 버린다.
 * 하나도 고르지 않으면 확인을 막는다(빈 조건으로 조회하지 않는다).
 *
 * - 맨 위 검색 칸으로 블록 번호(또는 공장)를 쳐서 목록을 거른다
 * - '전체' 는 검색과 상관없이 **호선의 블록 전부** 를 기준으로 한다 — 걸러진 블록 하나만 켰다고 '전체' 가
 *   켜져 보이면 안 된다(사용자 지적). 일부만 켜져 있으면 indeterminate
 * - 탭은 `MAX_BLOCKS` 개까지 — 다 차면 켜지지 않은 블록은 고를 수 없고, '전체' 도 남은 자리만큼만 켠다
 */
export function BlockPicker({
  options,
  selected,
  disabled,
  onApply,
}: {
  options: BlockOption[]
  /** 지금 탭으로 열린 블록들 */
  selected: string[]
  disabled?: boolean
  /** 확인 — 체크한 블록들(호선의 블록 순서) */
  onApply: (blocks: string[]) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<string[]>(selected)
  const [keyword, setKeyword] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const allRef = useRef<HTMLInputElement>(null)
  const panelId = useId()

  const close = useCallback(() => setOpen(false), [])
  useDismissable(open, containerRef, close, buttonRef)

  /* 열 때마다 지금 탭으로 초안을 새로 잡는다 */
  const toggleOpen = () => {
    if (!open) {
      setDraft(selected)
      setKeyword('')
    }
    setOpen(!open)
  }

  const q = keyword.trim().toLowerCase()
  const visible = q
    ? options.filter((o) => o.blockNo.toLowerCase().includes(q) || o.factory.toLowerCase().includes(q))
    : options
  const full = draft.length >= MAX_BLOCKS
  const allOn = options.length > 0 && options.every((o) => draft.includes(o.blockNo))
  const someOn = draft.length > 0 && !allOn
  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = someOn
  }, [someOn, open])

  /* 목록 순서를 지킨다 — 체크한 순서가 아니라 호선의 블록 순서로 탭이 선다 */
  const ordered = (set: Set<string>) => options.map((o) => o.blockNo).filter((b) => set.has(b))

  const toggle = (blockNo: string) =>
    setDraft((prev) => {
      if (prev.includes(blockNo)) return prev.filter((b) => b !== blockNo)
      if (prev.length >= MAX_BLOCKS) return prev
      return ordered(new Set([...prev, blockNo]))
    })

  /* '전체' — 호선의 블록을 모두 켜거나(남은 자리만큼, 목록 순서대로) 모두 끈다. 켜진 게 있으면(일부) 먼저 다 켠다 */
  const toggleAll = () =>
    setDraft((prev) => {
      if (allOn || (prev.length >= MAX_BLOCKS && someOn)) return []
      const next = new Set(prev)
      for (const o of options) {
        if (next.size >= MAX_BLOCKS) break
        next.add(o.blockNo)
      }
      return ordered(next)
    })

  const apply = () => {
    onApply(draft)
    setOpen(false)
    buttonRef.current?.focus()
  }

  return (
    <div ref={containerRef} className="relative text-inshop-xs">
      {/* 버튼 하나로 선다 — 고른 블록은 아래 블록 탭이 말하므로 옆에 라벨·요약을 두지 않는다(사용자 확정) */}
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={toggleOpen}
        className={cn(
          'inline-flex h-8 items-center gap-1.5 rounded-inshop-md border px-3 text-inshop-xs font-semibold transition-colors',
          'border-accent/60 bg-accent/10 text-accent hover:bg-accent/20',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          'disabled:pointer-events-none disabled:border-border disabled:bg-transparent disabled:text-foreground/40',
          open && 'bg-accent/20'
        )}
      >
        <span aria-hidden>☰</span>
        {t('performance.filter.blockPick')}
        {selected.length > 0 && (
          <span className="rounded-full bg-accent px-1.5 text-[10px] leading-4 tabular-nums text-on-accent">
            {selected.length}
          </span>
        )}
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label={t('performance.filter.blockPick')}
          className="absolute left-0 top-full z-40 mt-1.5 w-72 rounded-inshop-lg border border-border bg-surface p-2 shadow-lg"
        >
          <input
            type="search"
            autoFocus
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder={t('performance.filter.blockSearch')}
            aria-label={t('performance.filter.blockSearch')}
            className="mb-1.5 h-8 w-full rounded-inshop-md border border-border bg-surface px-2 text-inshop-xs text-foreground placeholder:text-foreground/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
          <label
            className={cn(
              'flex cursor-pointer items-center gap-2 rounded-inshop-md px-2 py-1.5 font-medium hover:bg-surface-secondary',
              options.length === 0 && 'pointer-events-none opacity-45'
            )}
          >
            <input
              ref={allRef}
              type="checkbox"
              className="accent-accent"
              checked={allOn}
              disabled={options.length === 0}
              onChange={toggleAll}
            />
            {t('performance.filter.blockAll')}
            <span className={cn('ml-auto tabular-nums', full ? 'text-accent' : 'text-foreground/45')}>
              {t('performance.filter.blockCount', { count: draft.length, max: MAX_BLOCKS })}
            </span>
          </label>
          {full && <div className="px-2 pb-1 text-[11px] text-accent">{t('performance.filter.blockMax', { max: MAX_BLOCKS })}</div>}
          <div className="my-1 border-t border-border" />
          <ul className="max-h-64 overflow-y-auto" aria-label={t('performance.filter.blocks')}>
            {visible.length === 0 && (
              <li className="px-2 py-3 text-center text-foreground/45">{t('performance.filter.blockSearchEmpty')}</li>
            )}
            {visible.map((o) => {
              const checked = draft.includes(o.blockNo)
              const locked = full && !checked
              return (
                <li key={o.blockNo}>
                  <label
                    className={cn(
                      'flex items-center gap-2 rounded-inshop-md px-2 py-1.5',
                      locked ? 'cursor-not-allowed opacity-45' : 'cursor-pointer hover:bg-surface-secondary'
                    )}
                  >
                    <input
                      type="checkbox"
                      className="accent-accent"
                      checked={checked}
                      disabled={locked}
                      onChange={() => toggle(o.blockNo)}
                    />
                    <span className="tabular-nums">{o.blockNo}</span>
                    <span className="truncate text-foreground/50">· {o.factory}</span>
                  </label>
                </li>
              )
            })}
          </ul>
          <div className="mt-2 flex items-center justify-end gap-1.5 border-t border-border pt-2">
            <Button variant="ghost" size="sm" onClick={close}>
              {t('performance.filter.cancel')}
            </Button>
            <Button variant="solid" size="sm" disabled={draft.length === 0} onClick={apply}>
              {t('performance.filter.apply')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
