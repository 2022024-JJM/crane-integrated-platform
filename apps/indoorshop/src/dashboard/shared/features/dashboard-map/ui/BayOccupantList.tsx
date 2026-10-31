import { useTranslation } from '../../../lib/i18n/useTranslation'
import { cn } from '../../../lib/utils'
import { colorOfWork, type BayOccupant, type BayWorkKind } from '../lib/bayOccupancy'
import {
  assysOfOccupant,
  performanceHrefOfOccupant,
  shipTypeOf,
  type OccupantAssy,
} from '../lib/occupantViewer'
import {
  OCCUPANT_GROUP_ORDER,
  occupantGroupOf,
  occupantProgressKey,
  type OccupantProgress,
} from '../lib/occupantProgress'
import { EmptyBoxIcon, ListPlaceholder } from './ListPlaceholder'
import { GROUP_DOT, GROUP_TEXT } from '../lib/occupantGroupTone'

/*
 * 이 베이에서 **진행 중인 작업** (P1 ①) — 총괄 베이 카드의 본문.
 *
 * 블록 하나가 카드 한 장이다. 머리에는 블록·호선·상태, 그 아래 이 자리에서 도는 작업을
 * **작업 종류(ASSY 태그)** 로 한 줄에 적는다(사용자 확정 — 예: `소조 (S04)` `중조 (M03)`. 수는
 * 적지 않는다 — 태그가 곧 무엇이 몇 개인지다). 색은 공장 카드와 같다.
 *
 * **카드 전체가 실적 문이다** — 누르면 그 블록을 고르고 이 베이에 선 ASSY 를 짚은 채로 실적을
 * 창에 띄운다. 조립·의장·도장 자리는 그 공정 화면의 [실적] 갈래, 그 밖은 통합실적이다(사용자 확정: 따로 '실적' 버튼을 두지 않는다). 3D 는 블록마다가
 * 아니라 베이 카드 머리('현황' 옆)에 하나 선다. 카드 안에는 다른 버튼을 두지 않는다 —
 * 버튼 안의 버튼은 누를 곳이 모호하고 보조기기에서도 깨진다(ASSY 칩은 그래서 글자다).
 *
 * 재실이 없으면 **비었다고 말한다**. 빈 칸을 감추면 "아직 안 불러왔다"와 "지금 아무것도
 * 없다"가 같은 화면이 된다 — 그 둘은 운영에서 완전히 다른 사실이다.
 */

/** 이 자리의 작업 종류와 그 ASSY 태그 — ASSY 급별(소조·중조·대조). ASSY 가 없으면 빈 목록 */
function worksOf(assys: readonly OccupantAssy[]): { kind: BayWorkKind; assys: OccupantAssy[] }[] {
  /* 하위 작업 종류(ASSY 급)가 없으면 적을 종류가 없다 — '조립 블록' 같은 공정 작업은 적지 않는다 */
  if (assys.length === 0) return []
  /* 진행 작업과 같은 순서 — 소조 → 중조 → 대조 */
  const order: BayWorkKind[] = ['sub', 'mid', 'grand']
  return order
    .map((kind) => ({ kind, assys: assys.filter((a) => a.tier === kind) }))
    .filter((work) => work.assys.length > 0)
}

/** 상태 표식 — 진행 상태가 정본, 갓 반입은 로스터가 말한다 */
function StatusPill({
  occupant,
  progress,
}: {
  occupant: BayOccupant
  progress: OccupantProgress | undefined
}) {
  const { t } = useTranslation()
  const tone =
    occupant.justArrived || progress?.state === 'notStarted'
      ? 'border border-white/20 text-white/65'
      : progress?.state === 'done'
        ? 'bg-sky-400/20 text-sky-300'
        : progress?.state === 'inProgress'
          ? 'bg-status-healthy/20 text-status-healthy'
          : 'border border-white/15 text-white/50'
  const label = occupant.justArrived
    ? t('dashboard.map.occupant.justArrived')
    : progress == null
      ? t('dashboard.map.occupant.loading')
      : progress.state === 'notStarted'
        ? t('dashboard.map.occupant.notStarted')
        : progress.state === 'done'
          ? t('dashboard.map.occupant.done')
          : progress.state === 'inProgress'
            ? progress.pct != null
              ? t('dashboard.map.occupant.inProgressPct', { pct: progress.pct })
              : t('dashboard.map.occupant.inProgress')
            : t('dashboard.map.occupant.unknown')
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-px text-inshop-xs font-semibold', tone)}>
      {/* 완료는 체크로 한 번 더 — 흐린 카드 안에서도 끝난 일임이 읽히게 */}
      {progress?.state === 'done' && !occupant.justArrived && <span aria-hidden="true">✓</span>}
      {label}
    </span>
  )
}

