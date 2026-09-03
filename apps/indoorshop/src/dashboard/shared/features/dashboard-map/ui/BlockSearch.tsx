import { forwardRef, useImperativeHandle, useState } from 'react'
import { useTranslation } from '../../../lib/i18n/useTranslation'
import type { InshopKey } from '../../../lib/i18n/keys'
import { Link } from 'react-router-dom'
import {
  PerformanceLink,
  assyFocusLinkFor,
  isBlockInTransition,
  sitesOfBlock,
  YARD_PROCESS_OF_ZONE,
  type RosterBlock,
} from '../../../entities/vessel'
import { colorOfProcess } from '../../../entities/yard-parcels'
import { worldToScreen, type Viewport, type YardView } from '../../yard-map'
import type { MapFocus } from '../../global-search'
import type { LocatedSite } from '../lib/blockSites'
import { DraggableCard } from '../../../ui/atoms/DraggableCard'
import { CloseIcon, PinIcon } from '../../../ui/icons'

/**
 * 총괄 지도가 **검색으로 고른 대상을 보여 주는 자리** — 카드와 마커.
 *
 * 검색 자체는 여기 없다. 예전에는 이 파일이 입력창·자기 색인(로스터 + 야드 BTS)·자기
 * 키보드·자기 줄 그리기를 전부 들고 있었고, 그래서 Cmd+K 팔레트와 같은 글자에 다른 답을
 * 했다(야드 블록은 이쪽만 알았다). 지금 검색은 `shared/features/global-search` 하나이고
 * 지도 위 입력창은 그 모듈의 임베드 변형(`SearchField`)이다 — 여기 남은 것은 **고른 뒤에
 * 지도가 하는 일**뿐이다.
 *
 * 무엇을 비추는지는 **주소**가 정한다(`MapFocus` — `?vessel=&block=&assy=`). 그래서
 * 팔레트에서 고른 블록도 총괄로 이동해 같은 마커를 세우고, 새로고침·링크 공유에도
 * 그 표시가 살아 있다.
 */

const STAGE_KEY: Record<RosterBlock['zone'], InshopKey> = {
  fabrication: 'dashboard.map.blockStage.fabrication',
  assembly: 'dashboard.map.blockStage.assembly',
  outfitting: 'dashboard.map.blockStage.outfitting',
  painting: 'dashboard.map.blockStage.painting',
}

/** 공정존 → 그 공정의 색. 지도가 공장 지번을 칠하는 색과 같은 함수에서 온다 */
function zoneColor(zone: RosterBlock['zone']): string {
  return colorOfProcess(YARD_PROCESS_OF_ZONE[zone])
}

/** `YYYYMMDDHHMMSS` → `MM-DD HH:mm` (형식이 아니면 원문 그대로) */
function formatUpdatedAt(raw: string | null): string | null {
  if (!raw || raw.length < 12) return raw
  return `${raw.slice(4, 6)}-${raw.slice(6, 8)} ${raw.slice(8, 10)}:${raw.slice(10, 12)}`
}

/**
 * 지금 지도가 무엇을 비추고 있는지 말하는 카드 — 그리고 거기서 나가는 문.
 *
 * 호선을 고르면 그 호선 블록 전부가 대상이라 카드도 목록으로 선다(블록 하나면 종전처럼
 * 단계·자리·실적을 편다). 닫으면 주소에서 표시만 걷힌다.
 */
