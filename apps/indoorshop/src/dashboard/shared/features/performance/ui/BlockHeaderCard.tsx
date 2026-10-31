import { useSyncExternalStore, type CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from '../../../lib/i18n/useTranslation'
import { ProcessMapLink, zonePerformanceLinkFor } from '../../../entities/vessel'
import { cn } from '../../../lib/utils'
import { activeProcessPaletteId, colorOfProcess, subscribeProcessPalette } from '../../../entities/yard-parcels'
import { STATUS_STYLE } from '../../../ui/statusPalette'
import { Card } from '../../../ui/atoms/Card'
import { PinIcon } from '../../../ui/icons'
import {
  FAB_STAGE_GROUP,
  type AssyWoNode,
  type BlockSummary,
  type PaintingNode,
  type ProcessNode,
} from '../model/types'
import { NodeStrip, type StripNode } from './NodeStrip'
import { MetricRows, NodeList } from './NodeList'
import { FAB_STAGE_LABEL_KEY } from './stageLabels'

type ProcessZoneId = 'fabrication' | 'assembly' | 'outfitting' | 'painting'

/** 권역 → 야드 맵 공정 색의 이름 — 카드의 권역 구간이 지도와 같은 색으로 선다(사용자 확정) */
const ZONE_PROCESS: Record<ProcessZoneId, string> = {
  fabrication: '가공',
  assembly: '조립',
  outfitting: '의장',
  painting: '도장',
}

/**
 * 공정 줄 하나를 그 공정 화면의 [실적] 으로 가는 문으로 감싼다(사용자 확정) — 같은 호선·블록을
 * 싣고 간다. 통합실적에서 여러 블록을 골라 두었으면 그 블록들을 다 싣고 **이 블록을 탭으로** 연다
 * (블록 탭 싱크). 카드 자체는 블록 고르기 버튼이라, 줄을 누른 것이 카드 클릭으로 번지지 않게 막는다.
 */
function ProcessRowLink({
  zone,
  projNo,
  blockNo,
  blocks,
  large = false,
  children,
}: {
  zone: ProcessZoneId
  projNo: string
  blockNo: string
  blocks?: string[]
  /** 큰 카드(통합실적) — 칸 안의 내용을 넘치지 않는 선에서 키운다 */
  large?: boolean
  children: React.ReactNode
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const process = t(`performance.process.${zone}` as const)
  const label = t('performance.openProcessTab', { process })
  /* 야드 맵의 공정 색 — 시안을 바꾸면 지도와 함께 바뀐다 */
  useSyncExternalStore(subscribeProcessPalette, activeProcessPaletteId, activeProcessPaletteId)
  const zoneColor = colorOfProcess(ZONE_PROCESS[zone])
  const to = zonePerformanceLinkFor(zone, {
    projNo,
    blocks: blocks?.includes(blockNo) ? blocks : [blockNo],
    active: blockNo,
  })
  return (
    /* 권역마다 한 구간 — 왼쪽 띠와 옅은 바탕을 그 권역의 지도 색으로 칠해 경계가 분명히 갈린다.
       칸 어디를 눌러도 그 공정 화면으로 가고(사용자 확정), 키보드·스크린리더는 오른쪽 위 버튼이 그 문이다 */
    <div
      style={{ '--zone': zoneColor } as CSSProperties}
      data-zone={zone}
      onClick={(e) => {
        e.stopPropagation()
        navigate(to)
      }}
      className={cn(
        'flex min-w-0 cursor-pointer flex-col rounded-inshop-md border-l-4 border-[color:var(--zone)] transition-colors',
        /* 칸에 손을 얹어도 반응하지 않는다(사용자 확정) — 누르면 이동은 그대로, 버튼만 반응한다 */
        'bg-[color-mix(in_srgb,var(--zone)_12%,transparent)]',
        large ? 'gap-2 px-4 py-2.5' : 'gap-1 px-2.5 py-1.5'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn('font-semibold text-foreground/85', large ? 'text-inshop-base' : 'text-inshop-xs')}>{process}</span>
        <Link
          to={to}
          onClick={(e) => e.stopPropagation()}
          title={label}
          aria-label={label}
          className={cn(
            'inline-flex shrink-0 items-center gap-1 rounded-inshop-md border border-[color:color-mix(in_srgb,var(--zone)_55%,transparent)] font-medium text-foreground/80 transition-colors',
            'hover:bg-[color-mix(in_srgb,var(--zone)_25%,transparent)] hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            large ? 'px-2.5 py-1 text-inshop-xs' : 'px-1.5 py-0.5 text-[10px]'
          )}
        >
          {t('performance.header.openZone')} <span aria-hidden>→</span>
        </Link>
      </div>
      {/* 큰 카드는 칩 대신 열을 맞춘 목록(`NodeList`·`MetricRows`)이 선다 — 작은 칩은 읽히지 않고 줄이 안 맞는다 */}
      <div className={cn('flex min-w-0 flex-col', large ? 'gap-2.5' : 'gap-1.5')}>{children}</div>
    </div>
  )
}

/**
 * 블록 헤더 카드 — D2(카드·큰 수치·상태색 중심)의 앵커.
 *
 * 계획%·실적%는 **절점 기반**임을 라벨로 병기한다(D3) — 실적% = 가공 절점 종합
 * (중량가중), 계획% = 절점 계획일 도래 비율. 합성 산식으로 오독되지 않게 한다.
 *
 * '맵에서 보기'(D4) — 대시보드 야드 맵에 이 블록의 조립 공장 포커스 딥링크. 그 옆의
 * '공정 화면'은 이 블록이 실제로 서 있는 자리(정반이 정해졌으면 그 정반 상세)까지
 * 데려간다 — 로스터가 블록의 위치를 알기에 붙일 수 있는 링크다.
 */
export function BlockHeaderCard({
  summary,
  active,
  onSelect,
  outfitting = null,
  size = 'default',
  selectedBlocks,
  className,
}: {
  summary: BlockSummary
  /** 여러 카드 중 고른 것 — 고르기(`onSelect`)를 줄 때만 쓴다 */
  active?: boolean
  /**
   * 카드를 누르면 — 주지 않으면 카드는 눌리는 물건이 아니다(사용자 확정: 통합실적은 블록 탭이 고르므로
   * 카드 자체에 기능이 없어 hover·포인터를 걷는다). 공정 줄·맵에서 보기 링크는 그대로 눌린다.
   */
  onSelect?: () => void
  /** 바깥에서 크기를 맞출 때 — 통합실적은 남는 높이를 다 채운다 */
  className?: string
  /**
   * 크기 — `large` 는 통합실적처럼 이 카드가 화면의 본문일 때(사용자 확정: 공정별 섹션을 걷고
   * 요약을 크게). 글자·수치·여백만 키우고 내용과 순서는 같다.
   */
  size?: 'default' | 'large'
  /** 이 블록의 의장 줄 — 의장 재공이 아니면 null (W7-11) */
  outfitting?: { judgedRate: number; justArrived: boolean } | null
  /** 함께 조회된 블록들 — 공정 줄 링크가 이 블록들과 지금 탭을 싣고 간다 */
  selectedBlocks?: string[]
}) {
  const { t } = useTranslation()
  const { progress } = summary
  const large = size === 'large'
  /* 큰 카드의 글자 계단 — 제목 · 보조 줄 · 큰 수치 · 수치 라벨 · 칩 */
  const text = large
    ? { title: 'text-3xl', sub: 'text-inshop-sm', value: 'text-4xl', label: 'text-inshop-sm', chip: 'text-inshop-sm' }
    : { title: 'text-inshop-lg', sub: 'text-inshop-xs', value: 'text-inshop-2xl', label: 'text-[11px]', chip: 'text-[11px]' }
  /** 지연 배지는 가공 절점 기준 — 절점별 계획일이 있는 권역이 가공뿐이라 그렇다 */
  const delayedTotal = progress.delayedCount

  /* ── 세 권역의 절점을 **같은 스트립 문법**으로 편다 (R33) ──────────────────
     가공은 계획일이 근거고, 조립·도장은 n/m(완료/계획)이 근거다. 어느 쪽이든
     "어느 절점까지 왔는가" 한 줄로 읽히는 것이 이 축의 쓸모다. */
  const fabNode = (node: ProcessNode): StripNode => ({
    key: node.stage,
    short: node.stage,
    name: t(FAB_STAGE_LABEL_KEY[node.stage]),
    passed: node.passed,
    inProgress: node.inProgress,
    delayed: node.delayed,
    note: t('performance.nodes.plan', { date: node.planDate }),
    /* 적치(S1~S4) / 가공(S5~S10) — 스트립이 이 값이 바뀌는 자리를 갈라 준다 (R39) */
    group: t(`performance.stages.group.${FAB_STAGE_GROUP[node.stage]}` as const),
  })
  const asmNode = (node: AssyWoNode): StripNode => ({
    key: node.kind,
    short: t(`performance.asm.woKind.${node.kind}` as const),
    name: t(`performance.asm.woKind.${node.kind}` as const),
    passed: node.status === 'passed',
    inProgress: node.status === 'inProgress',
    note: t('performance.nodes.count', { done: node.doneWos, total: node.totalWos }),
  })
  const pntNode = (node: PaintingNode): StripNode => ({
    key: node.step,
    short: t(`performance.pnt.step.${node.step}` as const),
    name: t(`performance.pnt.step.${node.step}` as const),
    passed: node.status === 'passed',
    inProgress: node.status === 'inProgress',
    note: t('performance.nodes.count', { done: node.doneRows, total: node.plannedRows }),
  })

  const selectable = onSelect != null
  return (
    <Card
      interactive={selectable}
      {...(selectable
        ? {
            role: 'button',
            tabIndex: 0,
            'aria-pressed': active,
            onClick: onSelect,
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelect()
              }
            },
          }
        : {})}
      className={cn(
        'flex min-w-[340px] flex-1 flex-col',
        selectable && 'cursor-pointer',
        large ? 'p-6' : 'p-4',
        active && 'border-accent/60',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className={cn('font-semibold tabular-nums', text.title)}>
            {summary.projNo}-{summary.blockNo}
          </div>
          <div className={cn('mt-0.5 text-foreground/60', text.sub)}>
            {summary.factory} · {t('performance.header.assy')}{' '}
            {t('performance.header.assyCount', { count: summary.assyCount })}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Link
            to={`/indoorshop?factory=${encodeURIComponent(summary.factory)}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex shrink-0 items-center gap-1 rounded-inshop-md border border-border px-2 py-1 text-inshop-xs text-foreground/70 transition-colors hover:border-accent/50 hover:text-accent"
          >
            <PinIcon size={13} />
            {t('performance.header.viewOnMap')}
          </Link>
          <ProcessMapLink projNo={summary.projNo} blockNo={summary.blockNo} />
        </div>
      </div>

      {/* 큰 수치 3종 — 계획/실적은 절점 기준, 조립은 **판별 기준**임을 라벨에 붙인다.
          예전 셋째 칸은 'WO 완료'였다 — 레거시 작업지시를 주지표 자리에 두면 조립 카드가
          뒤집은 축과 헤더가 서로 다른 이야기를 한다. */}
      <div className={cn('grid grid-cols-3', large ? 'mt-5 gap-3' : 'mt-3 gap-2')}>
        <div className={cn('rounded-inshop-md bg-surface-secondary/50', large ? 'px-4 py-3' : 'px-3 py-2')}>
          <div className={cn('text-foreground/55', text.label)}>
            {t('performance.header.planRate')}{' '}
            <span className="text-foreground/40">({t('performance.header.nodeBasis')})</span>
          </div>
          <div className={cn('font-semibold tabular-nums', text.value)}>{progress.planRate}%</div>
        </div>
        <div className={cn('rounded-inshop-md bg-surface-secondary/50', large ? 'px-4 py-3' : 'px-3 py-2')}>
          <div className={cn('text-foreground/55', text.label)}>
            {t('performance.header.actualRate')}{' '}
            <span className="text-foreground/40">({t('performance.header.weightBasis')})</span>
          </div>
          <div className={cn('font-semibold tabular-nums text-accent', text.value)}>
            {progress.actualRate}%
          </div>
        </div>
        <div className={cn('rounded-inshop-md bg-surface-secondary/50', large ? 'px-4 py-3' : 'px-3 py-2')}>
          <div className={cn('text-foreground/55', text.label)}>
            {t('performance.header.judged')}{' '}
            <span className="text-foreground/40">({t('performance.header.judgedBasis')})</span>
          </div>
          <div className={cn('font-semibold tabular-nums', text.value)}>
            {summary.recognizedQty}
            <span className="text-inshop-sm text-foreground/45">/{summary.reqQtyTotal}</span>
          </div>
        </div>
      </div>

      {/* 세 권역의 절점 스트립 — 가공(S1~S10) · 조립(취부→용접→사상) · 도장(S/P→T/UP→FINAL).
          조립의 ASSY·검사장 요약은 절점 아래 한 줄로 따라붙는다(트리는 본문 카드 몫이다). */}
      {/* 절점 스트립은 낱개 크기가 고정이라 큰 카드에서는 묶음째 비율로 키운다 */}
      {/* 권역 구간은 세로로 쌓지 않고 나란히 — 넓으면 한 줄에 넷, 좁으면 2×2(사용자 확정) */}
      <div
        className={cn(
          'grid items-stretch',
          /* 큰 카드는 남는 높이를 권역 칸이 다 받는다(사용자 확정: 남는 공간 없이) */
          large
            ? 'mt-4 flex-1 auto-rows-fr grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4'
            : 'mt-3 grid-cols-1 gap-1.5 sm:grid-cols-2'
        )}
      >
        {/* 줄마다 그 공정 화면으로 — 가공 · 조립(+ASSY 요약) · 의장 · 도장(+국면) */}
        <ProcessRowLink zone="fabrication" projNo={summary.projNo} blockNo={summary.blockNo} blocks={selectedBlocks} large={large}>
          {large ? <NodeList nodes={progress.nodes.map(fabNode)} /> : <NodeStrip nodes={progress.nodes.map(fabNode)} />}
        </ProcessRowLink>
        <ProcessRowLink zone="assembly" projNo={summary.projNo} blockNo={summary.blockNo} blocks={selectedBlocks} large={large}>
          {large ? (
            <>
              <NodeList nodes={summary.asmNodes.map(asmNode)} />
              <MetricRows
                rows={[
                  { label: t('performance.header.metric.assy'), value: `${summary.assyDone}/${summary.assyCount}` },
                  { label: t('performance.header.metric.judged'), value: `${summary.assyJudged}/${summary.assyCount}` },
                  { label: t('performance.header.metric.wo'), value: `${summary.woDone}/${summary.woTotal}`, tone: 'muted' },
                  {
                    label: t('performance.header.metric.unmatched'),
                    value: summary.unmatchedCount,
                    tone: summary.unmatchedCount > 0 ? 'bad' : 'muted',
                    title: t('performance.header.unmatchedTitle'),
                  },
                  {
                    label: t('performance.header.metric.inspection'),
                    value: summary.inspectionMoved ? t('performance.header.metric.moved') : t('performance.header.metric.notMoved'),
                    tone: summary.inspectionMoved ? 'good' : 'muted',
                  },
                ]}
              />
            </>
          ) : (
            <>
              <NodeStrip nodes={summary.asmNodes.map(asmNode)} />
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="rounded bg-surface-secondary px-1.5 py-0.5 tabular-nums text-foreground/70">
                  {t('performance.header.assyProgress', {
                    done: summary.assyDone,
                    total: summary.assyCount,
                  })}
                </span>
                <span className="rounded bg-surface-secondary px-1.5 py-0.5 tabular-nums text-foreground/70">
                  {t('performance.header.judgedProgress', {
                    done: summary.assyJudged,
                    total: summary.assyCount,
                  })}
                </span>
                {/* W/O 는 참고 — 라벨에 그렇게 적고 색도 눌러 둔다 */}
                <span className="rounded bg-surface-secondary px-1.5 py-0.5 tabular-nums text-foreground/45">
                  {t('performance.header.woProgress', { done: summary.woDone, total: summary.woTotal })}
                </span>
                {summary.unmatchedCount > 0 && (
                  <span
                    title={t('performance.header.unmatchedTitle')}
                    className="rounded bg-status-unhealthy/10 px-1.5 py-0.5 font-medium tabular-nums text-status-unhealthy"
                  >
                    {t('performance.header.unmatched', { count: summary.unmatchedCount })}
                  </span>
                )}
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5 font-medium',
                    summary.inspectionMoved
                      ? 'bg-status-healthy/10 text-status-healthy'
                      : 'bg-surface-secondary text-foreground/50'
                  )}
                >
                  {summary.inspectionMoved
                    ? t('performance.header.inspectionMoved')
                    : t('performance.header.inspectionPending')}
                </span>
              </div>
            </>
          )}
        </ProcessRowLink>
        {/* 의장 줄 — **절점이 없다.** 스트립 대신 블록 판별 % 하나가 선다(W7-11).
            의장 재공이 아닌 블록은 그 사실만 적는다 — 0% 로 적으면 '안 됐다' 로 읽힌다. */}
        <ProcessRowLink zone="outfitting" projNo={summary.projNo} blockNo={summary.blockNo} blocks={selectedBlocks} large={large}>
          {large ? (
            outfitting ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-semibold tabular-nums text-foreground">{Math.round(outfitting.judgedRate)}%</span>
                  <span className="text-inshop-sm text-foreground/55">{t('performance.header.metric.ofitJudged')}</span>
                </div>
                <span className="block h-2 overflow-hidden rounded-full bg-surface-secondary">
                  <span className="block h-full rounded-full bg-status-progress" style={{ width: `${Math.min(100, outfitting.judgedRate)}%` }} />
                </span>
                {outfitting.justArrived && <span className="text-inshop-sm font-medium text-accent">{t('performance.ofit.justArrived')}</span>}
              </div>
            ) : (
              <p className="text-inshop-sm text-foreground/55">{t('performance.ofit.headerNone')}</p>
            )
          ) : (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              {outfitting ? (
                <>
                  <span className="rounded bg-surface-secondary px-1.5 py-0.5 font-medium tabular-nums text-foreground/70">
                    {Math.round(outfitting.judgedRate)}%
                  </span>
                  <span className="min-w-[4rem] flex-1">
                    <span className="block h-1.5 overflow-hidden rounded-full bg-surface-secondary">
                      <span
                        className="block h-full rounded-full bg-status-progress"
                        style={{ width: `${Math.min(100, outfitting.judgedRate)}%` }}
                      />
                    </span>
                  </span>
                  {outfitting.justArrived && (
                    <span className="rounded bg-accent/10 px-1.5 py-0.5 font-medium text-accent">
                      {t('performance.ofit.justArrived')}
                    </span>
                  )}
                </>
              ) : (
                <span className="rounded bg-surface-secondary px-1.5 py-0.5 text-foreground/45">
                  {t('performance.ofit.headerNone')}
                </span>
              )}
            </div>
          )}
        </ProcessRowLink>
        {/* 도장 절점 스트립 — 스텝이 곧 절점이다. **분모는 존재 기반**(그 블록에 계획된
            스텝 수)이라 3 으로 고정하지 않는다. 그 옆에 BTS 국면 칩이 붙는다. */}
        <ProcessRowLink zone="painting" projNo={summary.projNo} blockNo={summary.blockNo} blocks={selectedBlocks} large={large}>
          {large ? (
            <>
              <NodeList nodes={summary.pntNodes.map(pntNode)} />
              <MetricRows
                rows={[
                  { label: t('performance.header.metric.pntSteps'), value: `${summary.pntDone}/${summary.pntNodes.length}` },
                  {
                    label: t('performance.header.metric.pntPhase'),
                    value: t(
                      summary.pntPhase === 'shippedOut'
                        ? 'performance.pnt.phase.shippedOut'
                        : summary.pntPhase === 'inShop'
                          ? 'performance.pnt.phase.inShop'
                          : 'performance.pnt.phase.beforeIn'
                    ),
                    tone: summary.pntPhase === 'shippedOut' ? 'good' : summary.pntPhase === 'inShop' ? 'default' : 'muted',
                  },
                ]}
              />
            </>
          ) : (
            <>
              <NodeStrip nodes={summary.pntNodes.map(pntNode)} />
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="rounded bg-surface-secondary px-1.5 py-0.5 tabular-nums text-foreground/70">
                  {t('performance.header.pntProgress', {
                    done: summary.pntDone,
                    total: summary.pntNodes.length,
                  })}
                </span>
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5 font-medium',
                    /* 재실은 진행중(파랑) — 도장 카드·공장 현황과 같은 뜻 같은 색 */
                    summary.pntPhase === 'shippedOut'
                      ? STATUS_STYLE.done.chip
                      : summary.pntPhase === 'inShop'
                        ? STATUS_STYLE.inProgress.chip
                        : 'bg-surface-secondary text-foreground/50'
                  )}
                >
                  {t(
                    summary.pntPhase === 'shippedOut'
                      ? 'performance.pnt.phase.shippedOut'
                      : summary.pntPhase === 'inShop'
                        ? 'performance.pnt.phase.inShop'
                        : 'performance.pnt.phase.beforeIn'
                  )}
                </span>
              </div>
            </>
          )}
        </ProcessRowLink>
      </div>
      <div className={cn('flex flex-wrap items-center justify-between gap-2', large ? 'mt-4' : 'mt-2', text.chip)}>
        {delayedTotal > 0 ? (
          <span className="rounded bg-status-unhealthy/10 px-1.5 py-0.5 font-medium text-status-unhealthy">
            {t('performance.header.delayedNodes', { count: delayedTotal })}
          </span>
        ) : (
          <span className="rounded bg-status-healthy/10 px-1.5 py-0.5 font-medium text-status-healthy">
            {t('performance.header.noDelay')}
          </span>
        )}
        <span className="text-foreground/50">
          {t('performance.header.lastReceived')} {summary.lastReceivedAt}
        </span>
      </div>
    </Card>
  )
}
