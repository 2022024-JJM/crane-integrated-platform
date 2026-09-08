import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { FixedViewport } from '../../../../shared/lib/fixed-viewport/FixedViewport'
import { useTranslation } from '../../../../shared/lib/i18n/useTranslation'
import { resolveZoneFactoryId } from '../../../../shared/lib/zoneEntryFactory'
import type { InshopKey } from '../../../../shared/lib/i18n/keys'
import { PerformanceLink } from '../../../../shared/entities/vessel'
import { EquipmentSymbolChip } from '../../../../shared/entities/equipment/ui/EquipmentSymbol'
import { cn } from '../../../../shared/lib/utils'
import { STATUS_STYLE } from '../../../../shared/ui/statusPalette'
import type { PaintingStepId } from '../../../../shared/features/performance/model/types'
import {
  paintingCollectionOf,
  paintingStepRollup,
  type PaintingBlockCollection,
} from '../../lib/collection'
import { useFactoryEquipmentStatus } from '../../../../shared/entities/equipment/useEquipmentStatus'
import { paintingInventoryOf } from '../../lib/equipmentInventory'
import {
  paintingFactoryIdOf,
  paintingFactoryNameOf,
  PAINTING_FACTORY_ROUTE_IDS,
} from '../../lib/factoryRoutes'
import { PaintingStatusTab } from '../PaintingStatusTab'
import { Spinner } from '../../../../shared/ui/atoms/Spinner'
import { useBaseDate } from '../../../../shared/lib/useBaseDate'

/*
 * 선행도장 **공장 현황** — 맵 진입의 공장 카드에서 들어오는 화면.
 *
 * 조립이 `FactoryCard → AssemblyWorkspace`, 의장이 `OutfittingFactoryCard →
 * OutfittingWorkspace` 로 나가는 것과 같은 이동 문법이다. 도장에는 그 문이 없어서
 * 지도에서 공장을 눌러도 카드 안에서 끝났다 — 이 화면이 그 끝을 연다.
 *
 * 세 가지만 말한다:
 *  · **스텝 진행** — S/P → T/UP → FINAL 각각을 계획한 블록 중 몇이 통과했는가.
 *    분모가 스텝 수가 아니라 **그 스텝을 계획한 블록 수**인 이유는 스텝 구성이 블록마다
 *    다르기 때문이다(존재 기반 — 없는 스텝을 미착수로 세지 않는다).
 *  · **블록 목록(BTS 귀속)** — 지금 이 도장공장에 서 있는 블록. 각 줄에서 통합실적의
 *    그 블록 절점 실적으로 바로 건너간다(로스터가 한 우주라 같은 번호로 조회된다).
 *  · **설비 요약** — SCADA 자산(제습기·가스히터)과 이관 설비 대수·이상 수.
 *
 * 수치는 전부 `lib/collection`·`lib/equipmentInventory` 가 접어 준 것이다 — 이 화면은
 * 산식을 갖지 않는다(맵 진입 우측 패널과 같은 값을 읽는다).
 */

/*
 * 축 탭 — 조립·의장 워크스페이스와 같은 세 칸이다(P4).
 *
 * 가운데 칸이 **가동 뷰**다 (R24). 조립·의장이 그 자리에 3D 점군을 세우는 것과 같은
 * 축이며, 도장에서는 그릴 물체가 없으므로 대신 **설비가 만드는 공기**를 그린다(P5).
 * 세 공정의 가운데 칸이 모두 "저 자리를 자세히 본다"는 같은 질문에 답하는 셈이다.
 *
 * 뷰어는 three 를 끌고 오므로 **탭을 열 때 받는다** — 처음 서는 화면은 ①현황이고,
 * 거기만 보는 사람에게까지 3D 의 무게를 지우지 않는다(모듈 lazy 규칙과 같은 이유).
 */
const PaintingAirTab = lazy(() =>
  import('../PaintingAirTab').then((m) => ({ default: m.PaintingAirTab }))
)

type FactoryTab = 'status' | 'view' | 'factory'
const FACTORY_TABS: { key: FactoryTab; labelKey: InshopKey }[] = [
  { key: 'status', labelKey: 'painting.factoryStatus.tabStatus' },
  { key: 'view', labelKey: 'painting.factoryStatus.tabView' },
  { key: 'factory', labelKey: 'painting.factoryStatus.tabFactory' },
]

const STEP_NAME_KEY: Record<PaintingStepId, InshopKey> = {
  SP: 'performance.pnt.step.SP',
  TUP: 'performance.pnt.step.TUP',
  FINAL: 'performance.pnt.step.FINAL',
}

const PHASE_KEY = {
  beforeIn: 'performance.pnt.phase.beforeIn',
  inShop: 'performance.pnt.phase.inShop',
  shippedOut: 'performance.pnt.phase.shippedOut',
} as const

