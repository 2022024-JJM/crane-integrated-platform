import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from '../../../lib/i18n/useTranslation'
import type { InshopKey } from '../../../lib/i18n/keys'
import { cn } from '../../../lib/utils'
import { Card } from '../../../ui/atoms/Card'
import { ChevronDownIcon } from '../../../ui/icons'
import { assyTreeOrder } from '../model/aggregate'
import type { AssemblySummary, AssyMatch, AssyUnit, AssyWo } from '../model/types'

/*
 * 조립 — **블록-ASSY 계층** 카드. 기준 축은 **우리 판별(자동수집)** 이고, 레거시 W/O 는
 * 그 위에 붙는 **참고 주석**이다 (사용자 확정).
 *
 * 예전 카드는 W/O 완료가 진척·완료 판정을 정했다. 그 방향은 매칭 캐스케이드와 반대다 —
 * 캐스케이드는 우리 판별 실적에 W/O 를 찾아 붙이지(하루치 → 4주 폴백 → 불일치 노티),
 * W/O 를 채워서 실적을 만들지 않는다. 그래서 척추가 바뀌었다:
 *
 *  - 각 ASSY 의 큰 수치는 **판별 인식 수량 / 계획 분모(REQ_QTY, 참고)** 다.
 *  - 상태 배지는 판별 상태(판별 완료 / 부분 인식 / 미인식)가 먼저 말한다.
 *  - W/O 는 **매칭 상태 3종**(매칭됨 · 4주 폴백 · 불일치)을 단 참고 블록으로 내려간다.
 *  - **불일치는 완료 처리 금지**라(ASM-F10) 판별이 끝났어도 `완료 보류`로 선다.
 *
 * 나열은 ASSY 계층 그대로다 — 대조 루트 한 그룹이 카드 하나, 안에 중조·소조가 트리
 * 들여쓰기로 선다(급 칩 병기). 대조 단위로 접을 수 있다.
 *
 * **ASSY 단위 실적률** (W6-2) — 통합실적을 블록 레벨로만 보면 "이 블록 60%" 까지만 알고
 * 어느 덩이가 밀렸는지는 못 본다. 그래서 노드마다 두 값을 나눠 적는다:
 *  - **자기** `recognizedQty / reqQty` — 그 한 덩이의 진척
 *  - **자기+하위** 롤업 — 그 가지 전체의 진척 (하위가 없는 소조는 같아서 생략한다)
 * `focusAssys` 가 오면 그 ASSY 를 강조하고 첫 번째로 스크롤한다 — `?assy=` 딥링크와
 * 지도 ASSY 마커가 여기로 들어온다.
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

/** 판별 상태 — 기준 축이라 ASSY 줄에서 가장 먼저 읽히는 자리에 둔다 */
const JUDGE_KEY: Record<AssyUnit['judged'], InshopKey> = {
  complete: 'performance.asm.judgeStatus.complete',
  partial: 'performance.asm.judgeStatus.partial',
  none: 'performance.asm.judgeStatus.none',
}

const JUDGE_CLASS: Record<AssyUnit['judged'], string> = {
  complete: 'bg-status-healthy/10 text-status-healthy',
  partial: 'bg-accent/10 text-accent',
  none: 'bg-surface-secondary text-foreground/50',
}

const MATCH_KEY: Record<AssyMatch['state'], InshopKey> = {
  matched: 'performance.asm.matchState.matched',
  fallback: 'performance.asm.matchState.fallback',
  unmatched: 'performance.asm.matchState.unmatched',
}

const MATCH_NOTE_KEY: Record<AssyMatch['state'], InshopKey> = {
  matched: 'performance.asm.matchStateNote.matched',
  fallback: 'performance.asm.matchStateNote.fallback',
  unmatched: 'performance.asm.matchStateNote.unmatched',
}

/**
 * 매칭 상태 배지 색 — **참고 수준의 색**이다(테두리만). 판별 상태 배지와 나란히 섰을 때
 * 어느 쪽이 기준인지 색 무게로도 드러나야 한다. 불일치만 예외로 경고색을 채운다 —
 * 노티 대상이고 완료를 막는 사실이라 눈에 걸려야 한다.
 */
const MATCH_CLASS: Record<AssyMatch['state'], string> = {
  matched: 'border border-border text-foreground/55',
  fallback: 'border border-accent/45 text-accent',
  unmatched: 'border border-status-unhealthy/50 bg-status-unhealthy/10 text-status-unhealthy',
}

