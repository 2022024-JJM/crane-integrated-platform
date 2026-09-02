import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTranslation } from '../../lib/i18n/useTranslation'
import { worldToScreen, type Viewport, type YardView } from '../../features/yard-map'
import type { YardBackdropBlock } from '../../model/yardMapBackdrop'
import { cn } from '../../lib/utils'
import { CloseIcon, PinIcon } from '../../ui/icons'

/**
 * 총괄 지도 위 **블록 검색** — 블록(호선-블록)을 찾으면 지도가 그 자리로 날아간다.
 *
 * 색인은 backdrop 의 `blockIndex` 로더에서 **첫 검색 때** 한 번만 받는다(대시보드 초기
 * 무게 불변 — 야드 블록 669건은 지도 배경 청크와 같은 원천이다). 검색은 부분일치다:
 * `5510`(호선), `726`(블록), `5510-726`, 원문 ID 어느 쪽으로도 걸린다.
 *
 * ASSY 검색은 지원하지 않는다 — 야드 블록 위치(BTS 계열)에는 ASSY_NO 가 없어 블록으로
 * 이어 줄 데이터가 아직 없다(데이터가 생기면 이 색인에 열만 는다).
 */

export interface BlockSearchHit extends YardBackdropBlock {}

/** 색인 걸러내기 — 순수 함수(테스트 대상). 질의 정규화: 공백·대소문자 무시, `-`↔`_` 동일 취급 */
export function filterBlockIndex(
  index: readonly YardBackdropBlock[],
  query: string,
  limit = 12
): YardBackdropBlock[] {
  const q = query.trim().toLowerCase().replace(/[-_\s]+/g, '_')
  if (!q) return []
  const hits: YardBackdropBlock[] = []
  for (const block of index) {
    const idNorm = block.id.toLowerCase().replace(/[-_\s]+/g, '_')
    const pair = `${block.projNo}_${block.blkNo}`.toLowerCase()
    if (idNorm.includes(q) || pair.includes(q)) {
      hits.push(block)
      if (hits.length >= limit) break
    }
  }
  return hits
}

/** `YYYYMMDDHHMMSS` → `MM-DD HH:mm` (형식이 아니면 원문 그대로) */
function formatUpdatedAt(raw: string | null): string | null {
  if (!raw || raw.length < 12) return raw
  return `${raw.slice(4, 6)}-${raw.slice(6, 8)} ${raw.slice(8, 10)}:${raw.slice(10, 12)}`
}

