import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import type { BasemapLayer, LatLonBounds, MapTheme } from '../../../shared/features/yard-map'
import type { YardParcels } from '../../../shared/entities/yard-parcels'
import { ProcessMapEntry, type MapEntryLabels } from '../../../shared/features/process-map-entry'
import { cn } from '../../../shared/lib/utils'
import {
  OUTFITTING_STATUS_META,
  type OutfittingBlock,
  type OutfittingBlockStatus,
  type OutfittingFactoryOverview,
} from '../model/block'
import { areasByBay, blocksOfBay, outfittingFactoryByName } from '../lib/bayBlocks'
import { SpinnerOverlay } from '../../../shared/ui/atoms/Spinner'

/* 베이 3D 뷰는 three.js 를 끄는 무거운 화면 — 열 때만 청크를 부른다(맵 진입을 가볍게) */
const OutfittingBayViewer = lazy(() =>
  import('./OutfittingBayViewer').then((m) => ({ default: m.OutfittingBayViewer }))
)

/*
 * 선행의장 맵 진입 — '맵 진입 공정 화면' 공통 프레임(process-map-entry)의 소비자.
 *
 * 맵 로딩·타 공정 지번 강등·공장 포커스/fly-to·베이 드릴다운·좌상단 한 자리 오버레이·
 * 우측 접이식 카드 패널은 전부 프레임의 몫이다. 이 파일에 남는 것은 **의장 고유부**뿐이다:
 * 공장 카드의 블록·LiDAR 요약, 베이 카드에 덧붙는 **블록 목록**(의장은 블록이 작업 단위라
 * 베이에서 블록이 보여야 한다), PCD 뷰어 자리 카드, 그리고 의장 문구(i18n 은 여기서
 * 끝낸다 — 프레임은 t() 를 모른다).
 *
 * 마커 층은 만들지 않는다 — 의장 공장 LiDAR 실좌표 도면을 아직 받지 못해, 없는 자리에
 * 마커를 지어내지 않는다(실좌표 수령 시 도장 설비 마커와 같은 문법으로 얹는다).
 * accentOf 도 주지 않는다 — 기본이 그 공장의 공정색이라 의장 주황이 저절로 선다.
 */

const OUTFITTING_PROCESS = '의장'

/**
 * 어두운 오버레이 카드 위의 상태 배색 — OUTFITTING_STATUS_META 의 dot/ink 는 라이트
 * 화면(foreground=먹색) 기준이라, '대기'의 foreground 계열이 검은 카드에 녹아 사라진다.
 * 라벨(labelKey)은 그대로 쓰고 색만 흰색 계열로 바꾼다.
 */
const DARK_STATUS_STYLE: Record<OutfittingBlockStatus, { dot: string; ink: string }> = {
  in_progress: { dot: 'bg-status-healthy', ink: 'text-status-healthy' },
  completed: { dot: 'bg-accent', ink: 'text-accent' },
  waiting: { dot: 'bg-white/30', ink: 'text-white/55' },
}

/** 3D 뷰가 겨눈 베이 — 지번 fixture 의 베이 번호(공장 내 유일)와 화면 라벨 */
interface ViewerTarget {
  factory: string
  bayNo: string
  bayLabel: string
}

/** 블록 상태 구성 — 목록 카드의 StatusBar 를 어두운 오버레이 배색으로 옮긴 것 */
function DarkStatusBar({ overview }: { overview: OutfittingFactoryOverview }) {
  const { t } = useTranslation()
  const total = overview.blockTotal || 1
  const segments: { key: OutfittingBlockStatus; count: number }[] = [
    { key: 'in_progress', count: overview.inProgress },
    { key: 'completed', count: overview.completed },
    { key: 'waiting', count: overview.waiting },
  ]
  return (
    <div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-white/10">
        {segments
          .filter((segment) => segment.count > 0)
          .map((segment) => (
            <span
              key={segment.key}
              className={DARK_STATUS_STYLE[segment.key].dot}
              style={{ width: `${(segment.count / total) * 100}%` }}
            />
          ))}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        {segments.map((segment) => (
          <span key={segment.key} className="flex items-center gap-1.5 text-2xs text-white/60">
            <span
              aria-hidden="true"
              className={cn('h-1.5 w-1.5 rounded-full', DARK_STATUS_STYLE[segment.key].dot)}
            />
            {t(OUTFITTING_STATUS_META[segment.key].labelKey)} {segment.count}
          </span>
        ))}
      </div>
    </div>
  )
}