/*
 * 국면 잉크 — 색은 상태 팔레트가 준다(감사 P4).
 * '도장중'이 강조색이라 3m 밖에서 오류로 읽혔다. 도는 것은 파랑, 다 나간 것은 초록.
 */
const PHASE_INK = {
  beforeIn: STATUS_STYLE.idle.ink,
  inShop: STATUS_STYLE.inProgress.ink,
  shippedOut: STATUS_STYLE.done.ink,
} as const

function NotFoundNotice() {
  const { t } = useTranslation()
  return (
    <div className="space-y-4">
      <h1 className="text-inshop-xl font-semibold text-foreground">
        {t('painting.factoryStatus.notFound')}
      </h1>
      <Link
        to="/indoorshop/zones/painting"
        className="inline-block rounded-inshop-md bg-accent px-4 py-2 text-inshop-sm font-medium text-on-accent transition-colors hover:bg-accent/80"
      >
        {t('painting.factoryStatus.backToZone')}
      </Link>
    </div>
  )
}

/** 블록 한 줄 — 번호 · 자리 · 국면 · 진행 스텝 · 일일공정률 · 절점 실적으로 나가는 문 */
function BlockRow({ block }: { block: PaintingBlockCollection }) {
  const { t } = useTranslation()
  const { summary, activeStep } = block
  return (
    <li className="flex items-center gap-3 rounded-inshop-md px-2 py-1.5 hover:bg-surface-secondary">
      <span className="w-24 shrink-0 truncate font-mono text-inshop-xs text-foreground">{block.key}</span>
      <span className="w-12 shrink-0 font-mono text-2xs text-foreground/50">
        {block.mapBay ?? '—'}
      </span>
      <span className={cn('w-16 shrink-0 text-2xs font-medium', PHASE_INK[summary.phase])}>
        {t(PHASE_KEY[summary.phase])}
      </span>
      <span className="w-14 shrink-0 font-mono text-2xs text-foreground/68">
        {activeStep ? t(STEP_NAME_KEY[activeStep.step]) : '—'}
      </span>
      <div className="min-w-0 flex-1">
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-secondary">
          <span
            className={cn(
              'block h-full rounded-full',
              activeStep ? STATUS_STYLE.inProgress.fill : STATUS_STYLE.done.fill
            )}
            style={{
              width: `${
                summary.steps.length === 0
                  ? 0
                  : Math.round((summary.doneSteps / summary.steps.length) * 100)
              }%`,
            }}
          />
        </div>
      </div>
      <span className="w-11 shrink-0 text-right font-mono text-2xs tabular-nums text-foreground/68">
        {summary.doneSteps}/{summary.steps.length}
      </span>
      <span className="w-10 shrink-0 text-right font-mono text-2xs tabular-nums text-foreground/45">
        {activeStep ? `${Math.round(activeStep.progressPct)}%` : '—'}
      </span>
      <PerformanceLink projNo={block.projNo} blockNo={block.blockNo} />
    </li>
  )
}

