import { useTranslation } from '../../../lib/i18n/useTranslation'
import { cn } from '../../../lib/utils'
import { colorOfWork, workSummaryOf, type BayOccupancy, type BayOccupant, type BayWork } from '../lib/bayOccupancy'
import { isWorking, occupantProgressKey, type OccupantProgress } from '../lib/occupantProgress'
import { FaultMark } from './FaultMark'

/*
 * 공장 상세의 베이 목록 — 각 행은 그 베이에서 **진행 중인 작업**의 요약이다 (P1 ①).
 *
 * 예전에는 면적·옥내외를 적었다. 지번 대장에서 온 그 숫자는 어느 날 봐도 같아서, 매일
 * 보는 화면에서 아무 말도 하지 않았다. 지금 적는 것은 "이 칸에서 무슨 작업이 몇 개
 * 돌고 있는가"다 — 블록 이름은 베이를 눌러 들어간 상세(BayOccupantList)가 낸다.
 *
 * 맨 위에 공장 전체의 합을 크게, 그 아래 **모든 베이**를 같은 어휘로 세운다. 작업이 없는
 * 베이도 행을 남겨 "작업 없음"이라고 말한다 — 빈 칸을 지우면 그 공장에 베이가 몇 개인지,
 * 어느 칸이 비어 있는지를 지도와 맞춰 볼 수 없다(사용자 요청).
 *
 * 점검이 필요한 베이는 이름 바로 옆에 경고 아이콘만 단다(테두리·바탕 없이 — 사용자 확정) —
 * 순서는 지도 베이 순서 그대로 둔다. 어떤 설비인지는 그 베이 카드의 점검 필요 목록이 말한다.
 */

/** 공장 합계 타일 — 수를 크게, 종류를 아래에. 작업 종류마다 제 색을 입힌다 */
function WorkTile({ work }: { work: BayWork }) {
  const { t } = useTranslation()
  const color = colorOfWork(work.kind)
  return (
    <div
      className="min-w-0 rounded-inshop-lg px-2 py-2 text-center"
      style={{ backgroundColor: `${color}1f`, boxShadow: `inset 0 0 0 1px ${color}59` }}
    >
      <p className="text-3xl font-semibold leading-none tabular-nums" style={{ color }}>
        {work.count}
      </p>
      <p className="mt-1.5 truncate text-inshop-sm text-white/80">
        {t(`dashboard.map.workKind.${work.kind}`)}
      </p>
    </div>
  )
}

/** 베이 행의 작업 — 색 점 + "중조 3". 합계 타일과 같은 색이라 위아래가 이어 읽힌다 */
function WorkInline({ works }: { works: readonly BayWork[] }) {
  const { t } = useTranslation()
  return (
    <span className="flex min-w-0 flex-1 flex-nowrap justify-end gap-1 whitespace-nowrap">
      {works.map((work) => {
        const color = colorOfWork(work.kind)
        return (
          <span
            key={work.kind}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5"
            style={{ backgroundColor: `${color}26` }}
          >
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-inshop-sm text-white/80">{t(`dashboard.map.workKind.${work.kind}`)}</span>
            <span className="text-inshop-base font-semibold tabular-nums" style={{ color }}>
              {work.count}
            </span>
          </span>
        )
      })}
    </span>
  )
}

/**
 * 공장 합계 — "이 공장에서 진행 중인 작업" 타일 줄. 베이 목록 머리이자, 베이가 없는
 * 공장(가공)의 카드 머리다. 진행 상태가 작업 전·완료인 자리는 세지 않는다.
 */
export function FactoryWorkSummary({
  occupants,
  progress,
}: {
  occupants: readonly BayOccupant[]
  progress?: ReadonlyMap<string, OccupantProgress>
}) {
  const { t } = useTranslation()
  const total = workSummaryOf(occupants.filter((o) => isWorking(progress?.get(occupantProgressKey(o)))))
  return (
    <section className="mb-4 px-1" aria-label={t('dashboard.map.factoryWorkSummary')}>
      <p className="mb-2 text-inshop-sm font-medium text-white/70">{t('dashboard.map.factoryWorkSummary')}</p>
      {total.length === 0 ? (
        <p className="text-inshop-base text-white/55">{t('dashboard.map.workNone')}</p>
      ) : (
        /* 칸 폭은 **고정**(5칸 격자) — 작업 종류가 둘이든 넷이든 타일 하나의 폭이 같아야 공장끼리
           비교가 된다(auto-fit 이면 종류가 적을수록 타일이 늘어났다). 다섯을 넘으면 다음 줄로 */
        <div className="grid grid-cols-5 gap-1.5">
          {total.map((work) => (
            <WorkTile key={work.kind} work={work} />
          ))}
        </div>
      )}
    </section>
  )
}