/** 베이 카드의 블록 한 줄 — 누르면 그 베이의 3D 뷰가 열린다 */
function BayBlockRow({ block, onOpen }: { block: OutfittingBlock; onOpen: () => void }) {
  const { t } = useTranslation()
  const meta = OUTFITTING_STATUS_META[block.status]
  const dark = DARK_STATUS_STYLE[block.status]
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        title={t('outfitting.mapEntry.viewer.rowHint')}
        className="flex w-full items-center gap-2 rounded-inshop-md px-2 py-1 text-left transition-colors hover:bg-white/[0.07] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      >
        <span aria-hidden="true" className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dark.dot)} />
        <span className="w-20 shrink-0 truncate font-mono text-2xs text-white/88">
          {block.projNo}-{block.blkNo}
        </span>
        <span className={cn('w-11 shrink-0 text-2xs font-medium', dark.ink)}>{t(meta.labelKey)}</span>
        <span className="min-w-0 flex-1">
          <span className="block h-1 overflow-hidden rounded-full bg-white/10">
            <span
              className={cn('block h-full rounded-full', dark.dot)}
              style={{ width: `${block.progress}%` }}
            />
          </span>
        </span>
        <span className="w-8 shrink-0 text-right font-mono text-2xs tabular-nums text-white/62">
          {block.progress}%
        </span>
      </button>
    </li>
  )
}

interface OutfittingMapEntryProps {
  parcels: YardParcels
  /** 주인공 공장 이름들 — 의장 7공장 (지번 fixture 공장명 = 의장 fixture name) */
  factories: readonly string[]
  selectedFactory: string
  onSelectFactory: (factory: string) => void
  /** 공장명 → 목록 화면과 같은 집계 (블록 수·상태 구성·LiDAR) */
  overviewByName: ReadonlyMap<string, OutfittingFactoryOverview>
  /** 전 공장 블록 — 베이 카드가 그 베이 소속만 걸러 보여준다 */
  blocks: readonly OutfittingBlock[]
  basemapLayers: Record<MapTheme, BasemapLayer[]>
  yardExtent?: LatLonBounds | null
  /** true 면 처음을 의장 전체 보기로 연다 (딥링크 `?shop=` 진입은 false 로 그 공장을 연다) */
  initialOverview?: boolean
  className?: string
}