const FLAG_KEY: Record<NonNullable<AssyMatch['flag']>, InshopKey> = {
  early: 'performance.asm.matchFlag.early',
  late: 'performance.asm.matchFlag.late',
}

/**
 * W/O 참고 블록 — ASSY 줄 아래에 한 단 내려 선다.
 *
 * 들여쓰기와 옅은 라벨(`W/O (참고)`)로 "이건 곁다리"임을 배치가 먼저 말하게 한다.
 * 불일치면 붙은 W/O 자체가 없으므로 목록 대신 그 사정을 문장으로 적는다 — 빈 목록을
 * 두면 "W/O 가 아직 안 떨어졌다"로 읽히지만, 실제로는 레거시에 대상이 없다는 사실이다.
 */
function MatchBlock({ match }: { match: AssyMatch }) {
  const { t } = useTranslation()
  return (
    <div className="mt-2 border-l-2 border-border/70 pl-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] text-foreground/45">{t('performance.asm.woRef')}</span>
        <span
          title={t(MATCH_NOTE_KEY[match.state])}
          className={cn(
            'rounded px-1.5 py-0.5 text-[10px] font-medium',
            MATCH_CLASS[match.state]
          )}
        >
          {t(MATCH_KEY[match.state])}
        </span>
        {match.flag && (
          <span
            title={t('performance.asm.matchFlagNote')}
            className="rounded border border-border px-1.5 py-0.5 text-[10px] text-foreground/55"
          >
            {t(FLAG_KEY[match.flag])}
          </span>
        )}
        <span className="ml-auto font-mono text-[10px] text-foreground/35">{match.poolLabel}</span>
      </div>

      {match.state === 'unmatched' ? (
        <p className="mt-1 text-[11px] leading-snug text-foreground/50">
          {t('performance.asm.unmatchedBody')}
        </p>
      ) : (
        <ul className="mt-1 space-y-1">
          {match.wos.map((wo) => (
            <li key={wo.woNo} className="flex items-center gap-2 text-[11px]">
              <span className="font-mono tabular-nums text-foreground/70">{wo.woNo}</span>
              <span className="text-foreground/55">{t(WO_KIND_KEY[wo.kind])}</span>
              <span
                className={cn(
                  'ml-auto rounded px-1.5 py-0.5 text-[10px] font-medium',
                  WO_STATUS_CLASS[wo.status]
                )}
              >
                {t(WO_STATUS_KEY[wo.status])}
              </span>
              {wo.actualDate && (
                <span className="text-[10px] tabular-nums text-foreground/40">{wo.actualDate}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** ASSY 한 줄 — 판별이 척추, W/O 는 아래 참고 블록. 깊이만큼 트리 라인을 붙인다 */
function AssyRow({
  assy,
  focused,
  scrollTarget,
}: {
  assy: AssyUnit
  focused: boolean
  scrollTarget: boolean
}) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (scrollTarget) ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [scrollTarget])
  return (
    <div
      ref={ref}
      id={`assy-${assy.assyNo}`}
      className={cn(
        'py-2.5',
        assy.depth > 0 && 'border-l-2 border-border pl-3',
        assy.depth === 1 && 'ml-1',
        assy.depth === 2 && 'ml-6',
        /* 딥링크·지도 마커가 지목한 ASSY — 트리에서 눈으로 찾을 수 있어야 한다 */
        focused && 'rounded-inshop-md bg-accent/[0.07] px-2 ring-1 ring-accent/45'
      )}
    >
      <div className="flex flex-wrap items-baseline gap-2">
        <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', TIER_CLASS[assy.tier])}>
          {t(TIER_KEY[assy.tier])}
        </span>
        <span className="font-mono text-inshop-xs font-semibold tabular-nums">{assy.assyNo}</span>
        {/* 완료 보류 — 판별은 끝났는데 매칭이 완료를 막은 상태. 판별 배지 앞에 세워
            "다 됐는데 왜 완료가 아닌가"를 먼저 답한다 */}
        {assy.blockedByMatch && (
          <span
            title={t('performance.asm.blockedNote')}
            className="rounded bg-status-unhealthy/10 px-1.5 py-0.5 text-[10px] font-medium text-status-unhealthy"
          >
            {t('performance.asm.blocked')}
          </span>
        )}
        <span
          className={cn(
            'ml-auto rounded px-1.5 py-0.5 text-[10px] font-medium',
            JUDGE_CLASS[assy.judged]
          )}
        >
          {t(JUDGE_KEY[assy.judged])}
        </span>
      </div>

      {/* 판별 인식 — 분자가 우리 수집, 분모는 계획(REQ_QTY)이라 라벨이 그 사실을 적는다 */}
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="text-inshop-xl font-semibold tabular-nums">
          {assy.recognizedQty}
          <span className="text-inshop-sm text-foreground/45">/{assy.reqQty}</span>
        </span>
        <span className="text-[10px] text-foreground/45">{t('performance.asm.counting')}</span>
        {/* ASSY 단위 실적률 — 이 한 덩이의 진척 */}
        <span
          title={t('performance.asm.selfRateNote')}
          className="rounded bg-surface-secondary px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-foreground/70"
        >
          {assy.selfRate}%
        </span>
        {assy.judgedDate && (
          <span className="ml-auto text-[10px] tabular-nums text-foreground/40">
            {assy.judgedDate}
          </span>
        )}
      </div>

      {/* 하위가 있으면 가지 전체 롤업도 함께 — 자기만 끝나고 하위가 남은 상태를 숨기지 않는다 */}
      {assy.descendantCount > 0 && (
        <div className="mt-1 flex items-baseline gap-1.5 text-[10px] text-foreground/50">
          <span>{t('performance.asm.rollupRate', { count: assy.descendantCount })}</span>
          <span className="font-medium tabular-nums text-foreground/75">{assy.rollupRate}%</span>
          <span className="tabular-nums text-foreground/40">
            {assy.rollupRecognizedQty}/{assy.rollupReqQty}
          </span>
        </div>
      )}
      <div
        className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-secondary"
        role="img"
        aria-label={`${t('performance.asm.counting')} ${assy.recognizedQty}/${assy.reqQty}`}
      >
        <div
          className={cn(
            'h-full rounded-full',
            assy.blockedByMatch
              ? 'bg-status-unhealthy'
              : assy.done
                ? 'bg-status-healthy'
                : 'bg-accent'
          )}
          style={{
            width: `${assy.reqQty === 0 ? 0 : Math.min(100, (assy.recognizedQty / assy.reqQty) * 100)}%`,
          }}
        />
      </div>

      <MatchBlock match={assy.match} />
    </div>
  )
}

/** 매칭 분포 범례 — 셋을 나란히 세워 "얼마나 참고에 기대고 있나"를 한 줄로 읽힌다 */
function MatchLegend({ counts }: { counts: AssemblySummary['match'] }) {
  const { t } = useTranslation()
  const items = [
    { state: 'matched' as const, value: counts.matched },
    { state: 'fallback' as const, value: counts.fallback },
    { state: 'unmatched' as const, value: counts.unmatched },
  ]
  return (
    <div>
      <div className="text-[11px] text-foreground/55">{t('performance.asm.matchLegend')}</div>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        {items.map((item) => (
          <span
            key={item.state}
            title={t(MATCH_NOTE_KEY[item.state])}
            className={cn(
              'rounded px-1.5 py-0.5 text-[11px] font-medium tabular-nums',
              MATCH_CLASS[item.state],
              /* 0 건인 상태는 눌러 둔다 — 없는 것을 있는 것처럼 세우지 않는다 */
              item.value === 0 && 'opacity-45'
            )}
          >
            {t(MATCH_KEY[item.state])} {item.value}
          </span>
        ))}
      </div>
    </div>
  )
}

export function AssemblyCard({
  summary,
  focusAssys,
}: {
  summary: AssemblySummary
  /** `?assy=` 딥링크·지도 ASSY 마커가 지목한 ASSY 들 — 강조 + 첫 번째로 스크롤 */
  focusAssys?: readonly string[]
}) {
  const { t } = useTranslation()
  /* 대조 루트 단위 접기 — 루트 assyNo 집합. 기본은 전부 펴짐(시인성 우선) */
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())
  const focus = useMemo(() => new Set(focusAssys ?? []), [focusAssys])
  /* 스크롤 목표는 트리 순서상 첫 번째 포커스 ASSY 하나 — 여럿이 서로 스크롤을 뺏지 않게 */
  const scrollTo = useMemo(
    () => assyTreeOrder(summary.assys).find((u) => focus.has(u.assyNo))?.assyNo ?? null,
    [summary.assys, focus]
  )

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
      {/* ── 블록 수준 요약 — 주지표는 판별 실적, 매칭은 참고 범례로 옆에 선다 ── */}
      <Card className="flex flex-wrap items-center gap-x-6 gap-y-2 bg-surface-secondary/40 p-3.5">
        <div>
          <div className="text-[11px] text-foreground/55">{t('performance.asm.judgedRate')}</div>
          <div className="text-inshop-2xl font-semibold tabular-nums text-accent">
            {summary.judgedRate}
            <span className="text-inshop-base text-foreground/45">%</span>
            <span className="ml-1.5 align-middle text-inshop-sm font-normal tabular-nums text-foreground/55">
              {summary.recognizedQty}/{summary.reqQtyTotal}
            </span>
          </div>
        </div>
        <div>
          <div className="text-[11px] text-foreground/55">{t('performance.asm.assyJudged')}</div>
          <div className="text-inshop-2xl font-semibold tabular-nums">
            {summary.assyJudged}
            <span className="text-inshop-sm text-foreground/45">/{summary.assyTotal}</span>
          </div>
        </div>
        <div>
          <div className="text-[11px] text-foreground/55" title={t('performance.asm.assyDoneNote')}>
            {t('performance.asm.assyDone')}
          </div>
          <div className="text-inshop-2xl font-semibold tabular-nums">
            {summary.assyDone}
            <span className="text-inshop-sm text-foreground/45">/{summary.assyTotal}</span>
          </div>
        </div>

        <MatchLegend counts={summary.match} />

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
          {t('performance.asm.judgedRateNote')}
          <div className="mt-0.5">{t('performance.asm.hierarchyNote')}</div>
        </div>
      </Card>

      {/* 불일치가 있으면 그 사실을 카드 머리에 따로 세운다 — 트리 안쪽 배지만으로는
          접힌 그룹에 숨는다. 노티 대상이라 접혀 있어도 보여야 한다. */}
      {summary.match.unmatched > 0 && (
        <div className="rounded-inshop-md border border-status-unhealthy/40 bg-status-unhealthy/[0.07] px-3 py-2 text-[11px] text-status-unhealthy">
          {t('performance.asm.unmatchedCount', { count: summary.match.unmatched })}
          <span className="ml-1.5 text-status-unhealthy/75">
            {t('performance.asm.matchStateNote.unmatched')}
          </span>
        </div>
      )}

      {/* ── 계층 트리 — 대조 루트 그룹이 카드 하나, 안에 중조·소조가 들여쓰기로 선다 ── */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {groups.map(({ root, members }) => {
          /* 포커스 대상이 든 그룹은 접혀 있어도 편다 — 지목해 놓고 숨기면 링크가 헛돈다 */
          const hasFocus = members.some((m) => focus.has(m.assyNo))
          const isCollapsed = collapsed.has(root.assyNo) && !hasFocus
          const judgedCount = members.filter((m) => m.judged === 'complete').length
          const doneCount = members.filter((m) => m.done).length
          const blocked = members.filter((m) => m.blockedByMatch).length
          return (
            <Card
              key={root.assyNo}
              className={cn(
                'p-3.5',
                root.done && 'border-status-healthy/35',
                blocked > 0 && 'border-status-unhealthy/35',
                hasFocus && 'border-accent/45'
              )}
            >
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
                {/* 접혀 있어도 이 그룹에 완료 보류가 있다는 사실은 남아야 한다 */}
                {blocked > 0 && (
                  <span
                    title={t('performance.asm.blockedNote')}
                    className="rounded bg-status-unhealthy/10 px-1.5 py-0.5 text-[10px] font-medium text-status-unhealthy"
                  >
                    {t('performance.asm.blocked')} {blocked}
                  </span>
                )}
                <span className="ml-auto text-[11px] tabular-nums text-foreground/55">
                  {t('performance.asm.treeSummary', {
                    judged: judgedCount,
                    total: members.length,
                    done: doneCount,
                  })}
                </span>
              </button>

              {!isCollapsed && (
                <div className="mt-1 divide-y divide-border/60">
                  {members.map((assy) => (
                    <AssyRow
                      key={assy.assyNo}
                      assy={assy}
                      focused={focus.has(assy.assyNo)}
                      scrollTarget={scrollTo === assy.assyNo}
                    />
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