export function FactoryBayList({
  bays,
  equipmentFaults,
  progress,
  onOpenBay,
  onHoverBay,
}: {
  bays: readonly BayOccupancy[]
  /** 베이 id → 장애 설비 수(센서·틸팅·Edge PC·도장 설비). 주지 않으면 장애 표식을 만들지 않는다 */
  equipmentFaults?: ReadonlyMap<string, number>
  /**
   * 재실의 진행 상태 — 실적상 작업 전·완료인 자리는 '진행 작업' 에서 뺀다(로스터에 놓였을
   * 뿐인 것을 세지 않는다). 아직 모르는 자리는 세어 둔다. 주지 않으면 로스터대로.
   */
  progress?: ReadonlyMap<string, OccupantProgress>
  /** 행 클릭 = 그 베이로 드릴인 (`?bay=` — 지도의 베이 클릭과 같은 계단) */
  onOpenBay: (bayId: string) => void
  /** 행 호버 — 지도의 그 베이 칸이 함께 밝아진다. 벗어나면 null */
  onHoverBay?: (bayId: string | null) => void
}) {
  const { t } = useTranslation()
  if (bays.length === 0) return null

  /* 실제로 돌고 있는 자리만 — 진행 상태가 작업 전·완료면 뺀다 */
  const workingOf = (bay: BayOccupancy) =>
    bay.occupants.filter((o) => isWorking(progress?.get(occupantProgressKey(o))))
  const faultOf = (bayId: string) => equipmentFaults?.get(bayId) ?? 0
  const active = bays
    /* 순서는 지도 베이 순서 그대로 — 장애 베이를 위로 올리지 않는다(사용자 확정) */
    .map((bay) => ({ bay, works: workSummaryOf(workingOf(bay)), fault: faultOf(bay.bayId) }))

  return (
    <div className="shrink-0 px-3 py-3">
      <FactoryWorkSummary occupants={bays.flatMap((bay) => bay.occupants)} progress={progress} />

      {active.length > 0 && (
        <>
          <p className="mb-1 px-1 text-inshop-sm font-medium text-white/70">
            {t('dashboard.map.factoryBayList')}
            <span className="ml-1.5 tabular-nums text-white/45">{active.length}</span>
          </p>
          <ul
            className="divide-y divide-white/8"
            onMouseLeave={onHoverBay ? () => onHoverBay(null) : undefined}
          >
            {active.map(({ bay, works, fault }) => (
              <li key={bay.bayId}>
                <button
                  type="button"
                  onClick={() => onOpenBay(bay.bayId)}
                  onMouseEnter={onHoverBay ? () => onHoverBay(bay.bayId) : undefined}
                  title={t('dashboard.map.factoryBayOpenHint', { bay: bay.label })}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-inshop-md px-2 py-2.5 text-left transition-colors',
                    'hover:bg-white/8 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70'
                  )}
                >
                  <span className="flex min-w-14 shrink-0 items-center gap-1.5">
                    <span className="text-inshop-base font-semibold text-white">{bay.label}</span>
                    {/* 점검 필요 — 베이 이름 바로 옆의 경고 아이콘 하나(테두리·바탕 없이 — 사용자 확정).
                        수는 툴팁·보조기기 이름이 말한다 */}
                    {fault > 0 && <FaultMark count={fault} />}
                  </span>
                  {works.length > 0 ? (
                    <WorkInline works={works} />
                  ) : (
                    <span className="min-w-0 flex-1 text-right text-inshop-sm text-white/45">
                      {t('dashboard.map.workNone')}
                    </span>
                  )}
                  <span aria-hidden="true" className="shrink-0 text-white/40">
                    ›
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
