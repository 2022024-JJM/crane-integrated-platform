import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useTranslation } from '../../../lib/i18n/useTranslation'
import { colorOfProcess } from '../../../entities/yard-parcels'
import { cn } from '../../../lib/utils'
import { ChevronRightIcon } from '../../../ui/icons'
import { groupFactoriesByProcess, type FactoryNavItem } from '../lib/factoryNav'
import { FaultMark } from './FaultMark'

/*
 * 야드 맵 왼쪽 카드의 앞 두 단계 — **공정 목록**과 **그 공정의 공장 목록**.
 *
 * 카드는 하나다 — 공정 목록 › 공장 목록 › 공장 › BAY 가 같은 자리에서 내용만 갈아 끼운다
 * (사용자 확정: 공정을 누르면 아래로 펼치지 않고 카드가 바뀐다). 공정을 누르면 지도도 그
 * 공정을 비추고(주소 `?process=`), 공장 줄을 누르면 지도에서 그 공장을 누른 것과 같다.
 * 공장 줄에 손을 얹으면 지도에서 그 공장을 미리 비춘다.
 *
 * 줄마다 **진행 작업 수**를 단다 — 공정 줄은 그 공정 공장들의 합, 공장 줄은 공장 카드
 * '진행 작업' 합과 같은 값이다.
 */
