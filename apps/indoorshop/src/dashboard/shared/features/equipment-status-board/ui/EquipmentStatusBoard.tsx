import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '../../../lib/i18n/useTranslation'
import { cn } from '../../../lib/utils'
import { StatusChip } from '../../../ui/atoms/StatusChip'
import { EquipmentGrid, isIssueCell, type EquipmentCell } from '../../equipment-grid'
import {
  EquipmentBirdview,
  type BirdviewBay,
  type BirdviewPoint,
} from '../../equipment-birdview'

/*
 * ── 공정존 '현황' 탭의 몸통 — 세 공정이 그대로 쓴다 ──
 *
 * 셋을 한 화면에 세운다:
 *  ⓐ 왼쪽 **공장 목록** — 어느 공장을 보는가(요약 + 점검 필요 뱃지). 공장 탭바를 따로
 *    두지 않는다: 고르는 자리가 둘이면 지금 무엇을 보는지가 흐려진다.
 *  ⓑ 위 **버드뷰** — 설비가 **어느 자리**에 있는가. 목록이 답하지 못하는 유일한 질문이다.
 *  ⓒ 아래 **설비 그리드** — 무엇이 몇 대고 어느 것이 이상인가(W7-9 그리드 그대로).
 *
 * 위쪽 셋(요약 스트립·버드뷰)은 **붙어 있고**, 아래 그리드만 흐른다(R29). 스크롤을 내려
 * 5BAY 를 보는 동안에도 "어디" 를 답하는 그림이 화면에 남아 있어야 두 층이 함께 일한다 —
 * 버드뷰가 위로 밀려 사라지면 그때부터는 그냥 긴 목록이다. 화면이 낮으면 그림이 목록을
 * 다 덮으므로 접는 문을 함께 둔다.
 *
 * 그리고 ⓓ **양방향 링킹**. 두 층이 같은 설비를 가리키지 않으면 나란히 둔 뜻이 없다:
 *  · 버드뷰 심볼 hover/click → 그 셀이 밝아지고 시야로 들어온다
 *  · 그리드 셀 선택 → 버드뷰의 그 점이 링을 얻는다
 *  · 버드뷰 베이 클릭 → 그리드가 그 베이 구획으로 점프한다
 *
 * 이 층은 **공정을 모른다.** 공장 목록·베이 외곽·설비 점·셀은 전부 밖에서 온다.
 */

/** 왼쪽 목록에 서는 공장 한 줄 */
export interface BoardFactory {
  /** 공장 이름 (선택 키) */
  name: string
  /** 설비 총 대수 */
  total: number
  /** 점검 필요 대수 */
  issues: number
  /** 우측에 덧붙는 한 마디 (마지막 수신 등) — 없으면 생략 */
  note?: string
}

/** 그리드 구획 하나 — 베이별 묶음 */
export interface BoardGroup {
  /** 구획 키 — 버드뷰 베이의 `groupKey` 와 같은 값 */
  key: string
  title: string
  cells: readonly EquipmentCell[]
}

export interface EquipmentStatusBoardProps {
  factories: readonly BoardFactory[]
  selectedFactory: string
  onSelectFactory: (factory: string) => void
  bays: readonly BirdviewBay[]
  points: readonly BirdviewPoint[]
  groups: readonly BoardGroup[]
  /** 공장 목록 위에 덧붙는 것 (도면 보기 등) */
  factoryAside?: React.ReactNode
  /** 버드뷰 위 오른쪽 (링크 등) */
  headerExtra?: React.ReactNode
  /**
   * 밖에서 데려온 초점 설비 — 알람 딥링크(`?equip=`)의 당사자.
   * 그 칸을 골라 둔 상태로 세우고 시야로 데려온다(`EquipmentGrid` 의 링킹과 같은 길).
   */
  focusEquipmentId?: string | null
  className?: string
}

