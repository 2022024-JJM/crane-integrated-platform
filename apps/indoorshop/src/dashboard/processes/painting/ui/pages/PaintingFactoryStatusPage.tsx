import { useCallback, useDeferredValue, useMemo } from 'react'
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
import { PaintingPerformanceView } from '../PaintingPerformanceView'
import { useWorkspaceTab, useWorkspaceTabCarry } from '../../../../shared/lib/useWorkspaceTab'
import { useBaseDate } from '../../../../shared/lib/useBaseDate'
import { FolderTabs } from '../../../../shared/ui/atoms/FolderTabs'

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
 * 축 탭 — ①현황 / ②블록·실적(옛 '공장 현황', 이름만 바꿨다 — 사용자 확정).
 *
 * 한때 가운데에 **가동 뷰**(3D) 탭이 따로 있었다. 지금 그 3D 는 ①현황의 설비 배치
 * **그 자리에서** 뒤집혀 선다(R45) — 배치도와 3D 가 같은 액자를 쓰므로, 탭을 하나 더
 * 두면 같은 그림으로 가는 문이 둘이 되고 둘 중 어느 쪽이 '지금 보는 것'인지 흐려진다.
 * 그래서 문을 하나로 줄였다: 배치 옆의 손잡이.
 */
type FactoryTab = 'status' | 'blocks'
const FACTORY_TABS: { key: FactoryTab; labelKey: InshopKey }[] = [
  { key: 'status', labelKey: 'painting.factoryStatus.tabStatus' },
  { key: 'blocks', labelKey: 'painting.factoryStatus.tabBlocks' },
]
/** URL 이 실어 온 착지 탭을 이 화면의 축으로 알아보는 목록 (R28 — 조립·의장과 같은 규칙) */
const FACTORY_TAB_KEYS = FACTORY_TABS.map((tab) => tab.key)

