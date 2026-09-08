import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from '../../../../shared/lib/i18n/useTranslation'
import { cn } from '../../../../shared/lib/utils'
import { BackLink } from '../../../../shared/ui/atoms/BackLink'
import { FixedViewport } from '../../../../shared/lib/fixed-viewport/FixedViewport'
import {
  LAYOUT_DRAWING_REVISION,
  layoutDrawingOf,
} from '../../../../shared/entities/equipment/layoutDrawings'
import { DrawingViewerModal } from '../../../../shared/features/drawing-viewer'
import type { OutfittingDeviceSummary } from '../../model/equipment'
import { deviceSummaryOf, outfittingFactoryNames } from '../../lib/equipmentStatus'
import { OutfittingStatusTab } from '../OutfittingStatusTab'
import { outfittingFactoryByName } from '../../lib/bayBlocks'

/*
 * 선행의장 **설비(센서) 관제** — 전 공장을 가로지르는 자리.
 *
 * 몸통은 조립·의장·도장 '현황' 탭과 **같은 공용 보드**다(`equipment-status-board`):
 * 왼쪽 공장 목록 · 가운데 설비 배치(버드뷰) · 오른쪽 베이별 설비 그리드, 그리고 둘 사이의
 * 양방향 링킹. 예전에는 이 화면만 자기 목록·자기 카드를 따로 그려서, 같은 설비를 워크스페이스
 * 현황 탭에서 볼 때와 여기서 볼 때 모양·색·읽는 순서가 달랐다 — 화면을 옮길 때마다 눈이
 * 다시 적응해야 했고, 셀을 눌러도 상세가 펴지지 않았다.
 *
 * 이 화면이 따로 지니는 것은 두 가지뿐이다:
 *  ⓐ **전 공장 요약 스트립** — 여기가 존재하는 이유다. 워크스페이스는 한 공장을 보고,
 *     여기는 7개 공장을 한 줄로 가로지른다.
 *  ⓑ **배치 도면** — 도면집에 있는 공장만 문을 낸다(도장 공장은 없다).
 *
 * 고른 공장은 **URL 이 쥔다**(`?shop=`) — 워크스페이스 현황 탭에서 넘어올 때 그 공장이
 * 열려 있어야 하고, 야드·지도의 `?shop=` 규약과도 같은 열쇠다.
 */

