import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from '../../lib/i18n/useTranslation'
import { cn } from '../../lib/utils'

/*
 * 실적률 참고 배지 — 총괄('/') 드릴다운의 공장 상세·베이 카드에 붙는 절점 기반 실적.
 *
 * "공장-베이 레벨에서 어떤 작업이 되고 있는지"를 보는 자리이므로, 그 공장에 배정된
 * 블록들의 **절점 W/O 완료(조립 기준)** 를 통합실적(/performance)과 **같은 원천**
 * (performanceApi mock)에서 읽어 같은 숫자를 보여 준다 — 여기서 새 mock 을 만들지
 * 않는다. IPD 원칙(참고 수치)대로 '참고' 단서를 달고, 누르면 통합실적 화면으로
 * 나간다(호선은 아직 못 정하므로 화면만 이동 — /performance 는 조회 조건을 제 필터로
 * 고른다).
 *
 * performanceApi 는 **동적 import** 로만 끌어온다 — 총괄 화면 초기 청크에 통합실적
 * 모듈이 실리지 않게 한다(무게 불변). 절점 데이터가 없는 공장(조립 외 공정·mock 에
 * 블록이 없는 공장)은 배지 자체를 그리지 않는다 — 없는 숫자를 0% 로 말하지 않는다.
 */

interface BlockPerfRow {
  projNo: string
  blockNo: string
  woDone: number
  woTotal: number
  rate: number
}

interface FactoryPerf {
  rows: BlockPerfRow[]
  woDone: number
  woTotal: number
  rate: number
}

/** 통합실적 화면과 같은 기준일 규칙 — 같은 날 같은 숫자가 나오게 한다 */
function todayString(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

/** 공장 하나의 절점 실적 — performanceApi 를 늦게 실어 와 블록별 조립 요약을 모은다 */
async function loadFactoryPerf(factory: string): Promise<FactoryPerf | null> {
  const api = await import('../../features/performance/api/performanceApi')
  const baseDate = todayString()
  const vessels = await api.fetchVessels()
  const pairs = (
    await Promise.all(
      vessels.map(async (v) =>
        (await api.fetchBlocks(v.projNo))
          .filter((b) => b.factory === factory)
          .map((b) => ({ projNo: v.projNo, blockNo: b.blockNo }))
      )
    )
  ).flat()
  if (pairs.length === 0) return null

  const rows = await Promise.all(
    pairs.map(async ({ projNo, blockNo }): Promise<BlockPerfRow> => {
      const summary = await api.fetchAssemblySummary(projNo, blockNo, baseDate)
      return {
        projNo,
        blockNo,
        woDone: summary.woDone,
        woTotal: summary.woTotal,
        rate: summary.overallRate,
      }
    })
  )
  const woDone = rows.reduce((s, r) => s + r.woDone, 0)
  const woTotal = rows.reduce((s, r) => s + r.woTotal, 0)
  return {
    rows,
    woDone,
    woTotal,
    rate: woTotal > 0 ? Math.round((woDone / woTotal) * 100) : 0,
  }
}

export function PerformanceBadge({
  factory,
  className,
}: {
  /** 지도 공장 키(`YardParcelFactory.name`) — 통합실적 mock 의 블록 factory 와 같은 체계 */
  factory: string
  className?: string
}) {
  const { t } = useTranslation()
  const [perf, setPerf] = useState<FactoryPerf | null>(null)

  useEffect(() => {
    let alive = true
    setPerf(null)
    loadFactoryPerf(factory).then((next) => {
      if (alive) setPerf(next)
    })
    return () => {
      alive = false
    }
  }, [factory])

  /* 블록이 많아도 카드가 길어지지 않게 — 완료율 낮은 순으로 넷까지만 (지금 mock 은 ≤4) */
  const rows = useMemo(() => (perf ? [...perf.rows].sort((a, b) => a.rate - b.rate).slice(0, 4) : []), [perf])

  /* 로딩 중이거나 절점 데이터가 없는 공장 — 배지를 세우지 않는다 */
  if (!perf) return null

  return (
    <div className={cn('shrink-0 border-b border-white/8 px-3 py-3', className)}>
      <Link
        to="/performance"
        title={t('dashboard.map.perfBadge.openHint')}
        className="block rounded-inshop-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 transition-colors hover:border-white/22 hover:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      >
        <div className="flex items-center gap-2">
          <span className="rounded border border-white/18 bg-white/8 px-1.5 py-px text-2xs font-bold text-white/70">
            {t('dashboard.map.perfBadge.refChip')}
          </span>
          <span className="text-2xs font-medium text-white/55">
            {t('dashboard.map.perfBadge.title')}
          </span>
          <span aria-hidden="true" className="ml-auto text-2xs text-white/40">
            →
          </span>
        </div>

        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-inshop-2xl font-semibold tabular-nums tracking-[-0.04em] text-white/95">
            {perf.rate}
            <span className="ml-0.5 text-inshop-xs font-normal text-white/45">%</span>
          </span>
          <span className="font-mono text-2xs tabular-nums text-white/55">
            {t('dashboard.map.perfBadge.woCount', { done: perf.woDone, total: perf.woTotal })}
          </span>
        </div>
        {/* 종합 막대 — 색 단독으로 뜻을 나르지 않는다(위 %·건수가 본문) */}
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/8">
          <div
            className="h-full rounded-full bg-white/55"
            style={{ width: `${Math.min(100, perf.rate)}%` }}
          />
        </div>

        {/* 블록별 한 줄 — 통합실적 헤더 카드의 W/O 수와 같은 숫자다(같은 mock·같은 기준일) */}
        <ul className="mt-2 space-y-1">
          {rows.map((row) => (
            <li
              key={`${row.projNo}-${row.blockNo}`}
              className="flex items-center gap-2 text-2xs text-white/60"
            >
              <span className="font-mono tabular-nums text-white/78">
                {row.projNo}-{row.blockNo}
              </span>
              <span className="ml-auto font-mono tabular-nums">
                {row.woDone}/{row.woTotal}
              </span>
              <span className="w-8 text-right font-mono tabular-nums text-white/78">
                {row.rate}%
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-2 text-2xs leading-snug text-white/38">
          {t('dashboard.map.perfBadge.note')}
        </p>
      </Link>
    </div>
  )
}