/** 맨 위 갈래 — [실적 | 현황] (조립·의장과 같은 틀, 사용자 확정) */
type PageView = 'performance' | 'status'
const PAGE_VIEW_PARAM = 'view'

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
   * 이 공정의 공장들 — 왼쪽 공장 목록이자 대문의 기본값 재료 (R22).
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

  /*
   * 맨 위 갈래 — [실적 | 현황](사용자 확정, 조립·의장과 같은 규칙). 현황은 지금까지의 화면
   * 전체이고 실적은 통합실적의 도장 공정만이다. 축 탭(`?tab=`)과 다른 층이라 `?view=` 에 싣는다.
   *
   * 기본은 **실적**이다. 다만 주소가 축 탭(`?tab=`)을 말하면 현황으로 선다.
   * 야드 맵의 창(임베드)에서는 갈래 탭을 걷고, `?view=performance` 가 오지 않는 한 현황이다.
   */
  const rawPageView = searchParams.get(PAGE_VIEW_PARAM)
  /* 기본은 **현황**이다(사용자 확정 — 탭도 [현황 | 실적] 순). `?view=performance` 일 때만 실적으로 선다 —
     야드 맵 창(임베드)도, 작업 카드의 실적 문도 같은 규칙이다 */
  /* 화면 안의 [현황 | 실적] 탭은 걷었다(사용자 확정) — 갈래는 헤더 메뉴의 드롭다운이 `?view=` 로 고른다 */
  const pageView: PageView = rawPageView === 'performance' ? 'performance' : 'status'

  /* 축 탭 — 지금 서 있는 축은 주소가 말한다 (R28·R30, 조립·의장과 같은 규칙) */
  const { tab: selectedTab, setTab } = useWorkspaceTab(FACTORY_TAB_KEYS, 'status')
  /*
   * 탭 강조는 누르는 즉시(`selectedTab`), 오른쪽 내용은 **한 박자 뒤에** 그린다(사용자 확정: 탭을 먼저
   * 전환하고 그리기). 3D 장면·배치 그림처럼 무거운 내용을 급하지 않은 업데이트로 미뤄, 그 사이에도
   * 탭 줄은 바로 반응한다. 그리는 동안은 이전 탭 내용이 그대로 남아 있다.
   */
  const tab = useDeferredValue(selectedTab)
  /* 공장을 옮겨도 보던 축과 갈래를 들고 간다 — 현황에서 공장을 바꿨는데 실적으로 튕기면 안 된다 */
  const carryAxisTab = useWorkspaceTabCarry()
  const carryTab = useCallback(
    (path: string) => {
      const next = carryAxisTab(path)
      if (pageView !== 'status') return next
      return `${next}${next.includes('?') ? '&' : '?'}${PAGE_VIEW_PARAM}=status`
    },
    [carryAxisTab, pageView]
  )

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

  /*
   * 축 탭 — 공장 목록 **바로 오른쪽**, 탭 내용 칸의 맨 위에 선다(사용자 확정). 폴더 탭이라 고른 탭과
   * 아래 내용 칸이 한 테두리로 이어진다(`FolderTabs` · 보드의 `FolderPanel`).
   * 헤더 줄에는 맨 위 갈래 [현황 | 실적] 만 남는다.
   */
  const axisTabs = (
    <FolderTabs
      ariaLabel={t('painting.factoryStatus.tabAria')}
      items={FACTORY_TABS.map(({ key, labelKey }) => ({ key, label: t(labelKey) }))}
      value={selectedTab}
      onChange={setTab}
    />
  )

  return (
    /*
     * 이 화면은 문서가 아니라 계기판이다 — 조립·의장 워크스페이스와 같은 골격으로,
     * 넓은 화면에서는 뷰포트에 딱 맞춰 고정하고 넘치는 목록은 페이지가 아니라 각 패널이
     * 안에서 흐른다. 예전에는 페이지째 흘러서, 설비 그리드를 훑는 동안 '어느 자리인가'를
     * 답하는 배치 그림이 위로 밀려 사라졌다 — 그러면 그때부터는 그냥 긴 목록이다.
     */
    <div className="flex flex-col gap-4 md:h-full md:min-h-0 md:gap-3">
      <FixedViewport />

      {/*
        머리글 한 줄 — 조립·의장과 같은 문법: 맨 위 갈래 [실적 | 현황] 바로 옆에 축 탭(좌),
        요약(우). 축 탭과 오른쪽은 현황 갈래에만 선다.

        머리의 공장 레일은 없앴다 — 공장을 고르는 자리는 현황의 왼쪽 공장 목록 하나다
        (조립·의장과 같은 배치). 고르는 자리가 둘이면 지금 무엇을 보는지가 흐려진다.
      */}
      {/* 화면 안의 [현황 | 실적] 탭은 걷었다(사용자 확정) — 헤더 메뉴의 드롭다운이 갈래를 고른다.
          탭이 빠진 머리 줄에 오른쪽 요약만 남으면 화면 위가 비어 보여(사용자 지적) 줄째 걷었다 */}

      {pageView === 'status' ? (
        /*
          탭 본문 — **같은 어두운 판** 위에 선다(감사 A10). 왼쪽 공장 목록은 **모든 탭에 남고**,
          탭의 내용은 오른쪽 칸에 선다(조립·의장과 같은 배치 — 사용자 확정). ①현황은 설비 현황
          (버드뷰·그리드 — 보드가 남는 높이를 받고 목록만 그 안에서 흐른다, R29),
          ②블록·실적은 그 자리를 바꿔 끼운다(`mainOverride`).
        */
        <div className="flex min-w-0 flex-col gap-4 md:min-h-0 md:flex-1">
          <PaintingStatusTab
            className="md:min-h-0 md:flex-1"
            selectedFactory={factory}
            onSelectFactory={(next) => {
              const id = paintingFactoryIdOf(next)
              /* 보던 탭을 들고 간다 — 블록·실적을 보다가 공장을 바꾸면 그 공장의 블록·실적으로 */
              if (id) navigate(carryTab(`/indoorshop/zones/painting/${id}`))
            }}
            mainHeader={axisTabs}
            mainOverride={
              tab === 'status' ? undefined : (
              /* ② 블록·실적 — 문서형 카드라 여기만 스스로 흐른다 */
              <div className="flex min-w-0 flex-col gap-4 md:min-h-0 md:flex-1 md:overflow-y-auto md:pr-1">
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

                <div className="flex flex-col gap-4 md:flex-row md:items-start">
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
                  <aside className="rounded-inshop-lg border border-border bg-surface p-3 md:w-72 md:shrink-0">
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
              )
            }
          />
        </div>
      ) : (
        /* 실적 갈래 — 통합실적의 조회 바로 **도장만** 찾는다(사용자 확정) */
        <div
          role="tabpanel"
          aria-label={t('painting.factoryStatus.viewPerformance')}
          className="flex min-w-0 flex-col md:min-h-0 md:flex-1 md:overflow-y-auto md:pr-1"
        >
          <PaintingPerformanceView />
        </div>
      )}
    </div>
  )
}