export function BlockSearch({
  loadIndex,
  hit,
  onPick,
  onClear,
  className,
}: {
  /** 색인 로더 — backdrop 이 아직이면 null (인풋은 비활성) */
  loadIndex: (() => Promise<readonly YardBackdropBlock[]>) | null
  /** 지금 지도에 표시 중인 블록 — 카드로 보여 주고, 닫으면 onClear */
  hit: BlockSearchHit | null
  onPick: (hit: BlockSearchHit) => void
  onClear: () => void
  className?: string
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState<readonly YardBackdropBlock[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const loadOnce = useRef(false)

  /* 색인은 첫 입력/포커스 때 한 번만 — 그 전의 '/' 는 지금까지와 같은 무게다 */
  const ensureIndex = () => {
    if (loadOnce.current || !loadIndex) return
    loadOnce.current = true
    setLoading(true)
    loadIndex()
      .then(setIndex)
      .catch(() => {
        loadOnce.current = false // 실패하면 다음 시도에서 다시 부른다
      })
      .finally(() => setLoading(false))
  }

  const results = useMemo(
    () => (index && query ? filterBlockIndex(index, query) : []),
    [index, query]
  )

  /* 바깥 클릭으로 드롭다운을 접는다 */
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [])

  const pick = (block: YardBackdropBlock) => {
    onPick(block)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={rootRef} className={cn('pointer-events-auto relative', className)}>
      <div className="flex h-9 items-center gap-2 rounded-inshop-lg border border-white/12 bg-[#0b0e12]/90 px-3 shadow-lg backdrop-blur-md focus-within:ring-2 focus-within:ring-white/50">
        <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 text-white/45">
          <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10.5 10.5 14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
            ensureIndex()
          }}
          onFocus={() => {
            if (query) setOpen(true)
            ensureIndex()
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && results.length > 0) pick(results[0])
            if (event.key === 'Escape') setOpen(false)
          }}
          placeholder={t('dashboard.map.blockSearchPlaceholder')}
          aria-label={t('dashboard.map.blockSearchLabel')}
          className="w-44 bg-transparent text-inshop-xs text-white placeholder:text-white/40 focus:outline-none"
        />
      </div>

      {/* 결과 드롭다운 — 최대 12건. 색인이 크지 않아(수백 건) 클라이언트 필터로 충분하다 */}
      {open && query && (
        <ul className="scroll-thin absolute left-0 top-10 z-20 max-h-72 w-72 overflow-y-auto rounded-inshop-lg border border-white/12 bg-[#0b0e12]/95 p-1 shadow-[0_18px_48px_rgba(0,0,0,0.4)] backdrop-blur-xl">
          {loading && (
            <li className="px-2.5 py-2 text-2xs text-white/45">{t('common.loading')}</li>
          )}
          {!loading && results.length === 0 && (
            <li className="px-2.5 py-2 text-2xs text-white/45">
              {t('dashboard.map.blockSearchEmpty')}
            </li>
          )}
          {results.map((block) => (
            <li key={block.id}>
              <button
                type="button"
                onClick={() => pick(block)}
                className="flex w-full items-center gap-2 rounded-inshop-md px-2.5 py-1.5 text-left transition-colors hover:bg-white/8 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                <span className="shrink-0 font-mono text-inshop-xs font-medium text-white">
                  {block.projNo}-{block.blkNo}
                </span>
                <span className="min-w-0 flex-1 truncate text-2xs text-white/50">
                  {block.lotLabel ?? t('dashboard.map.blockSearchNoLot')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* 고른 블록 카드 — 호선-블록과 위치 설명(맥락)만. 닫으면 지도 강조도 함께 걷힌다 */}
      {hit && (
        <div className="mt-2 flex w-72 max-w-full items-start gap-2 rounded-inshop-lg border border-white/12 bg-[#0b0e12]/92 p-3 shadow-lg backdrop-blur-md">
          <PinIcon size={14} className="mt-0.5 shrink-0 text-accent" />
          <div className="min-w-0 flex-1">
            <p className="font-mono text-inshop-sm font-semibold text-white">
              {hit.projNo}-{hit.blkNo}
            </p>
            <p className="mt-0.5 truncate text-2xs text-white/60">
              {hit.lotLabel ?? t('dashboard.map.blockSearchNoLot')}
            </p>
            {formatUpdatedAt(hit.updatedAt) && (
              <p className="mt-0.5 text-2xs text-white/40">
                {t('dashboard.map.blockSearchUpdatedAt', { time: formatUpdatedAt(hit.updatedAt) })}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClear}
            aria-label={t('dashboard.map.close')}
            className="grid h-6 w-6 shrink-0 place-items-center rounded-inshop-md text-white/45 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <CloseIcon size={13} />
          </button>
        </div>
      )}
    </div>
  )
}

/* ── 지도 핀 오버레이 ────────────────────────────────────────────── */

export interface BlockSearchPinHandle {
  updateView: (view: YardView, viewport: Viewport) => void
}

/**
 * 고른 블록 자리의 핀 — `FactoryHudLabel` 과 같은 imperative 문법이다: 카메라의 매
 * 프레임을 props 로 받으면 부모(대시보드 전체)가 프레임마다 리렌더되므로, 핀 층만
 * ref 로 갱신한다. 지번 글로우(highlightedLot)가 자리 문맥을, 이 핀이 정확한 점을 맡는다.
 */
export const BlockSearchPin = forwardRef<
  BlockSearchPinHandle,
  { hit: BlockSearchHit; initialCamera: { view: YardView; viewport: Viewport } | null }
>(function BlockSearchPin({ hit, initialCamera }, ref) {
  const [camera, setCamera] = useState(initialCamera)
  useImperativeHandle(
    ref,
    () => ({ updateView: (view, viewport) => setCamera({ view, viewport }) }),
    []
  )
  if (!camera || camera.viewport.width === 0) return null
  const { sx, sy } = worldToScreen(camera.view, camera.viewport, hit.lat, hit.lon, 0)
  if (sx < -40 || sy < -40 || sx > camera.viewport.width + 40 || sy > camera.viewport.height + 40)
    return null
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full"
      style={{ left: sx, top: sy }}
    >
      <div className="flex flex-col items-center">
        <span className="rounded-inshop-md border border-accent/60 bg-[#0b0e12]/92 px-1.5 py-0.5 font-mono text-2xs font-semibold text-white shadow-[0_0_14px_rgba(249,145,55,0.45)]">
          {hit.projNo}-{hit.blkNo}
        </span>
        <span className="mt-0.5 h-3 w-px bg-accent/70" />
        <span className="h-2 w-2 animate-ping rounded-full bg-accent" />
      </div>
    </div>
  )
})