export function MapFocusCard({ focus, onClear }: { focus: MapFocus; onClear: () => void }) {
  const { t } = useTranslation()

  return (
    <DraggableCard
      cardKey="block-search-hit"
      className="mt-2 flex w-80 max-w-full items-start gap-2 rounded-inshop-lg border border-white/15 bg-[#0b0e12]/92 p-3 shadow-lg backdrop-blur-md"
    >
      <PinIcon size={14} className="mt-0.5 shrink-0 text-accent" />
      <div className="min-w-0 flex-1">
        <p className="font-mono text-inshop-sm font-semibold text-white">{focus.label}</p>

        {focus.kind === 'vessel' ? (
          <VesselFocusBody focus={focus} />
        ) : focus.yard ? (
          <>
            <p className="mt-0.5 truncate text-2xs text-white/60">
              {focus.yard.lotLabel ?? t('dashboard.map.blockSearchNoLot')}
            </p>
            {formatUpdatedAt(focus.yard.updatedAt) && (
              <p className="mt-0.5 text-2xs text-white/40">
                {t('dashboard.map.blockSearchUpdatedAt', {
                  time: formatUpdatedAt(focus.yard.updatedAt),
                })}
              </p>
            )}
          </>
        ) : (
          focus.blocks[0] && <BlockFocusBody block={focus.blocks[0]} />
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
    </DraggableCard>
  )
}

/**
 * 호선 전체 카드 — "이 호선이 지금 어디까지 왔나".
 *
 * 블록 하나하나의 자리를 다 적으면 카드가 지도를 덮는다. 대신 **단계별 몇 블록**인지로
 * 접고, 줄을 누르면 그 블록으로 좁혀 들어간다(마커는 이미 전부 서 있다).
 */
function VesselFocusBody({ focus }: { focus: MapFocus }) {
  const { t } = useTranslation()
  const byZone = new Map<RosterBlock['zone'], RosterBlock[]>()
  for (const block of focus.blocks) {
    const list = byZone.get(block.zone)
    if (list) list.push(block)
    else byZone.set(block.zone, [block])
  }

  return (
    <>
      <p className="mt-0.5 text-2xs text-white/50">
        {t('dashboard.map.vesselBlockCount', { count: focus.blocks.length })}
      </p>
      <ul className="mt-1.5 space-y-1">
        {[...byZone.entries()].map(([zone, blocks]) => (
          <li key={zone} className="flex items-baseline gap-1.5 text-2xs text-white/62">
            <span
              className="shrink-0 rounded border border-white/16 py-px pl-1.5 pr-1 text-[10px] text-white/70"
              style={{ boxShadow: `inset 2px 0 0 ${zoneColor(zone)}` }}
            >
              {t(STAGE_KEY[zone])}
            </span>
            <span className="min-w-0 flex-1 truncate font-mono text-white/55">
              {blocks.map((block) => block.blockNo).join(' · ')}
            </span>
          </li>
        ))}
      </ul>
    </>
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
function BlockFocusBody({ block }: { block: RosterBlock }) {
  const { t } = useTranslation()
  const sites = sitesOfBlock(block)
  const assyTotal = sites.reduce((sum, site) => sum + site.assys.length, 0)

  return (
    <>
      <p className="mt-1 flex flex-wrap items-center gap-1">
        {/* 드롭다운 결과 줄과 같은 공정색 좌막대(F-11) — 고른 순간 드롭다운은 사라지고
            남는 것이 이 카드라서, 색 문법이 여기서 끊기면 지적된 자리가 그대로 남는다 */}
        <span
          className="rounded border border-white/16 py-px pl-1.5 pr-1 text-[10px] text-white/70"
          style={{ boxShadow: `inset 2px 0 0 ${zoneColor(block.zone)}` }}
        >
          {t(STAGE_KEY[block.zone])}
        </span>
        {isBlockInTransition(block) && (
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
          projNo={block.projNo}
          blockNo={block.blockNo}
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
 *
 * 자리마다 **제 이름과 제 링크**를 달고 온다 — 호선을 고르면 여러 블록의 자리가 한꺼번에
 * 서므로(생애주기 마커), 마커 하나가 어느 블록의 것인지 이름으로 말해야 한다.
 */
/** 지도에 서는 자리 하나 — 어느 블록의 것인지(이름·링크)를 자기가 안다 */
export interface FocusPin extends LocatedSite {
  /** 마커에 적는 이름 (`7004-222`) */
  label: string
  /** 이 자리를 눌렀을 때 가는 곳 (그 블록의 통합실적) */
  to: string
}

export const BlockSitePins = forwardRef<
  BlockSearchPinHandle,
  {
    sites: readonly FocusPin[]
    initialCamera: { view: YardView; viewport: Viewport } | null
  }
>(function BlockSitePins({ sites, initialCamera }, ref) {
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
            to={assyLink ?? site.to}
            title={
              site.assys.length > 0
                ? t('dashboard.map.blockAssyPerfHint', {
                    list: site.assys.map((a) => a.assyNo).join(', '),
                  })
                : t('dashboard.map.blockSitePinHint', { block: site.label })
            }
            className="pointer-events-auto absolute -translate-x-1/2 -translate-y-full focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            style={{ left: point.sx, top: point.sy }}
          >
            <span className="flex flex-col items-center">
              <span
                className="max-w-40 truncate rounded-inshop-md border bg-[#0b0e12]/92 px-1.5 py-0.5 font-mono text-2xs font-semibold text-white shadow-lg"
                style={{ borderColor: `${color}99`, boxShadow: `0 0 14px ${color}55` }}
              >
                {site.label}
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