function OccupantCard({
  occupant,
  progress,
  onPreview,
}: {
  occupant: BayOccupant
  progress: OccupantProgress | undefined
  onPreview: (href: string, title: string) => void
}) {
  const { t } = useTranslation()
  /* 실적 — 블록을 고르고, 이 자리의 ASSY 가 있으면 그것들을 짚는다. 조립은 조립 화면에서 */
  const performance = performanceHrefOfOccupant(occupant)
  const shipType = shipTypeOf(occupant.projNo)
  const assys = assysOfOccupant(occupant)
  const works = worksOf(assys)
  /*
   * 작업 중·완료를 **카드 모양으로** 가른다(사용자 확정) — 상태 글자만으로는 한눈에 안 갈렸다.
   * 작업 중은 왼쪽에 초록 띠 + 또렷한 면, 완료는 띠 없이 한 단 가라앉힌다(흐린 면·흐린 글자).
   * 작업 전·미착수는 그 사이(띠 없음, 보통 면)다.
   */
  const state = occupant.justArrived ? 'notStarted' : (progress?.state ?? 'unknown')
  const working = state === 'inProgress'
  const done = state === 'done'

  return (
    <li>
      <button
        type="button"
        onClick={() =>
          onPreview(
            performance.href,
            performance.kind === 'assembly'
              ? t('dashboard.map.preview.assemblyPerformanceTitle', { block: occupant.key })
              : performance.kind === 'outfitting'
                ? t('dashboard.map.preview.outfittingPerformanceTitle', { block: occupant.key })
                : performance.kind === 'painting'
                  ? t('dashboard.map.preview.paintingPerformanceTitle', { block: occupant.key })
                  : t('dashboard.map.preview.performanceTitle', { block: occupant.key })
          )
        }
        title={
          performance.kind === 'assembly'
            ? t('dashboard.map.occupant.assemblyPerformanceHint', { block: occupant.key })
            : performance.kind === 'outfitting'
              ? t('dashboard.map.occupant.outfittingPerformanceHint', { block: occupant.key })
              : performance.kind === 'painting'
                ? t('dashboard.map.occupant.paintingPerformanceHint', { block: occupant.key })
                : t('dashboard.map.occupant.performanceHint', { block: occupant.key })
        }
        className={cn(
          /* 카드 바탕(#0b0e12)과 확실히 갈리도록 한 단 밝은 면 + 또렷한 테두리 + 그림자 */
          'relative block w-full overflow-hidden rounded-inshop-lg border text-left transition-colors',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70',
          done
            ? 'border-white/10 bg-[#12161c] opacity-60 hover:opacity-90'
            : working
              ? 'border-status-healthy/45 bg-[#1a2029] shadow-[0_2px_8px_rgba(0,0,0,0.35)] hover:border-status-healthy/70 hover:bg-[#222a35]'
              : 'border-white/20 bg-[#1a2029] shadow-[0_2px_8px_rgba(0,0,0,0.35)] hover:border-white/35 hover:bg-[#222a35]'
        )}
      >
        {/* 작업 중 — 왼쪽 초록 띠 */}
        {working && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-status-healthy" />}
        {/* 머리 — 블록·호선·상태. 끝의 › 가 카드 전체가 문이라는 표시다 */}
        <span className="flex items-center gap-2 px-3 py-2.5">
          <span className="font-mono text-inshop-base font-semibold text-white">{occupant.key}</span>
          {shipType && (
            <span className="shrink-0 text-inshop-sm text-white/55">
              {t('dashboard.map.occupant.vessel', { projNo: occupant.projNo, shipType })}
            </span>
          )}
          <StatusPill occupant={occupant} progress={progress} />
          <span aria-hidden="true" className="ml-auto shrink-0 text-white/45">
            ›
          </span>
        </span>

        {/* 이 자리에서 도는 작업 — 작업 종류(ASSY 태그). 수는 적지 않는다(사용자 확정). 하위 작업
            종류(소조·중조·대조)가 없는 블록은 이 줄을 두지 않는다 — '조립 블록' 은 할 말이 없다 */}
        {works.length > 0 && (
          <span className="flex flex-wrap items-center gap-1.5 border-t border-white/12 px-3 py-2">
            {works.map((work) => {
              const color = colorOfWork(work.kind)
              return (
                <span
                  key={work.kind}
                  className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5"
                  style={{ backgroundColor: `${color}26` }}
                >
                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-inshop-sm text-white/80">{t(`dashboard.map.workKind.${work.kind}`)}</span>
                  {work.assys.length > 0 && (
                    <span className="text-inshop-sm text-white/65">
                      (
                      {work.assys.map((assy, i) => (
                        <span key={assy.assyNo}>
                          {i > 0 && ', '}
                          <span className="font-mono font-semibold" style={{ color }}>
                            {assy.shortName}
                          </span>
                          {assy.scanned && (
                            <span className="ml-0.5 text-status-healthy" aria-label={t('dashboard.map.occupant.scannedOne')}>
                              ✓
                            </span>
                          )}
                        </span>
                      ))}
                      )
                    </span>
                  )}
                </span>
              )
            })}
            {assys.some((a) => a.scanned) && (
              <span className="ml-auto text-inshop-xs text-white/55">
                {t('dashboard.map.occupant.scanned', {
                  done: assys.filter((a) => a.scanned).length,
                  total: assys.length,
                })}
              </span>
            )}
          </span>
        )}
      </button>
    </li>
  )
}

export function BayOccupantList({
  occupants,
  progress,
  onPreview,
  className,
}: {
  occupants: readonly BayOccupant[]
  /** 카드(실적) 열기 — 화면을 떠나지 않고 창으로 띄운다 (주소·제목을 넘긴다) */
  onPreview: (href: string, title: string) => void
  /** 자리별 진행 상태 — 없으면(로딩 중) '확인 중' 으로 선다 */
  progress?: ReadonlyMap<string, OccupantProgress>
  className?: string
}) {
  const { t } = useTranslation()

  /* 비었으면 제목은 그대로 두고 그 아래를 플레이스홀더로 — 자리를 지켜 "비었다"를 말한다 */
  if (occupants.length === 0) {
    return (
      <div className={className}>
        <p className="mb-1.5 px-1 text-inshop-sm font-medium text-white/70">{t('dashboard.map.occupant.title')}</p>
        <ListPlaceholder icon={<EmptyBoxIcon />}>{t('dashboard.map.occupant.empty')}</ListPlaceholder>
      </div>
    )
  }

  /*
   * 작업 중 · 작업 전 · 작업 완료를 **따로 묶어** 보여 준다(사용자 확정) — 한 목록 안에서 카드
   * 모양으로만 가르면 섞여 읽혔다. 묶음마다 이름과 수를 달고, 빈 묶음은 세우지 않는다.
   * 진행 상태를 아직 모르거나(확인 중) 알 수 없는 자리는 작업 중에 둔다 — 진행 작업 수도 그
   * 자리를 세어 둔다(`isWorking`).
   */
  const groupOf = (o: BayOccupant) => occupantGroupOf(o, progress?.get(occupantProgressKey(o)))
  const groups = OCCUPANT_GROUP_ORDER.map((group) => ({
    group,
    items: occupants.filter((o) => groupOf(o) === group),
  })).filter((g) => g.items.length > 0)

  return (
    <div className={className}>
      <p className="mb-1.5 px-1 text-inshop-sm font-medium text-white/70">
        {t('dashboard.map.occupant.title')}
        <span className="ml-1.5 tabular-nums text-white/45">{occupants.length}</span>
      </p>
      <div className="space-y-3.5">
        {groups.map(({ group, items }) => (
          <section key={group} aria-label={t(`dashboard.map.occupant.group.${group}`)}>
            <p className="mb-1.5 flex items-center gap-1.5 px-1 text-inshop-xs font-semibold">
              <span aria-hidden="true" className={cn('h-1.5 w-1.5 rounded-full', GROUP_DOT[group])} />
              <span className={GROUP_TEXT[group]}>{t(`dashboard.map.occupant.group.${group}`)}</span>
              <span className="tabular-nums text-white/40">{items.length}</span>
            </p>
            <ul className="space-y-2">
              {items.map((occupant) => (
                <OccupantCard
                  key={occupant.key}
                  occupant={occupant}
                  progress={progress?.get(occupantProgressKey(occupant))}
                  onPreview={onPreview}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
