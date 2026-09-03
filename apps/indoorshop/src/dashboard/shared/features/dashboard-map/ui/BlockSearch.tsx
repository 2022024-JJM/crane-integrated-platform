import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTranslation } from '../../../lib/i18n/useTranslation'
import type { InshopKey } from '../../../lib/i18n/keys'
import {
  PerformanceLink,
  assyFocusLinkFor,
  isBlockInTransition,
  matchedAssyNos,
  searchRosterBlocks,
  sitesOfBlock,
  YARD_PROCESS_OF_ZONE,
  type RosterBlock,
} from '../../../entities/vessel'
import { Link } from 'react-router-dom'
import { colorOfProcess } from '../../../entities/yard-parcels'
import { worldToScreen, type Viewport, type YardView } from '../../yard-map'
import type { LocatedSite } from '../lib/blockSites'
import type { YardBackdropBlock } from '../../../model/yardMapBackdrop'
import { cn } from '../../../lib/utils'
import { CloseIcon, PinIcon } from '../../../ui/icons'

/**
 * 총괄 지도 위 **블록 검색** — 블록(호선-블록)을 찾으면 지도가 그 자리로 날아간다.
 *
 * 색인은 backdrop 의 `blockIndex` 로더에서 **첫 검색 때** 한 번만 받는다(대시보드 초기
 * 무게 불변 — 야드 블록 669건은 지도 배경 청크와 같은 원천이다). 검색은 부분일치다:
 * `5510`(호선), `726`(블록), `5510-726`, 원문 ID 어느 쪽으로도 걸린다.
 *
 * 색인이 **둘**이다:
 *  - **재공 블록(로스터)** — 지금 만들어지고 있는 블록. 생애 단계를 알기 때문에 지도에
 *    단계별 자리(조립 중이면 ASSY 가 흩어진 여러 자리)를 찍고, 가공 중이면 위치 대신
 *    "추적 없음"을 말한다. 누르면 그 블록의 통합실적으로 나간다.
 *  - **야드 위치(BTS)** — 운반 실적이 남긴 좌표. 점 하나뿐이지만 실측이라, 로스터가
 *    모르는 블록도 여기서 찾힌다. 지금까지의 동작 그대로다.
 *
 * 재공 블록을 위에 세운다 — 사람이 "이 블록 어디 있어요"라고 물을 때 알고 싶은 것은
 * 대개 지금 어느 공정 어느 공장에 있느냐이지 마지막 운반 좌표가 아니다.
 *
 * ASSY_NO 검색은 **로스터 쪽만** 된다 — 야드 색인에는 ASSY 열이 없다(생기면 그때 는다).
 */

/** 재공 블록 — 생애 단계를 알아 지도에 자리를 여럿 찍을 수 있다 */
export interface RosterSearchHit {
  kind: 'roster'
  id: string
  projNo: string
  blkNo: string
  block: RosterBlock
  /** 질의에 걸린 ASSY — 결과 줄이 "왜 나왔나"를 말할 수 있게 */
  matchedAssys: string[]
}

/** 야드 실측 위치 — 운반 실적이 남긴 점 하나 */
export interface YardSearchHit {
  kind: 'yard'
  id: string
  projNo: string
  blkNo: string
  yard: YardBackdropBlock
}

/** 검색 결과 한 건 — 재공 블록(로스터)이거나 야드 실측 위치다 */
export type BlockSearchHit = RosterSearchHit | YardSearchHit

const STAGE_KEY: Record<RosterBlock['zone'], InshopKey> = {
  fabrication: 'dashboard.map.blockStage.fabrication',
  assembly: 'dashboard.map.blockStage.assembly',
  outfitting: 'dashboard.map.blockStage.outfitting',
  painting: 'dashboard.map.blockStage.painting',
}

function rosterHit(block: RosterBlock, query: string): RosterSearchHit {
  return {
    kind: 'roster',
    id: `roster:${block.projNo}-${block.blockNo}`,
    projNo: block.projNo,
    blkNo: block.blockNo,
    block,
    matchedAssys: matchedAssyNos(block, query),
  }
}

function yardHit(block: YardBackdropBlock): YardSearchHit {
  return { kind: 'yard', id: `yard:${block.id}`, projNo: block.projNo, blkNo: block.blkNo, yard: block }
}

