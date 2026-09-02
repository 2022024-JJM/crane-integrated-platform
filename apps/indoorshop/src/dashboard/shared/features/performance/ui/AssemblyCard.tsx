import { useMemo, useState } from 'react'
import { useTranslation } from '../../../lib/i18n/useTranslation'
import type { InshopKey } from '../../../lib/i18n/keys'
import { cn } from '../../../lib/utils'
import { Card } from '../../../ui/atoms/Card'
import { ChevronDownIcon } from '../../../ui/icons'
import { assyTreeOrder } from '../model/aggregate'
import type { AssemblySummary, AssyUnit, AssyWo } from '../model/types'

/*
 * 조립 — **블록-ASSY 계층** 카드 (사용자 확정: ASSY 가 기준 추적축이고, 대조>중조>소조는
 * 통과 절점이 아니라 **계층 관계**다 — YDEH040M 부모추적, PRDT→CMPT 재귀).
 *
 * 나열도 그 관계 그대로다: 대조 루트 한 그룹이 카드 하나가 되고, 그 안에 중조·소조가
 * 트리 들여쓰기로 선다(급 칩 병기). 대조 단위로 접을 수 있다. W/O 1:N·REQ_QTY
 * 카운팅·'OT 가동 후' 단서는 W3-1b 그대로. % 는 W/O 완료 기준뿐(임의 합성 금지).
 */

const WO_KIND_KEY: Record<AssyWo['kind'], InshopKey> = {
  fit: 'performance.asm.woKind.fit',
  weld: 'performance.asm.woKind.weld',
  grind: 'performance.asm.woKind.grind',
}

const WO_STATUS_KEY: Record<AssyWo['status'], InshopKey> = {
  done: 'performance.asm.woStatus.done',
  inProgress: 'performance.asm.woStatus.inProgress',
  notStarted: 'performance.asm.woStatus.notStarted',
}

const WO_STATUS_CLASS: Record<AssyWo['status'], string> = {
  done: 'bg-status-healthy/10 text-status-healthy',
  inProgress: 'bg-accent/10 text-accent',
  notStarted: 'bg-surface-secondary text-foreground/50',
}

const TIER_KEY: Record<AssyUnit['tier'], InshopKey> = {
  grand: 'performance.asm.tier.grand',
  mid: 'performance.asm.tier.mid',
  sub: 'performance.asm.tier.sub',
}

/** 급 칩 — 급은 색이 아니라 라벨로 말한다(대조만 살짝 진하게 — 그룹의 머리라서) */
const TIER_CLASS: Record<AssyUnit['tier'], string> = {
  grand: 'bg-foreground/10 text-foreground/80',
  mid: 'bg-surface-secondary text-foreground/60',
  sub: 'bg-surface-secondary text-foreground/50',
}

function assyStatus(assy: AssyUnit): { key: InshopKey; className: string } {
  if (assy.done)
    return { key: 'performance.asm.assyStatus.done', className: 'bg-status-healthy/10 text-status-healthy' }
  if (assy.woDone > 0 || assy.countedQty > 0)
    return { key: 'performance.asm.assyStatus.inProgress', className: 'bg-accent/10 text-accent' }
  return { key: 'performance.asm.assyStatus.notStarted', className: 'bg-surface-secondary text-foreground/50' }
}