export function EquipmentStatusBoard({
  factories,
  selectedFactory,
  onSelectFactory,
  bays,
  points,
  groups,
  factoryAside,
  headerExtra,
  focusEquipmentId = null,
  className,
}: EquipmentStatusBoardProps) {
  const { t } = useTranslation()
  /* 선택·호버는 **여기**가 쥔다 — 두 층이 같은 값을 봐야 링킹이 성립한다 */
  const [selectedId, setSelectedId] = useState<string | null>(focusEquipmentId)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [activeGroup, setActiveGroup] = useState<string | null>(null)
  /* 배치 그림 접기 — 낮은 화면에서 그림이 목록을 다 덮을 때의 탈출구(R29) */
  const [birdviewOpen, setBirdviewOpen] = useState(true)
  /*
   * 붙어 있는 머리의 **실제 높이**를 CSS 변수로 내린다.
   *
   * 그리드가 선택된 셀을 시야로 데려올 때(`scrollIntoView`), 머리가 같은 스크롤 상자
   * 위에 떠 있으므로 셀이 머리 **뒤로** 숨는다. 고정값으로 여백을 주면 배치를 접었을 때
   * 필요 이상으로 밀리므로, 높이를 재서 그만큼만 비켜 준다.
   */
  const headRef = useRef<HTMLDivElement | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const head = headRef.current
    const root = rootRef.current
    if (!head || !root) return
    const sync = () => root.style.setProperty('--board-head', `${head.offsetHeight + 8}px`)
    sync()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(sync)
    observer.observe(head)
    return () => observer.disconnect()
  }, [birdviewOpen])

  /* 공장이 바뀌면 가리키던 것을 놓는다 — 다른 공장의 설비를 계속 가리킬 수는 없다.
     밖에서 초점이 들어와 있으면 그것을 가리킨 채로 선다(알람 딥링크의 당사자) */
  useEffect(() => {
    setSelectedId(focusEquipmentId)
    setHoveredId(null)
    setActiveGroup(null)
  }, [selectedFactory, focusEquipmentId])

  const linkedId = selectedId ?? hoveredId

  /* 요약 스트립 — 아래에 흐르는 것의 합계다. 그리드가 스크롤로 사라져도 이 줄은 남는다 */
  const cells = groups.flatMap((group) => group.cells)
  const issues = cells.filter(isIssueCell).length

  return (
    <div
      ref={rootRef}
      className={cn('grid gap-4 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]', className)}
    >
      {/* ⓐ 공장 목록 — 접힌 줄에 대수·이상이 이미 보여 열지 않고도 훑는다 */}
      <div className="flex flex-col gap-2 self-start lg:sticky lg:top-0">
        <ul className="flex flex-col gap-1.5" aria-label={t('equipmentBoard.factories')}>
          {factories.map((factory) => {
            const selected = factory.name === selectedFactory
            return (
              <li key={factory.name}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onSelectFactory(factory.name)}
                  className={cn(
                    'w-full rounded-inshop-lg border px-3 py-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                    selected
                      ? 'border-accent bg-accent/5'
                      : 'border-border bg-surface hover:bg-surface-secondary'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className={cn(
                        'h-1.5 w-1.5 shrink-0 rounded-full',
                        factory.issues > 0 ? 'bg-status-degraded' : 'bg-status-healthy'
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate text-inshop-sm font-medium text-foreground">
                      {factory.name}
                    </span>
                    <StatusChip
                      tone={factory.issues > 0 ? 'warning' : 'good'}
                      label={`${factory.total - factory.issues}/${factory.total}`}
                      className="shrink-0 px-1.5 py-0.5 text-2xs"
                    />
                  </div>
                  <p className="mt-0.5 flex items-center gap-2 pl-3.5 text-2xs text-foreground/55">
                    {factory.issues > 0 ? (
                      <span className="text-status-degraded">
                        {t('equipmentBoard.needsCheck', { count: factory.issues })}
                      </span>
                    ) : (
                      <span>{t('equipmentBoard.allHealthy')}</span>
                    )}
                    {factory.note && <span className="truncate">{factory.note}</span>}
                  </p>
                </button>
              </li>
            )
          })}
        </ul>
        {factoryAside}
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        {/*
          ⓑ 요약 스트립 + 버드뷰 — **여기까지가 붙어 있는 자리**다(R29).
          바탕을 깔아 두는 이유는 아래 그리드가 이 밑으로 흘러 지나가기 때문이다 —
          투명하면 글자 위로 글자가 지나간다.
        */}
        <div
          ref={headRef}
          data-sticky-head="true"
          className="sticky top-0 z-20 -mx-1 flex flex-col gap-2 bg-surface-secondary/95 px-1 pb-2 pt-1 backdrop-blur-sm"
        >
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-inshop-lg border border-border bg-surface px-3 py-1.5">
            <span className="text-inshop-sm font-semibold text-foreground">{selectedFactory}</span>
            <SummaryStat label={t('equipmentBoard.summaryTotal')} value={String(cells.length)} />
            <SummaryStat
              label={t('equipmentBoard.summaryIssues')}
              value={String(issues)}
              tone={issues > 0 ? 'text-status-degraded' : 'text-status-healthy'}
            />
            <SummaryStat label={t('equipmentBoard.summaryBays')} value={String(groups.length)} />
            <div className="ml-auto flex items-center gap-2">
              {headerExtra}
              <button
                type="button"
                aria-expanded={birdviewOpen}
                onClick={() => setBirdviewOpen((open) => !open)}
                className="shrink-0 rounded-inshop-md border border-border px-2 py-0.5 text-2xs text-foreground/68 transition-colors hover:bg-surface-secondary hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {birdviewOpen
                  ? t('equipmentBoard.collapseBirdview')
                  : t('equipmentBoard.expandBirdview')}
              </button>
            </div>
          </div>

          {birdviewOpen && (
            <section className="rounded-inshop-lg border border-border bg-surface p-2">
              <div className="mb-1 flex items-center justify-between gap-2 px-1">
                <h3 className="text-inshop-xs font-semibold text-foreground">
                  {t('equipmentBoard.birdviewTitle')}
                </h3>
                <span className="text-2xs text-foreground/45">
                  {t('equipmentBoard.birdviewHint')}
                </span>
              </div>
              <EquipmentBirdview
                bays={bays}
                points={points}
                selectedId={linkedId}
                onSelectPoint={setSelectedId}
                hoveredId={hoveredId}
                onHoverPoint={setHoveredId}
                onSelectBay={setActiveGroup}
                activeGroupKey={activeGroup}
                emptyLabel={t('equipmentBoard.birdviewEmpty')}
                className="h-[24vh] max-h-[260px] min-h-[150px] w-full"
              />
            </section>
          )}
        </div>

        {/* ⓒ 베이별 그리드 — 버드뷰에서 고른 베이가 있으면 그 구획을 먼저 세운다 */}
        <div className="flex min-w-0 flex-col gap-3">
          {groups.length === 0 ? (
            <p className="rounded-inshop-lg border border-dashed border-border px-3 py-8 text-center text-inshop-sm text-foreground/55">
              {t('equipmentBoard.empty')}
            </p>
          ) : (
            orderGroups(groups, activeGroup).map((group) => (
              <section
                key={group.key}
                data-group={group.key}
                className={cn(
                  'rounded-inshop-lg border bg-surface p-2',
                  activeGroup === group.key ? 'border-accent' : 'border-border'
                )}
              >
                <div className="mb-1 flex items-center gap-2 px-1">
                  <h4 className="text-inshop-xs font-semibold text-foreground">{group.title}</h4>
                  <span className="text-2xs text-foreground/45">{group.cells.length}</span>
                </div>
                <EquipmentGrid
                  cells={group.cells}
                  showControls={false}
                  selectedId={linkedId}
                  onSelect={setSelectedId}
                />
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

/** 요약 스트립의 한 칸 — 라벨은 작게, 수치는 등폭으로 */
function SummaryStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-2xs text-foreground/50">{label}</span>
      <span className={cn('font-mono text-inshop-sm font-semibold tabular-nums', tone ?? 'text-foreground')}>
        {value}
      </span>
    </span>
  )
}

/**
 * 버드뷰에서 베이를 누르면 그 구획을 **맨 위로** 올린다.
 *
 * 스크롤로 데려가는 대신 순서를 바꾸는 이유는, 베이 클릭의 뜻이 "저기를 보겠다" 이지
 * "저기까지 스크롤하겠다" 가 아니기 때문이다. 나머지 순서는 그대로라 자리를 잃지 않는다.
 */
export function orderGroups(
  groups: readonly BoardGroup[],
  activeKey: string | null
): BoardGroup[] {
  if (!activeKey) return [...groups]
  const active = groups.filter((group) => group.key === activeKey)
  return [...active, ...groups.filter((group) => group.key !== activeKey)]
}