/** 자리 요약 한 줄 — `PBS 1BAY` · `PBS 1BAY 외 3곳` · 가공 중이면 추적 없음 */
function siteSummaryOf(block: RosterBlock): { placeKey: InshopKey; place: string; count: number } | null {
  const sites = sitesOfBlock(block)
  if (sites.length === 0) return null
  const first = sites[0]
  const place = first.mapBay ? `${first.factory} ${first.mapBay}BAY` : first.factory
  return sites.length === 1
    ? { placeKey: 'dashboard.map.blockSiteOne', place, count: 0 }
    : { placeKey: 'dashboard.map.blockSiteMore', place, count: sites.length - 1 }
}

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

  /* 재공 블록(로스터)이 먼저, 야드 실측 위치가 뒤. 로스터는 정적이라 색인 로딩을
     기다리지 않는다 — 입력하자마자 재공 블록이 뜬다. */
  const rosterResults = useMemo(
    () => (query ? searchRosterBlocks(query, 8).map((block) => rosterHit(block, query)) : []),
    [query]
  )
  const yardResults = useMemo(
    () => (index && query ? filterBlockIndex(index, query, 8).map(yardHit) : []),
    [index, query]
  )
  const results = useMemo(
    () => [...rosterResults, ...yardResults],
    [rosterResults, yardResults]
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

  const pick = (next: BlockSearchHit) => {
    onPick(next)
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

          {/* 재공 블록 — 생애 단계를 아는 쪽. 단계 배지와 자리 요약을 함께 낸다 */}
          {rosterResults.length > 0 && (
            <li className="px-2.5 pb-1 pt-1.5 text-2xs font-medium text-white/35">
              {t('dashboard.map.blockSectionRoster')}
            </li>
          )}
          {rosterResults.map((row) => {
            const summary = siteSummaryOf(row.block)
            return (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => pick(row)}
                  className="flex w-full flex-col gap-0.5 rounded-inshop-md px-2.5 py-1.5 text-left transition-colors hover:bg-white/8 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                >
                  <span className="flex w-full items-center gap-2">
                    <span className="shrink-0 font-mono text-inshop-xs font-medium text-white">
                      {row.projNo}-{row.blkNo}
                    </span>
                    <span className="shrink-0 rounded border border-white/16 px-1 py-px text-[10px] text-white/62">
                      {t(STAGE_KEY[row.block.zone])}
                    </span>
                    {isBlockInTransition(row.block) && (
                      <span
                        title={t('dashboard.map.blockTransitionHint')}
                        className="shrink-0 rounded border border-accent/45 px-1 py-px text-[10px] text-accent"
                      >
                        {t('dashboard.map.blockTransition')}
                      </span>
                    )}
                  </span>
                  <span className="w-full truncate text-2xs text-white/50">
                    {summary
                      ? t(summary.placeKey, { place: summary.place, count: summary.count })
                      : t('dashboard.map.blockNoTracking')}
                    {row.matchedAssys.length > 0 && (
                      <span className="ml-1.5 font-mono text-white/38">
                        {t('dashboard.map.blockMatchedAssy', {
                          list: row.matchedAssys.slice(0, 2).join(', '),
                        })}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            )
          })}

          {/* 야드 실측 위치 — 로스터가 모르는 블록도 여기서 찾힌다 */}
          {yardResults.length > 0 && (
            <li className="px-2.5 pb-1 pt-1.5 text-2xs font-medium text-white/35">
              {t('dashboard.map.blockSectionYard')}
            </li>
          )}
          {yardResults.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => pick(row)}
                className="flex w-full items-center gap-2 rounded-inshop-md px-2.5 py-1.5 text-left transition-colors hover:bg-white/8 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                <span className="shrink-0 font-mono text-inshop-xs font-medium text-white">
                  {row.projNo}-{row.blkNo}
                </span>
                <span className="min-w-0 flex-1 truncate text-2xs text-white/50">
                  {row.yard.lotLabel ?? t('dashboard.map.blockSearchNoLot')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* 고른 블록 카드 — 무엇을 보고 있는지와 나가는 문. 재공 블록은 단계·자리·실적까지,
          야드 위치는 지금까지처럼 좌표 맥락만 (아는 것만 말한다). */}
      {hit && (
        <div className="mt-2 flex w-72 max-w-full items-start gap-2 rounded-inshop-lg border border-white/12 bg-[#0b0e12]/92 p-3 shadow-lg backdrop-blur-md">
          <PinIcon size={14} className="mt-0.5 shrink-0 text-accent" />
          <div className="min-w-0 flex-1">
            <p className="font-mono text-inshop-sm font-semibold text-white">
              {hit.projNo}-{hit.blkNo}
            </p>

            {hit.kind === 'roster' ? (
              <BlockHitBody hit={hit} />
            ) : (
              <>
                <p className="mt-0.5 truncate text-2xs text-white/60">
                  {hit.yard.lotLabel ?? t('dashboard.map.blockSearchNoLot')}
                </p>
                {formatUpdatedAt(hit.yard.updatedAt) && (
                  <p className="mt-0.5 text-2xs text-white/40">
                    {t('dashboard.map.blockSearchUpdatedAt', {
                      time: formatUpdatedAt(hit.yard.updatedAt),
                    })}
                  </p>
                )}
              </>
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


/**
 * 재공 블록 카드 본문 — 단계, 자리, 그리고 실적으로 나가는 문.
 *
 * 가공 중이면 자리 줄 대신 **왜 위치가 없는지**를 적는다. "표시할 위치 없음"만 적으면
 * 데이터가 빠진 것처럼 읽히지만, 실제로는 그 권역에 수집 원천이 없다는 사실이다 —
 * 그 구분이 화면을 믿을 수 있게 만든다. 위치가 없어도 절점 실적은 있으므로 실적 링크는
 * 그대로 선다.
 */
function BlockHitBody({ hit }: { hit: RosterSearchHit }) {
  const { t } = useTranslation()
  const sites = sitesOfBlock(hit.block)
  const assyTotal = sites.reduce((sum, site) => sum + site.assys.length, 0)

  return (
    <>
      <p className="mt-1 flex flex-wrap items-center gap-1">
        <span className="rounded border border-white/16 px-1 py-px text-[10px] text-white/62">
          {t(STAGE_KEY[hit.block.zone])}
        </span>
        {isBlockInTransition(hit.block) && (
          <span
            title={t('dashboard.map.blockTransitionHint')}
            className="rounded border border-accent/45 px-1 py-px text-[10px] text-accent"
          >
            {t('dashboard.map.blockTransition')}
          </span>
        )}
        {assyTotal > 0 && (
          <span className="rounded border border-white/12 px-1 py-px font-mono text-[10px] text-white/48">
            {t('dashboard.map.blockAssyCount', { count: assyTotal })}
          </span>
        )}
      </p>

      {sites.length === 0 ? (
        <p className="mt-1 text-2xs leading-snug text-white/45">
          <span className="text-white/68">{t('dashboard.map.blockNoTracking')}</span> —{' '}
          {t('dashboard.map.blockNoTrackingHint')}
        </p>
      ) : (
        <>
          {sites.length > 1 && (
            <p className="mt-1 text-2xs text-white/45">
              {t('dashboard.map.blockSiteCount', { count: sites.length })}
            </p>
          )}
          <ul className="mt-1 space-y-0.5">
            {sites.map((site) => {
              /* ASSY 가 있는 자리는 **그 ASSY 로 포커스된** 실적으로 나간다 — 지도에서 본
                 덩이를 실적 화면에서 그대로 이어 보게 (W6-2). 블록 단위 자리는 종전대로
                 아래 '실적 보기' 버튼이 맡는다. */
              const assyLink =
                site.assys.length > 0 ? assyFocusLinkFor(site.assys.map((a) => a.assyNo)) : null
              const body = (
                <>
                  <span
                    aria-hidden="true"
                    className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: colorOfProcess(YARD_PROCESS_OF_ZONE[site.zone]) }}
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {site.factory}
                    {site.mapBay && <span className="text-white/45"> {site.mapBay}BAY</span>}
                  </span>
                  {site.assys.length > 0 && (
                    <span className="shrink-0 font-mono text-[10px] text-white/40">
                      {site.assys.length}
                    </span>
                  )}
                </>
              )
              return (
                <li key={site.id} className="text-2xs text-white/60">
                  {assyLink ? (
                    <Link
                      to={assyLink}
                      title={t('dashboard.map.blockAssyPerfHint', {
                        list: site.assys.map((a) => a.assyNo).join(', '),
                      })}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-baseline gap-1.5 rounded px-0.5 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-white/70"
                    >
                      {body}
                    </Link>
                  ) : (
                    <span className="flex items-baseline gap-1.5">{body}</span>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}

      <div className="mt-2">
        <PerformanceLink
          projNo={hit.projNo}
          blockNo={hit.blkNo}
          tone="onDark"
          className="py-1"
        />
      </div>
    </>
  )
}

/* ── 지도 핀 오버레이 ────────────────────────────────────────────── */

export interface BlockSearchPinHandle {
  updateView: (view: YardView, viewport: Viewport) => void
}

/** 화면에 들어오는 점만 그린다 — 화면 밖 마커까지 DOM 에 세우지 않는다 */
function screenPoint(
  camera: { view: YardView; viewport: Viewport },
  lat: number,
  lon: number
): { sx: number; sy: number } | null {
  const { sx, sy } = worldToScreen(camera.view, camera.viewport, lat, lon, 0)
  if (sx < -40 || sy < -40 || sx > camera.viewport.width + 40 || sy > camera.viewport.height + 40) {
    return null
  }
  return { sx, sy }
}

/**
 * 검색으로 고른 블록의 **자리 마커들** — 한 블록이 여러 점을 차지한다.
 *
 * `FactoryHudLabel` 과 같은 imperative 문법이다: 카메라의 매 프레임을 props 로 받으면
 * 부모(대시보드 전체)가 프레임마다 리렌더되므로, 이 층만 ref 로 갱신한다.
 *
 * 마커는 **누를 수 있다** — 어느 자리를 누르든 같은 블록의 통합실적으로 간다(자리는
 * 그 블록의 부분이지 다른 대상이 아니다). 그래서 마커 층 자체는 클릭을 통과시키고
 * (`pointer-events-none`) 마커 알맹이만 받는다 — 지도 드래그를 마커가 막지 않게.
 *
 * 자리가 없는 블록(가공 중)은 아무것도 그리지 않는다. 그 사정은 검색 카드가 말한다.
 */
export const BlockSitePins = forwardRef<
  BlockSearchPinHandle,
  {
    /** 무엇의 자리인가 — 마커 라벨과 실적 링크의 주인 */
    label: string
    to: string
    sites: readonly LocatedSite[]
    initialCamera: { view: YardView; viewport: Viewport } | null
  }
>(function BlockSitePins({ label, to, sites, initialCamera }, ref) {
  const { t } = useTranslation()
  const [camera, setCamera] = useState(initialCamera)
  useImperativeHandle(
    ref,
    () => ({ updateView: (view, viewport) => setCamera({ view, viewport }) }),
    []
  )
  if (!camera || camera.viewport.width === 0 || sites.length === 0) return null

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {sites.map((site) => {
        const point = screenPoint(camera, site.lat, site.lon)
        if (!point) return null
        const color = colorOfProcess(YARD_PROCESS_OF_ZONE[site.zone])
        /* ASSY 마커는 그 ASSY 로 포커스된 실적으로 — 자리에 묶인 덩이가 곧 링크의 대상이다 */
        const assyLink =
          site.assys.length > 0 ? assyFocusLinkFor(site.assys.map((a) => a.assyNo)) : null
        return (
          <Link
            key={site.id}
            to={assyLink ?? to}
            title={
              site.assys.length > 0
                ? t('dashboard.map.blockAssyPerfHint', {
                    list: site.assys.map((a) => a.assyNo).join(', '),
                  })
                : t('dashboard.map.blockSitePinHint', { block: label })
            }
            className="pointer-events-auto absolute -translate-x-1/2 -translate-y-full focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            style={{ left: point.sx, top: point.sy }}
          >
            <span className="flex flex-col items-center">
              <span
                className="max-w-40 truncate rounded-inshop-md border bg-[#0b0e12]/92 px-1.5 py-0.5 font-mono text-2xs font-semibold text-white shadow-lg"
                style={{ borderColor: `${color}99`, boxShadow: `0 0 14px ${color}55` }}
              >
                {label}
                {site.mapBay && <span className="ml-1 text-white/55">{site.mapBay}BAY</span>}
              </span>
              {/* ASSY 이름 — 여러 자리로 흩어진 블록에서 "여기 있는 게 무엇인지"를 말한다.
                  둘까지만 적고 나머지는 수로 — 마커가 지도를 덮지 않게. */}
              {site.assys.length > 0 && (
                <span className="mt-0.5 max-w-44 truncate rounded bg-black/70 px-1 py-px font-mono text-[10px] text-white/62">
                  {site.assys.slice(0, 2).map((a) => a.assyNo.split('-').pop()).join(' ')}
                  {site.assys.length > 2 && ` +${site.assys.length - 2}`}
                </span>
              )}
              <span className="mt-0.5 h-3 w-px" style={{ background: `${color}b3` }} />
              <span
                className="h-2 w-2 animate-ping rounded-full"
                style={{ background: color }}
              />
            </span>
          </Link>
        )
      })}
    </div>
  )
})