/** ASSY 한 줄 — 급 칩·카운팅·W/O 1:N. 깊이만큼 트리 라인을 붙여 계층이 눈에 남게 한다 */
function AssyRow({ assy }: { assy: AssyUnit }) {
  const { t } = useTranslation()
  const status = assyStatus(assy)
  return (
    <div
      className={cn(
        'py-2.5',
        assy.depth > 0 && 'border-l-2 border-border pl-3',
        assy.depth === 1 && 'ml-1',
        assy.depth === 2 && 'ml-6'
      )}
    >
      <div className="flex items-baseline gap-2">
        <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', TIER_CLASS[assy.tier])}>
          {t(TIER_KEY[assy.tier])}
        </span>
        <span className="font-mono text-inshop-xs font-semibold tabular-nums">{assy.assyNo}</span>
        <span className={cn('ml-auto rounded px-1.5 py-0.5 text-[10px] font-medium', status.className)}>
          {t(status.key)}
        </span>
      </div>

      {/* 카운팅 — 분모는 REQ_QTY. 인식 실값은 OT 소관(mock 은 W/O 파생) */}
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="text-inshop-xl font-semibold tabular-nums">
          {assy.countedQty}
          <span className="text-inshop-sm text-foreground/45">/{assy.reqQty}</span>
        </span>
        <span className="text-[10px] text-foreground/45">{t('performance.asm.counting')}</span>
      </div>
      <div
        className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-secondary"
        role="img"
        aria-label={`${t('performance.asm.counting')} ${assy.countedQty}/${assy.reqQty}`}
      >
        <div
          className={cn('h-full rounded-full', assy.done ? 'bg-status-healthy' : 'bg-accent')}
          style={{
            width: `${assy.reqQty === 0 ? 0 : Math.min(100, (assy.countedQty / assy.reqQty) * 100)}%`,
          }}
        />
      </div>

      {/* 연결 W/O 1:N — 취부/용접/사상 상태 */}
      <ul className="mt-1.5 space-y-1">
        {assy.wos.map((wo) => (
          <li key={wo.woNo} className="flex items-center gap-2 text-[11px]">
            <span className="font-mono tabular-nums text-foreground/70">{wo.woNo}</span>
            <span className="text-foreground/55">{t(WO_KIND_KEY[wo.kind])}</span>
            <span
              className={cn('ml-auto rounded px-1.5 py-0.5 text-[10px] font-medium', WO_STATUS_CLASS[wo.status])}
            >
              {t(WO_STATUS_KEY[wo.status])}
            </span>
            {wo.actualDate && (
              <span className="text-[10px] tabular-nums text-foreground/40">{wo.actualDate}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function AssemblyCard({ summary }: { summary: AssemblySummary }) {
  const { t } = useTranslation()
  /* 대조 루트 단위 접기 — 루트 assyNo 집합. 기본은 전부 펴짐(시인성 우선) */
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())

  /* 계층 순서(pre-order)로 편 뒤 대조 루트 단위로 자른다 — 한 그룹이 카드 하나 */
  const groups = useMemo(() => {
    const ordered = assyTreeOrder(summary.assys)
    const out: { root: AssyUnit; members: AssyUnit[] }[] = []
    for (const u of ordered) {
      if (u.depth === 0 || out.length === 0) out.push({ root: u, members: [u] })
      else out[out.length - 1].members.push(u)
    }
    return out
  }, [summary.assys])

  const toggle = (rootNo: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(rootNo)) next.delete(rootNo)
      else next.add(rootNo)
      return next
    })

  return (
    <div className="flex flex-col gap-3">
      {/* ── 블록 수준 요약 — ASSY 완료 · W/O 완료 · 검사장 이동(BTS) — 블록 레벨 사실 ── */}
      <Card className="flex flex-wrap items-center gap-x-6 gap-y-2 bg-surface-secondary/40 p-3.5">
        <div>
          <div className="text-[11px] text-foreground/55">{t('performance.asm.assyDone')}</div>
          <div className="text-inshop-2xl font-semibold tabular-nums">
            {summary.assyDone}
            <span className="text-inshop-sm text-foreground/45">/{summary.assyTotal}</span>
          </div>
        </div>
        <div>
          <div className="text-[11px] text-foreground/55">{t('performance.asm.overall')}</div>
          <div className="text-inshop-2xl font-semibold tabular-nums text-accent">
            {summary.overallRate}
            <span className="text-inshop-base text-foreground/45">%</span>
            <span className="ml-1.5 align-middle text-inshop-sm font-normal tabular-nums text-foreground/55">
              {summary.woDone}/{summary.woTotal}
            </span>
          </div>
        </div>
        <div>
          <div className="text-[11px] text-foreground/55">{t('performance.asm.inspection')}</div>
          <div className="mt-1">
            {summary.inspectionMoved ? (
              <span className="rounded bg-status-healthy/10 px-2 py-0.5 text-inshop-xs font-medium text-status-healthy">
                {t('performance.asm.inspectionMoved', { date: summary.inspectionDate ?? '' })}
              </span>
            ) : (
              <span className="rounded bg-surface-secondary px-2 py-0.5 text-inshop-xs text-foreground/55">
                {t('performance.asm.inspectionPending')}
              </span>
            )}
          </div>
        </div>
        <div className="ml-auto max-w-64 text-[10px] leading-4 text-foreground/45">
          {t('performance.asm.hierarchyNote')}
          <div>{t('performance.asm.overallNote')}</div>
        </div>
      </Card>

      {/* ── 계층 트리 — 대조 루트 그룹이 카드 하나, 안에 중조·소조가 들여쓰기로 선다 ── */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {groups.map(({ root, members }) => {
          const isCollapsed = collapsed.has(root.assyNo)
          const doneCount = members.filter((m) => m.done).length
          return (
            <Card key={root.assyNo} className={cn('p-3.5', root.done && 'border-status-healthy/35')}>
              <button
                type="button"
                onClick={() => toggle(root.assyNo)}
                aria-expanded={!isCollapsed}
                aria-label={
                  isCollapsed ? t('performance.asm.treeExpand') : t('performance.asm.treeCollapse')
                }
                className="flex w-full items-center gap-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <ChevronDownIcon
                  size={14}
                  className={cn('shrink-0 text-foreground/50 transition-transform', isCollapsed && '-rotate-90')}
                />
                <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', TIER_CLASS.grand)}>
                  {t(TIER_KEY.grand)}
                </span>
                <span className="font-mono text-inshop-xs font-semibold tabular-nums">{root.assyNo}</span>
                <span className="ml-auto text-[11px] tabular-nums text-foreground/55">
                  {t('performance.asm.treeSummary', { done: doneCount, total: members.length })}
                </span>
              </button>

              {!isCollapsed && (
                <div className="mt-1 divide-y divide-border/60">
                  {members.map((assy) => (
                    <AssyRow key={assy.assyNo} assy={assy} />
                  ))}
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