export function OutfittingMapEntry({
  parcels,
  factories,
  selectedFactory,
  onSelectFactory,
  overviewByName,
  blocks,
  basemapLayers,
  yardExtent,
  initialOverview = false,
  className,
}: OutfittingMapEntryProps) {
  const { t } = useTranslation()

  /* 베이 3D 뷰 — 공장이 바뀌면 닫는다(도장의 설비 상세와 같은 규칙) */
  const [viewerTarget, setViewerTarget] = useState<ViewerTarget | null>(null)
  useEffect(() => {
    setViewerTarget(null)
  }, [selectedFactory])

  /* 베이 → 구역 배정 — 의장 베이만 잰다. 블록을 베이 소속으로 거르는 근거 */
  const areasOfBays = useMemo(
    () => areasByBay(parcels.bays.filter((bay) => bay.process === OUTFITTING_PROCESS)),
    [parcels]
  )

  const labels = useMemo<MapEntryLabels>(
    () => ({
      panelTitle: t('outfitting.mapEntry.factoriesTitle'),
      viewAll: t('outfitting.mapEntry.viewAll'),
      viewAllHint: t('outfitting.mapEntry.viewAllHint'),
      expand: t('outfitting.mapEntry.expand'),
      collapse: t('outfitting.mapEntry.collapse'),
      viewOnMap: t('outfitting.mapEntry.viewOnMap'),
      bayCount: (n) => t('dashboard.map.bayCount', { count: n }),
    }),
    [t]
  )

  return (
    <>
    <ProcessMapEntry
      parcels={parcels}
      factoryNames={factories}
      basemapLayers={basemapLayers}
      yardExtent={yardExtent}
      selectedFactory={selectedFactory}
      onSelectFactory={onSelectFactory}
      initialOverview={initialOverview}
      factorySummary={(factory) => {
        const overview = overviewByName.get(factory)
        if (!overview) return null
        return (
          <>
            <span
              className={cn(
                'h-1.5 w-1.5 shrink-0 rounded-full',
                overview.sensorFault > 0 ? 'bg-status-degraded' : 'bg-status-healthy'
              )}
              title={
                overview.sensorFault > 0
                  ? t('outfitting.factoryCard.lidarFault', { count: overview.sensorFault })
                  : t('outfitting.factoryCard.lidarOk')
              }
            />
            <span className="ml-auto shrink-0 font-mono text-2xs tabular-nums text-white/55">
              {overview.inProgress}/{overview.blockTotal}{' '}
              {t('outfitting.mapEntry.summary.running')}
            </span>
          </>
        )
      }}
      factoryBody={(factory) => {
        const overview = overviewByName.get(factory)
        if (!overview) return null
        const spec = outfittingFactoryByName(factory)
        return (
          <div className="space-y-2.5 p-2.5">
            <DarkStatusBar overview={overview} />
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-2xs">
              <span
                className={cn(
                  'font-medium',
                  overview.sensorFault > 0 ? 'text-status-degraded' : 'text-white/60'
                )}
              >
                LiDAR {overview.sensorOnline}/{overview.sensorTotal}
                {overview.sensorFault > 0 &&
                  ` · ${t('outfitting.factoryCard.lidarFault', { count: overview.sensorFault })}`}
              </span>
              {overview.lastScanAt && (
                <span className="text-white/45">
                  {t('outfitting.factoryCard.lastScan', { time: overview.lastScanAt })}
                </span>
              )}
            </div>
            {/* 베이 3D 뷰는 베이 단위다 — 공장 카드에는 블록 상세 문만 남긴다 */}
            {spec && (
              <Link
                to={`/indoorshop/zones/outfitting/${spec.id}`}
                className="block rounded-inshop-md border border-white/12 bg-white/[0.05] px-2 py-1.5 text-center text-2xs font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                {t('outfitting.mapEntry.blockDetail')}
              </Link>
            )}
          </div>
        )
      }}
      /* 의장은 블록이 작업 단위 — 베이 카드의 지번 목록 아래에 그 베이의 블록이 선다 */
      bayBody={({ bay }) => {
        const bayBlocks = blocksOfBay(blocks, areasOfBays.get(bay.id), bay.factory)
        /* 베이 번호 — 복합키 `{공장}#{베이}` 의 뒷조각. 3D 장면·실형상 빌더의 연결 키다 */
        const bayNo = bay.id.split('#').pop() ?? bay.label
        const openViewer = () =>
          setViewerTarget({ factory: bay.factory, bayNo, bayLabel: bay.label })
        return (
          <div className="shrink-0 border-t border-white/8 px-3 pb-3 pt-2.5">
            <div className="mb-1.5 flex items-center justify-between px-1">
              <p className="text-2xs font-medium text-white/55">
                {t('outfitting.mapEntry.bay.blocksTitle')}
                <span className="ml-1.5 font-mono text-white/30">{bayBlocks.length}</span>
              </p>
              <button
                type="button"
                onClick={openViewer}
                className="rounded-inshop-md border border-white/12 bg-white/[0.05] px-2 py-1 text-2xs font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                {t('outfitting.mapEntry.viewer.open')}
              </button>
            </div>
            {bayBlocks.length === 0 ? (
              <p className="px-1 py-1.5 text-2xs text-white/40">
                {t('outfitting.mapEntry.bay.noBlocks')}
              </p>
            ) : (
              <ul className="space-y-0.5">
                {bayBlocks.map((block) => (
                  <BayBlockRow key={block.id} block={block} onOpen={openViewer} />
                ))}
              </ul>
            )}
          </div>
        )
      }}
      legend={
        <>
          <span className="text-foreground/45">{t('outfitting.mapEntry.hint3d')}</span>
          <span className="text-foreground/45">{t('outfitting.mapEntry.mockNote')}</span>
        </>
      }
      labels={labels}
      className={className}
    />
    {/* 베이 3D 뷰 — 조립 베이 뷰어(shared)의 의장 소비. 맵 위를 전면으로 덮는다 */}
    {viewerTarget && (
      <Suspense fallback={<SpinnerOverlay className="z-30" />}>
        <OutfittingBayViewer
          factory={viewerTarget.factory}
          bayNo={viewerTarget.bayNo}
          bayLabel={viewerTarget.bayLabel}
          onClose={() => setViewerTarget(null)}
          className="absolute inset-0 z-30"
        />
      </Suspense>
    )}
    </>
  )
}