export function PaintingFactoryStatusPage() {
  const { t } = useTranslation()
  const { factoryId: routeFactoryId } = useParams<{ factoryId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  /*
   * 이 공정의 공장들 — 좌측(머리) 레일이자 대문의 기본값 재료 (R22).
   * 맵 진입 화면을 걷으면서 `/indoorshop/zones/painting` 이 이 화면의 대문이 됐다.
   */
  const factories = useMemo(
    () =>
      Object.entries(PAINTING_FACTORY_ROUTE_IDS).map(([id, name]) => ({ id, name })),
    []
  )
  const factoryId = resolveZoneFactoryId(factories, {
    factoryId: routeFactoryId,
    search: searchParams,
  })
  const factory = factoryId ? paintingFactoryNameOf(factoryId) : null

  /* 공장을 옮기면 기본(현황)으로 돌아온다 — 탭은 그 공장의 것이다 */
  const [tab, setTab] = useState<FactoryTab>('status')
  useEffect(() => {
    setTab('status')
  }, [factoryId])

  /* 이관 설비 상태는 공용 설비 계약에서 구독한다 — 공장을 못 찾은 경우에도 훅은 부른다
     (조건부 훅 금지). 빈 문자열이면 빈 스냅샷이 온다. */
  const { snapshot } = useFactoryEquipmentStatus(factory ?? '')
  /* 기준일 — `?date=` 를 따라온다 */
  const { baseDate } = useBaseDate()

  const collection = useMemo(
    () => (factory ? paintingCollectionOf(factory, baseDate) : null),
    [factory, baseDate]
  )
  const rollup = useMemo(() => (collection ? paintingStepRollup(collection) : []), [collection])
  const inventory = useMemo(
    () => (factory ? paintingInventoryOf(factory, snapshot) : null),
    [factory, snapshot]
  )

  if (!factory || !collection || !inventory) return <NotFoundNotice />

  return (
    /*
     * 이 화면은 문서가 아니라 계기판이다 — 조립·의장 워크스페이스와 같은 골격으로,
     * 넓은 화면에서는 뷰포트에 딱 맞춰 고정하고 넘치는 목록은 페이지가 아니라 각 패널이
     * 안에서 흐른다. 예전에는 페이지째 흘러서, 설비 그리드를 훑는 동안 '어느 자리인가'를
     * 답하는 배치 그림이 위로 밀려 사라졌다 — 그러면 그때부터는 그냥 긴 목록이다.
     */
    <div className="flex flex-col gap-4 xl:h-full xl:min-h-0 xl:gap-3">
      <FixedViewport />

      <div className="shrink-0">
        {/* 공장 레일 — 이 공정의 공장을 여기서 갈아탄다 (R22: 맵 진입 화면을 대신한다) */}
        <nav aria-label={t('painting.factoryStatus.factoryRail')} className="flex flex-wrap gap-1">
          {factories.map((entry) => (
            <Link
              key={entry.id}
              to={`/indoorshop/zones/painting/${entry.id}`}
              aria-current={entry.id === factoryId ? 'page' : undefined}
              className={cn(
                'rounded-inshop-md px-2.5 py-1 text-inshop-xs font-medium transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                entry.id === factoryId
                  ? 'bg-accent text-on-accent'
                  : 'text-foreground/60 hover:bg-surface-secondary hover:text-foreground'
              )}
            >
              {entry.name}
            </Link>
          ))}
        </nav>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-inshop-xl font-semibold text-foreground">{factory}</h1>
          <span className="text-inshop-xs text-foreground/63">
            {t('painting.factoryStatus.blockSummary', {
              total: collection.blockCount,
              inProgress: collection.inProgressBlocks,
            })}
          </span>
          <span className="font-mono text-inshop-xs text-foreground/55">
            {t('painting.factoryStatus.stepSummary', {
              done: collection.stepsDone,
              total: collection.stepsTotal,
            })}
          </span>
        </div>
        <p className="mt-1 text-2xs text-foreground/45">
          {collection.progressAsOf
            ? t('performance.pnt.dailyRateAsOf', { date: collection.progressAsOf })
            : t('performance.pnt.dailyRateNone')}
        </p>
      </div>

      {/* 축 탭 — ①현황 / ②가동 뷰(자리) / ③공장 현황. 조립·의장과 같은 프레임 */}
      <div
        role="tablist"
        aria-label={t('painting.factoryStatus.tabAria')}
        /* 붙임(sticky)은 페이지가 흐르던 시절의 것이다 — 이제 흐르는 것은 아래 판 안쪽뿐이다 */
        className="viewport-surface flex w-fit shrink-0 items-center gap-1 rounded-inshop-lg border border-border bg-surface-secondary p-1"
      >
        {FACTORY_TABS.map(({ key, labelKey }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              'rounded-inshop-md px-3 py-1 text-inshop-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              tab === key
                ? 'bg-accent text-on-accent shadow-sm'
                : 'text-foreground/60 hover:bg-surface-secondary hover:text-foreground'
            )}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>

      {/*
        탭 본문 — ①현황·②가동 뷰·③공장 현황이 **같은 어두운 판** 위에 선다(감사 A10).
        3D(가동 뷰)만 어둡고 나머지가 흰 종이면 탭을 옮길 때마다 같은 화면 안에서 명암이
        뒤집힌다. 조립·의장 워크스페이스가 쓰는 판을 그대로 쓴다 — 토큰만 바꾸는 판이라
        아래 컴포넌트의 마크업·레이아웃은 그대로다.
      */}
      <div className="viewport-surface flex min-w-0 flex-col gap-4 rounded-inshop-lg p-3 xl:min-h-0 xl:flex-1">
      {tab === 'status' ? (
        /* ① 현황 — 공장 목록 + 버드뷰 + 베이별 설비 그리드 (공용 보드).
           보드가 남는 높이를 통째로 받고 **목록만 그 안에서 흐른다** — 배치 그림은
           스크롤을 굴려도 제자리에 남아야 두 층이 함께 일한다(R29). */
        <PaintingStatusTab
          className="xl:min-h-0 xl:flex-1"
          selectedFactory={factory}
          onSelectFactory={(next) => {
            const id = paintingFactoryIdOf(next)
            if (id) navigate(`/indoorshop/zones/painting/${id}`)
          }}
        />
      ) : tab === 'view' ? (
        /* ② 가동 뷰 — 이 공장 베이별 대기(히터·제습기가 만드는 공기)를 3D 로 */
        <Suspense
          fallback={
            <div className="flex min-h-[40vh] items-center justify-center rounded-inshop-lg border border-dashed border-border">
              <Spinner size={24} label={t('common.loading')} className="text-accent" />
            </div>
          }
        >
          <PaintingAirTab factory={factory} />
        </Suspense>
      ) : (
        /* ③ 공장 현황 — 문서형 카드라 여기만 스스로 흐른다 */
        <div className="flex min-w-0 flex-col gap-4 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-1">
          {/* ── 스텝 진행 — 절점 축. 계획한 블록이 없는 스텝은 자리를 비우고 그렇다고 말한다 ── */}
          <section className="rounded-inshop-lg border border-border bg-surface p-3">
            <h2 className="mb-2 text-inshop-sm font-semibold text-foreground">
              {t('painting.factoryStatus.stepProgressTitle')}
            </h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {rollup.map((row) => (
                <div key={row.step} className="rounded-inshop-md bg-surface-secondary/40 p-3">
                  {/* 이 카드가 답하는 것은 '몇 개 통과했나' 하나다 — 그 수를 스텝 이름보다
                      크게 세운다(3m 판독). 분모는 같은 줄에 작게 붙여 분자와 가르고,
                      스텝 이름은 그 위에 라벨 크기로 물러선다. 자리는 그대로다. */}
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-2xs font-semibold uppercase tracking-[0.06em] text-foreground/55">
                      {t(STEP_NAME_KEY[row.step])}
                    </span>
                    <span className="font-mono text-inshop-2xl font-semibold tabular-nums text-foreground">
                      {row.done}
                      <span className="text-inshop-sm font-normal text-foreground/45">/{row.blocks}</span>
                    </span>
                  </div>
                  {row.blocks === 0 ? (
                    <p className="mt-1.5 text-2xs text-foreground/45">
                      {t('painting.factoryStatus.stepNotPlanned')}
                    </p>
                  ) : (
                    <>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-secondary">
                        <span
                          className="block h-full rounded-full bg-status-healthy"
                          style={{ width: `${Math.round((row.done / row.blocks) * 100)}%` }}
                        />
                      </div>
                      <p className="mt-1.5 text-2xs text-foreground/55">
                        {t('painting.factoryStatus.stepInProgress', { count: row.inProgress })}
                        {row.progressPct != null && (
                          <span className="ml-1.5 font-mono tabular-nums">{row.progressPct}%</span>
                        )}
                      </p>
                    </>
                  )}
                </div>
              ))}
            </div>
          </section>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
            {/* ── 블록 목록 (BTS 귀속) ── */}
            <section className="min-w-0 flex-1 rounded-inshop-lg border border-border bg-surface p-3">
              <h2 className="mb-2 text-inshop-sm font-semibold text-foreground">
                {t('painting.factoryStatus.blockListTitle')}
              </h2>
              {collection.blocks.length === 0 ? (
                <p className="px-2 py-6 text-center text-inshop-sm text-foreground/45">
                  {t('painting.factoryStatus.noBlocks')}
                </p>
              ) : (
                <ul>
                  {collection.blocks.map((block) => (
                    <BlockRow key={block.key} block={block} />
                  ))}
                </ul>
              )}
              <p className="mt-2 px-2 text-2xs leading-relaxed text-foreground/40">
                {t('painting.factoryStatus.btsNote')}
              </p>
            </section>

            {/* ── 설비 요약 — 지도의 설비 상태 단과 같은 인벤토리 ── */}
            <aside className="rounded-inshop-lg border border-border bg-surface p-3 lg:w-72 lg:shrink-0">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-inshop-sm font-semibold text-foreground">
                  {t('painting.factoryStatus.equipmentTitle')}
                </h2>
                <span className="font-mono text-inshop-xs tabular-nums text-foreground/68">
                  {inventory.scadaTotal + inventory.transferredTotal}
                </span>
              </div>
              <ul className="space-y-1">
                {[...inventory.scada, ...inventory.transferred].map((row) => (
                  <li key={row.typeId} className="flex items-center gap-2 px-1 py-1 text-inshop-xs">
                    <EquipmentSymbolChip typeId={row.typeId} size={15} />
                    <span className="min-w-0 flex-1 truncate text-foreground/68">{row.name}</span>
                    <span className="font-mono tabular-nums text-foreground">{row.count}</span>
                  </li>
                ))}
              </ul>
              {inventory.transferredTotal === 0 && (
                <p className="mt-1.5 px-1 text-2xs leading-relaxed text-foreground/45">
                  {t('painting.mapEntry.equipment.noTransferred')}
                </p>
              )}
              {inventory.transferredIssues > 0 && (
                <p className="mt-1.5 px-1 text-2xs font-medium text-status-degraded">
                  {t('painting.mapEntry.equipment.issueCount', { count: inventory.transferredIssues })}
                </p>
              )}
            </aside>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
