import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from '../../../../shared/lib/i18n/useTranslation'
import type { InshopKey } from '../../../../shared/lib/i18n/keys'
import { PerformanceLink } from '../../../../shared/entities/vessel'
import { EquipmentSymbolChip } from '../../../../shared/entities/equipment/ui/EquipmentSymbol'
import { cn } from '../../../../shared/lib/utils'
import type { PaintingStepId } from '../../../../shared/features/performance/model/types'
import {
  paintingCollectionOf,
  paintingStepRollup,
  todayString,
  type PaintingBlockCollection,
} from '../../lib/collection'
import { useFactoryEquipmentStatus } from '../../../../shared/entities/equipment/useEquipmentStatus'
import { paintingInventoryOf } from '../../lib/equipmentInventory'
import { paintingFactoryNameOf, paintingMapPath } from '../../lib/factoryRoutes'

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

const PHASE_INK = {
  beforeIn: 'text-foreground/45',
  inShop: 'text-accent',
  shippedOut: 'text-status-healthy',
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
        {t('painting.factoryStatus.backToMap')}
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
              activeStep ? 'bg-accent' : 'bg-status-healthy'
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
  const { factoryId } = useParams<{ factoryId: string }>()
  const factory = factoryId ? paintingFactoryNameOf(factoryId) : null

  /* 이관 설비 상태는 공용 설비 계약에서 구독한다 — 공장을 못 찾은 경우에도 훅은 부른다
     (조건부 훅 금지). 빈 문자열이면 빈 스냅샷이 온다. */
  const { snapshot } = useFactoryEquipmentStatus(factory ?? '')
  const baseDate = useMemo(() => todayString(), [])

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
    <div className="space-y-4">
      <div>
        <Link
          to={paintingMapPath(factory)}
          className="text-inshop-xs text-foreground/55 transition-colors hover:text-accent"
        >
          ← {t('painting.factoryStatus.backToMap')}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
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

      {/* ── 스텝 진행 — 절점 축. 계획한 블록이 없는 스텝은 자리를 비우고 그렇다고 말한다 ── */}
      <section className="rounded-inshop-lg border border-border bg-surface p-3">
        <h2 className="mb-2 text-inshop-sm font-semibold text-foreground">
          {t('painting.factoryStatus.stepProgressTitle')}
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {rollup.map((row) => (
            <div key={row.step} className="rounded-inshop-md bg-surface-secondary/40 p-3">
              <div className="flex items-center justify-between">
                <span className="text-inshop-xs font-semibold text-foreground">
                  {t(STEP_NAME_KEY[row.step])}
                </span>
                <span className="font-mono text-inshop-xs tabular-nums text-foreground/68">
                  {row.done}/{row.blocks}
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
          <Link
            to={paintingMapPath(factory)}
            className="mt-2 flex items-center justify-between rounded-inshop-md border border-border px-2 py-1.5 text-2xs font-medium text-foreground/75 transition-colors hover:border-accent/50 hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <span>{t('painting.factoryStatus.openScada')}</span>
            <span aria-hidden="true">→</span>
          </Link>
        </aside>
      </div>
    </div>
  )
}