/** 전 공장을 가로지르는 한 줄 요약 — 공장 목록 화면의 요약 줄과 같은 문법 */
function OverallSummary({ summaries }: { summaries: OutfittingDeviceSummary[] }) {
  const { t } = useTranslation()
  const total = summaries.reduce((sum, s) => sum + s.total, 0)
  const online = summaries.reduce((sum, s) => sum + s.online, 0)
  const issues = total - online
  const lastHeartbeatAt = summaries
    .map((s) => s.lastHeartbeatAt)
    .filter((time): time is string => Boolean(time))
    .sort()
    .at(-1)

  const items: { label: string; value: string; tone?: string }[] = [
    {
      label: t('outfitting.equipment.summary.factories'),
      value: t('outfitting.equipment.summary.factoriesValue', { count: summaries.length }),
    },
    {
      label: t('outfitting.equipment.summary.devices'),
      value: t('outfitting.equipment.summary.devicesValue', { count: total }),
    },
    {
      label: t('outfitting.equipment.summary.online'),
      value: t('outfitting.equipment.summary.onlineValue', { online, total }),
      tone: issues > 0 ? 'text-status-degraded' : 'text-status-healthy',
    },
    {
      label: t('outfitting.equipment.summary.issues'),
      value:
        issues > 0
          ? t('outfitting.equipment.summary.issuesValue', { count: issues })
          : t('outfitting.equipment.summary.issuesNone'),
      tone: issues > 0 ? 'text-status-degraded' : undefined,
    },
    {
      label: t('outfitting.equipment.summary.lastHeartbeat'),
      value: lastHeartbeatAt ?? t('common.none'),
    },
  ]

  return (
    <dl className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2.5 rounded-inshop-lg border border-border bg-surface px-4 py-2.5">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-2xs font-medium uppercase tracking-[0.08em] text-foreground/50">
            {item.label}
          </dt>
          <dd className={cn('mt-0.5 text-inshop-sm font-semibold', item.tone ?? 'text-foreground')}>
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function OutfittingEquipmentStatusPage() {
  const { t } = useTranslation()
  const factories = useMemo(() => outfittingFactoryNames(), [])
  const summaries = useMemo(() => factories.map(deviceSummaryOf), [factories])

  const [params, setParams] = useSearchParams()
  const fromUrl = params.get('shop')
  const selectedFactory = fromUrl && factories.includes(fromUrl) ? fromUrl : (factories[0] ?? '')
  const setSelectedFactory = (factory: string) => {
    const next = new URLSearchParams(params)
    next.set('shop', factory)
    setParams(next, { replace: true })
  }

  /* 설비 배치 도면 — 의장 7공장은 모두 260903 도면집에 있다(도장 공장만 없다) */
  const [drawingOpen, setDrawingOpen] = useState(false)
  const drawing = selectedFactory ? layoutDrawingOf(selectedFactory) : null
  const anyPlaceholder = summaries.some((summary) => summary.placeholder)
  /* 공장 이름 → 워크스페이스 경로의 공장 id (지도 이름과 id 는 fixture 가 잇는다) */
  const workspaceId = outfittingFactoryByName(selectedFactory)?.id ?? null

  /*
   * 한 계단 위 — 여기로 오는 길은 그 공장의 워크스페이스 현황 탭이다(W8-5 역할 분리:
   * 저기는 그 공장 작업 화면, 여기는 전 공장 관제). 공장 id 를 아는 쪽이 여기라 여기서 낸다.
   */
  const backLink = workspaceId
    ? {
        to: `/indoorshop/zones/outfitting/${workspaceId}`,
        label: selectedFactory,
        title: t('outfitting.workspace.backToFactory', { name: selectedFactory }),
      }
    : {
        to: '/indoorshop/zones/outfitting/list',
        label: t('outfitting.workspace.factoryListLabel'),
        title: t('outfitting.workspace.backToFactoryList'),
      }

  return (
    /* 계기판이라 넓은 화면에서는 뷰포트에 맞춰 고정한다 — 워크스페이스와 같은 골격 */
    <div className="flex flex-col gap-5 xl:h-full xl:min-h-0 xl:gap-3">
      <FixedViewport />

      {/* 머리글 한 줄 — 나가는 문 + 제목(좌) + 안내(우). 워크스페이스와 같은 문법 */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div className="flex min-w-0 items-center gap-2">
          <BackLink to={backLink.to} label={backLink.label} title={backLink.title} />
          <h1 className="min-w-0 truncate text-inshop-lg font-semibold text-foreground">
            {t('outfitting.equipment.title')}
          </h1>
        </div>
        <p className="text-inshop-xs text-foreground/63">{t('outfitting.equipment.subtitle')}</p>
      </div>

      <OverallSummary summaries={summaries} />

      {anyPlaceholder && (
        <p className="shrink-0 rounded-inshop-lg border border-status-degraded/40 bg-status-degraded/5 px-3 py-2 text-inshop-xs leading-relaxed text-foreground/72">
          {t('outfitting.equipment.placeholderNote')}
        </p>
      )}

      {/* 몸통 — 워크스페이스 현황 탭과 같은 판 위의 같은 보드 */}
      <div className="viewport-surface flex min-w-0 flex-col rounded-inshop-lg p-3 xl:min-h-0 xl:flex-1">
        <OutfittingStatusTab
          selectedFactory={selectedFactory}
          onSelectFactory={setSelectedFactory}
          /* 여기서 '전체 설비 관제로'는 자기 자신이다 — 그 자리는 도면이 쓴다 */
          headerExtra={
            drawing ? (
              <button
                type="button"
                onClick={() => setDrawingOpen(true)}
                title={t('drawing.openHint', { factory: drawing.title })}
                className="shrink-0 rounded-inshop-md border border-border px-2 py-0.5 text-2xs text-foreground/68 transition-colors hover:bg-surface-secondary hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {t('drawing.open')}
              </button>
            ) : null
          }
        />
      </div>

      {drawing && drawingOpen && (
        <DrawingViewerModal
          src={drawing.src}
          title={drawing.title}
          subtitle={`${drawing.drawingNo} · ${LAYOUT_DRAWING_REVISION} · p.${drawing.page}`}
          width={drawing.width}
          height={drawing.height}
          onClose={() => setDrawingOpen(false)}
        />
      )}
    </div>
  )
}
