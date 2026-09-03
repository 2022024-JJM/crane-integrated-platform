import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '../../../lib/i18n/useTranslation'
import { SearchIcon } from '../../../ui/icons'
import { DraggableCard } from '../../../ui/atoms/DraggableCard'
import { cn } from '../../../lib/utils'
import { useSearchBox } from '../lib/useSearchBox'
import { SearchResultRows, rowDomId, type SearchRow } from './SearchResultRows'

/*
 * **임베드 검색창** — 팔레트(Cmd+K)와 같은 모듈의 다른 옷.
 *
 * 대시보드 총괄 지도 위에 상주하는 검색이 이것이다. 예전에는 이 자리에 별도 컴포넌트가
 * 서서 제 색인(로스터 + 야드 BTS)과 제 키보드·제 줄 그리기를 따로 갖고 있었다. 그래서
 * 같은 글자를 팔레트에 치면 다른 답이 나왔고(야드 블록은 지도 검색만 알았다), 행선지도
 * 갈렸다(지도 검색은 지도에 표시, 팔레트는 통합실적으로 이탈). 지금은 색인·규칙·행선지가
 * 전부 이 모듈 하나에서 오고, **다른 것은 재질뿐**이다 — 지도 위라 어두운 유리를 쓴다.
 *
 * 오른쪽 끝 `⌘K` 칩이 그 관계를 말한다: 이건 다른 기능이 아니라 **같은 검색의 상주
 * 입구**이고, 단축키를 누르면 같은 것이 화면 한가운데로 열린다.
 */

/** 지도 위 유리 재질 — 대시보드 오버레이 카드들과 같은 관용구(새 토큰을 만들지 않는다) */
const LIST_ID = 'map-search'

export function SearchField({
  className,
  'data-tour': dataTour,
}: {
  className?: string
  /** 투어(코치마크)가 이 검색을 비출 때 잡는 손잡이 */
  'data-tour'?: string
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  /** 입력 폭 확장의 근거 — 포커스 중이거나 글자가 남아 있으면 편 채로 둔다 */
  const [focused, setFocused] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const box = useSearchBox({
    onPicked: () => {
      setOpen(false)
      box.setQuery('')
    },
  })

  /* 바깥 클릭으로 드롭다운을 접는다 */
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [])

  const rows: readonly SearchRow[] = box.results

  /*
   * 존재감 (UX 감사 — "못 찾는 수준"):
   *  - 쉬고 있을 때도 강조색 돋보기가 "여기가 검색"임을 말하고, 예시가 든 플레이스홀더가
   *    무엇을 칠 수 있는지 알려 준다.
   *  - 포커스하면 입력이 옆으로 **펴진다** — 강조색 링이 지도 위 다른 카드들과 위계를
   *    가른다. 글자가 남아 있으면 편 채로 둔다(입력 중 폭이 줄면 글자가 밀린다).
   *  - 색은 전부 기존 토큰/맵 글라스 관용구다 — 새 팔레트 값을 만들지 않는다.
   */
  return (
    <div ref={rootRef} data-tour={dataTour} className={cn('pointer-events-auto relative', className)}>
      <div
        className={cn(
          'flex h-10 items-center gap-2 rounded-inshop-lg border bg-[#0b0e12]/92 px-3 shadow-lg backdrop-blur-md',
          'transition-colors',
          focused ? 'border-accent/60 ring-2 ring-accent/35' : 'border-white/15 hover:border-white/28'
        )}
      >
        <SearchIcon size={15} className="shrink-0 text-accent" />
        <input
          value={box.query}
          onChange={(event) => {
            box.setQuery(event.target.value)
            setOpen(true)
          }}
          onFocus={() => {
            setFocused(true)
            if (box.query) setOpen(true)
          }}
          onBlur={() => setFocused(false)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              /* 이 ESC 는 드롭다운을 닫는 데 썼다 — 지도 드릴다운까지 올라가지 않게 */
              event.preventDefault()
              setOpen(false)
              return
            }
            box.onKeyDown(event)
          }}
          placeholder={t('dashboard.map.blockSearchPlaceholder')}
          aria-label={t('dashboard.map.blockSearchLabel')}
          role="combobox"
          aria-expanded={open && rows.length > 0}
          aria-controls={LIST_ID}
          aria-activedescendant={
            open && rows.length > 0 ? rowDomId(LIST_ID, box.activeIndex) : undefined
          }
          data-expanded={focused || box.query.length > 0}
          className={cn(
            'bg-transparent text-inshop-xs text-white placeholder:text-white/45 focus:outline-none',
            'transition-[width] duration-200',
            focused || box.query ? 'w-64' : 'w-40'
          )}
        />
        {/* 같은 검색의 단축키 — 이 창과 팔레트가 한 기능임을 자리에서 말한다 */}
        <kbd className="shrink-0 rounded border border-white/16 px-1 py-px font-mono text-[10px] text-white/45">
          {t('globalSearch.shortcutChip')}
        </kbd>
      </div>

      {/* 결과 드롭다운 — 그룹·줄·활성 표시가 팔레트와 같은 부품에서 온다 */}
      {open && box.query.trim() && (
        <DraggableCard
          cardKey="block-search-results"
          className="absolute left-0 top-11 z-20 w-80 overflow-hidden rounded-inshop-lg border border-white/15 bg-[#0b0e12]/95 shadow-[0_18px_48px_rgba(0,0,0,0.4)] backdrop-blur-xl"
        >
          {/* 몇 건인지 적는 줄 — 결과 목록의 손잡이를 겸한다(목록 자체는 스크롤이 제 일) */}
          <div
            data-drag-handle
            className="flex items-center justify-between border-b border-white/8 px-2.5 py-1.5 text-2xs text-white/42"
          >
            <span>{t('dashboard.map.blockSearchLabel')}</span>
            <span className="tabular-nums">{t('common.count', { count: rows.length })}</span>
          </div>
          <ul
            id={LIST_ID}
            role="listbox"
            aria-label={t('dashboard.map.blockSearchLabel')}
            className="scroll-thin max-h-72 overflow-y-auto p-1"
          >
            {rows.length === 0 && (
              <li className="px-2.5 py-2 text-2xs text-white/45">
                {t('dashboard.map.blockSearchEmpty')}
              </li>
            )}
            <SearchResultRows
              rows={rows}
              activeIndex={box.activeIndex}
              listId={LIST_ID}
              tone="glass"
              onPick={(row) => box.go(row)}
              onHover={box.setActiveIndex}
            />
          </ul>
        </DraggableCard>
      )}
    </div>
  )
}