export function FactoryNavPanel({
  factories,
  process,
  trail,
  workCounts,
  faultCounts,
  onSelectProcess,
  onSelectFactory,
  onHoverFactory,
  className,
}: {
  factories: readonly FactoryNavItem[]
  /** 고른 공정 — 없으면 공정 목록, 있으면 그 공정의 공장 목록 */
  process: string | null
  /** 공장 목록 단계의 머리 경로(`< 공장 목록`) — 공정 목록 단계에서는 쓰지 않는다 */
  trail?: ReactNode
  /**
   * 공장 → 진행 작업 수(공장 카드 '진행 작업' 합과 같은 값). 아직 못 읽었으면 주지 않는다 —
   * 그동안은 수를 비워 둔다(0 으로 그리면 "작업 없음"으로 읽힌다). 베이 매핑이 없는 공장은
   * 키가 없고, 그 줄에는 수를 적지 않는다.
   */
  workCounts?: ReadonlyMap<string, number>
  /** 공장 → 점검 필요 BAY 수. 있으면 공장 줄에 ⚠ 아이콘(공정 목록에는 달지 않는다 — 사용자 확정) */
  faultCounts?: ReadonlyMap<string, number>
  /** 공정 줄 클릭 — 카드가 그 공정의 공장 목록으로 바뀌고 지도가 그 공정을 비춘다 */
  onSelectProcess: (process: string) => void
  /** 공장 줄 클릭 — 지도의 공장 클릭과 같은 동작 */
  onSelectFactory: (name: string) => void
  onHoverFactory: (name: string | null) => void
  className?: string
}) {
  const { t } = useTranslation()
  const groups = useMemo(() => groupFactoriesByProcess(factories), [factories])
  const group = process ? (groups.find((g) => g.process === process) ?? null) : null

  /*
   * 지도 미리 비춤이 **남지 않게** — 줄마다 떠날 때 걷고, 카드가 바뀌어 목록이 내려갈 때도 걷는다.
   * 떠날 때는 한 박자 늦게 걷는다: 바로 다음 줄로 넘어가는 중이면 그 줄의 enter 가 먼저 와서
   * 취소된다(줄 경계의 한두 픽셀에서 비춤이 풀렸다 다시 켜지는 깜빡임을 막는다).
   */
  const onHoverRef = useRef(onHoverFactory)
  onHoverRef.current = onHoverFactory
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelLeave = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current)
    leaveTimer.current = null
  }
  const enterFactory = (name: string) => {
    cancelLeave()
    onHoverFactory(name)
  }
  const leaveFactory = () => {
    cancelLeave()
    leaveTimer.current = setTimeout(() => {
      leaveTimer.current = null
      onHoverRef.current(null)
    }, 80)
  }
  useEffect(
    () => () => {
      if (leaveTimer.current) clearTimeout(leaveTimer.current)
      onHoverRef.current(null)
    },
    []
  )

  /* 공정 하나의 진행 작업 합 — 그 공정 공장 줄의 수를 더한다 */
  const workingOfGroup = (list: readonly FactoryNavItem[]) =>
    list.reduce((sum, factory) => sum + (workCounts?.get(factory.name) ?? 0), 0)

  const color = group ? colorOfProcess(group.process) : null

  return (
    <section
      aria-label={group ? group.process : t('dashboard.map.factoryNav.title')}
      className={cn(
        'pointer-events-auto flex max-h-full min-h-0 w-[18rem] max-w-full flex-col overflow-hidden rounded-inshop-xl border border-white/12 bg-[#0b0e12]/95 text-white shadow-[0_18px_48px_rgba(0,0,0,0.38)] backdrop-blur-xl',
        className
      )}
    >
      {color && <div className="h-0.5 w-full shrink-0" style={{ backgroundColor: color }} />}

      {/* 머리 — 공정 목록이면 제목·공장 수, 공장 목록이면 경로 + 공정 이름·공장 수·진행 합 */}
      <div className="shrink-0 px-4 pb-2 pt-3">
        {group && trail}
        <div className={cn('flex items-center gap-2', group && 'mt-3')}>
          {color && (
            <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
          )}
          <h3 className={cn('font-semibold', group ? 'text-inshop-xl' : 'text-inshop-base')}>
            {group ? group.process : t('dashboard.map.factoryNav.title')}
          </h3>
          <span className="text-inshop-sm tabular-nums text-white/50">
            {/* 첫 단계는 공정 목록이라 공정 수, 둘째 단계는 그 공정의 공장 수 */}
            {group ? group.factories.length : groups.length}
          </span>
          {group && workCounts && (
            <WorkingChip count={workingOfGroup(group.factories)} className="ml-auto" />
          )}
        </div>
      </div>

      <div
        key={group ? group.process : 'processes'}
        className="scroll-thin scroll-shadow-y min-h-0 flex-1 animate-fade-in overflow-y-auto px-2 pb-2"
        onMouseLeave={() => {
          cancelLeave()
          onHoverFactory(null)
        }}
      >
        {!group ? (
          /* 1단계 — 공정 목록. 누르면 카드가 그 공정의 공장 목록으로 바뀐다 */
          <ul>
            {groups.map((g) => (
              <li key={g.process}>
                <button
                  type="button"
                  onClick={() => onSelectProcess(g.process)}
                  title={t('dashboard.map.factoryNav.processHint', { process: g.process })}
                  className="flex w-full items-center gap-2 rounded-inshop-md px-2 py-2.5 text-left transition-colors hover:bg-white/8 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                >
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: colorOfProcess(g.process) }}
                  />
                  <span className="text-inshop-base font-semibold text-white/90">{g.process}</span>
                  <span className="text-inshop-xs tabular-nums text-white/45">{g.factories.length}</span>
                  {workCounts && <WorkingChip count={workingOfGroup(g.factories)} className="ml-auto" />}
                  <ChevronRightIcon
                    size={20}
                    className={cn('shrink-0 text-white/60', !workCounts && 'ml-auto')}
                  />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          /* 2단계 — 그 공정의 공장 목록. 줄 사이에 틈을 두지 않고(틈에서 미리 비춤이 깜빡인다)
             가는 구분선으로 공장끼리 갈라 보이게 한다(사용자 확정) */
          <ul className="divide-y divide-white/10">
            {group.factories.map((factory) => (
              <li key={factory.name}>
                <button
                  type="button"
                  onClick={() => onSelectFactory(factory.name)}
                  onMouseEnter={() => enterFactory(factory.name)}
                  onMouseLeave={leaveFactory}
                  onFocus={() => enterFactory(factory.name)}
                  onBlur={leaveFactory}
                  title={t('dashboard.map.factoryNav.factoryHint', { factory: factory.name })}
                  className="flex w-full items-center gap-2 rounded-inshop-md px-2 py-2.5 text-left text-[0.9375rem] text-white/85 transition-colors hover:bg-white/8 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                >
                  <span className="flex min-w-0 flex-1 items-center gap-1.5">
                    <span className="min-w-0 truncate">{factory.name}</span>
                    {(faultCounts?.get(factory.name) ?? 0) > 0 && (
                      <FaultMark count={faultCounts!.get(factory.name)!} />
                    )}
                  </span>
                  {/* 진행 작업 수 — 공장 카드의 '진행 작업' 합. 없으면 '작업 없음' */}
                  {workCounts?.has(factory.name) &&
                    (workCounts.get(factory.name)! > 0 ? (
                      <WorkingChip count={workCounts.get(factory.name)!} />
                    ) : (
                      <span className="shrink-0 text-inshop-xs text-white/40">{t('dashboard.map.workNone')}</span>
                    ))}
                  <ChevronRightIcon size={18} className="shrink-0 text-white/45" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

/** 진행 작업 수 칩 — 0 이면 바탕 없이 흐리게 */
function WorkingChip({ count, className }: { count: number; className?: string }) {
  const { t } = useTranslation()
  return (
    <span
      title={t('dashboard.map.factoryNav.workingHint', { count })}
      className={cn(
        'shrink-0 rounded-full px-2 py-0.5 text-inshop-xs font-semibold tabular-nums',
        count > 0 ? 'bg-white/10 text-white/85' : 'text-white/40',
        className
      )}
    >
      {t('dashboard.map.factoryNav.working', { count })}
    </span>
  )
}
