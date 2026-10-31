import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from '../../../lib/i18n/useTranslation'
import type { InshopKey } from '../../../lib/i18n/keys'
import { Link } from 'react-router-dom'
import { cn } from '../../../lib/utils'
import { STATUS_STYLE } from '../../../ui/statusPalette'
import { Card } from '../../../ui/atoms/Card'
import { assyTreeOrder } from '../model/aggregate'
import type { AssemblySummary, AssyMatch, AssyUnit, AssyWo } from '../model/types'
import { pcdHrefOfAssy } from '../../../entities/vessel'
import { AxisIcon } from '../../../ui/icons'

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
 * 나열은 **급마다 한 단**이다(사용자 확정) — 대조 → 중조 → 소조를 위에서 아래로 쌓는다. ASSY 하나가
 * 카드 하나이고, 대조를 누르면 아래 단에 그 하위 중조가, 중조를 누르면 그 아래 단에 하위 소조가 선다.
 * 예전에는 대조 한 그룹 카드 안에 중조·소조를 들여쓰기로 다 넣어 한 카드가 너무 길었다.
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
  done: STATUS_STYLE.done.chip,
  inProgress: STATUS_STYLE.inProgress.chip,
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

/**
 * 고른 카드 + 하위 단 묶음의 테두리 · 바탕 — 바탕은 **불투명**이어야 한다: 고른 카드의 탭이 아래 칸의 윗변을
 * 같은 색으로 덮어 한 장으로 잇기 때문이다. 바깥(대조) 묶음이 조금 진하고, 안쪽(중조) 묶음은 옅다.
 */
const FRAME_TONE: Record<0 | 1, string> = {
  0: 'border-accent/50 bg-[color-mix(in_srgb,var(--color-accent)_5%,var(--color-background))]',
  1: 'border-accent/35 bg-[color-mix(in_srgb,var(--color-accent)_9%,var(--color-background))]',
}

/** 판별 상태 — 기준 축이라 ASSY 줄에서 가장 먼저 읽히는 자리에 둔다 */
const JUDGE_KEY: Record<AssyUnit['judged'], InshopKey> = {
  complete: 'performance.asm.judgeStatus.complete',
  partial: 'performance.asm.judgeStatus.partial',
  none: 'performance.asm.judgeStatus.none',
}

const JUDGE_CLASS: Record<AssyUnit['judged'], string> = {
  complete: STATUS_STYLE.done.chip,
  /* 부분 판별은 '아직 도는 중'이다 — 강조색을 쓰면 확인 필요(빨강)와 한 덩어리가 된다 */
  partial: STATUS_STYLE.inProgress.chip,
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
  /* 대체 매칭은 '확인이 필요한' 것이지 강조가 아니다 — 주의색(앰버)을 테두리로만 */
  fallback: `border border-status-degraded/50 ${STATUS_STYLE.warning.ink}`,
  unmatched: `border border-status-unhealthy/50 ${STATUS_STYLE.error.chip}`,
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
        <span aria-hidden className="w-6 shrink-0" />
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
              <span aria-hidden className="w-6 shrink-0" />
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
/**
 * 진행중 줄 → 소재 정반의 PCD 뷰 (W8-3) — 공장 현황→통합실적의 역방향 다리.
 * 소재(로스터 ASSY 자리·블록 정반)를 모르면 세우지 않는다 — 지어내지 않는다.
 */
function PcdViewLink({ assyNo, block }: { assyNo: string; block: string }) {
  const { t } = useTranslation()
  const href = pcdHrefOfAssy(assyNo)
  if (!href) return null
  return (
    <Link
      to={href}
      title={t('performance.pcdViewHint', { block })}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded border border-border px-1.5 py-0.5',
        'text-[10px] font-medium text-foreground/60 transition-colors',
        'hover:border-accent/50 hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/70'
      )}
    >
      <AxisIcon size={10} />
      {t('performance.pcdView')}
    </Link>
  )
}

function AssyRow({
  assy,
  focused,
  scrollTarget,
  selected = false,
  childCount = 0,
  childTier,
  onSelect,
}: {
  assy: AssyUnit
  focused: boolean
  scrollTarget: boolean
  /** 이 카드를 골라 하위 열이 서 있는가 */
  selected?: boolean
  /** 하위(다음 열) ASSY 수 — 0 이면 고를 것이 없다 */
  childCount?: number
  childTier?: AssyUnit['tier']
  /** 누르면 다음 열에 하위를 세운다 — 없으면 고를 수 없는 카드(소조) */
  onSelect?: () => void
}) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (scrollTarget) ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [scrollTarget])
  const selectable = onSelect != null
  return (
    <div
      ref={ref}
      id={`assy-${assy.assyNo}`}
      data-assy-card={assy.tier}
      {...(selectable
        ? {
            role: 'button',
            tabIndex: 0,
            'aria-pressed': selected,
            onClick: onSelect,
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.target !== e.currentTarget) return
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelect()
              }
            },
          }
        : {})}
      className={cn(
        /* 폭은 내용만큼(왼쪽 글·오른쪽 글 사이 여백 1.5rem 을 둔 폭) — 사용자 확정. 최소 폭은 보통 카드의 가장
           넓은 내용보다 조금 넓게 둔다: 하위 단이 열리며 더 넓은 카드가 나타나도 맞춘 폭이 바뀌지 않아 **카드가
           제자리에 있다**(사용자 확정: 위치를 옮기지 않는다). 그보다 넓은 내용일 때만 폭이 커진다 */
        'flex w-max min-w-[24rem] max-w-full flex-col rounded-inshop-lg border bg-surface p-3 transition-colors',
        selectable && 'cursor-pointer hover:border-accent/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        /* 고른 카드는 테두리만이 아니라 바탕까지 칠한다 — 아래 단이 어느 카드의 하위인지 한눈에(사용자 지적) */
        selected ? 'border-accent bg-accent/[0.09] ring-1 ring-accent/50' : 'border-border',
        assy.done && !selected && 'border-status-healthy/35',
        assy.blockedByMatch && !selected && 'border-status-unhealthy/40',
        /* 딥링크·지도 마커가 지목한 ASSY — 열에서 눈으로 찾을 수 있어야 한다 */
        focused && !selected && 'bg-accent/[0.05]'
      )}
    >
      {/* 급(대조·중조·소조)은 단 머리가 말하므로 카드 안에는 적지 않는다(사용자 확정) */}
      <div className="flex items-baseline gap-2 whitespace-nowrap">
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
        <span aria-hidden className="w-6 shrink-0" />
        <span
          className={cn(
            'ml-auto rounded px-1.5 py-0.5 text-[10px] font-medium',
            JUDGE_CLASS[assy.judged]
          )}
        >
          {t(JUDGE_KEY[assy.judged])}
        </span>
        {/* 진행중(미완료)만 — 완료된 덩이는 자리가 곧 비워질 것이라 문을 세우지 않는다 */}
        {!assy.done && <PcdViewLink assyNo={assy.assyNo} block={assy.assyNo} />}
      </div>

      {/* 판별 인식 — 분자가 우리 수집, 분모는 계획(REQ_QTY)이라 라벨이 그 사실을 적는다 */}
      <div className="mt-1.5 flex min-w-0 items-baseline gap-2">
        <span className="shrink-0 text-inshop-xl font-semibold tabular-nums">
          {assy.recognizedQty}
          <span className="text-inshop-sm text-foreground/45">/{assy.reqQty}</span>
        </span>
        {/* 좁은 카드에서 줄을 깨지 않게 — 넘치면 말줄임, 전체 문구는 툴팁 */}
        <span className="whitespace-nowrap text-[10px] text-foreground/45">
          {t('performance.asm.counting')}
        </span>
        {/* ASSY 단위 실적률 — 이 한 덩이의 진척 */}
        <span
          title={t('performance.asm.selfRateNote')}
          className="shrink-0 rounded bg-surface-secondary px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-foreground/70"
        >
          {assy.selfRate}%
        </span>
        {assy.judgedDate && <span aria-hidden className="w-6 shrink-0" />}
        {assy.judgedDate && (
          <span className="ml-auto shrink-0 whitespace-nowrap text-[10px] tabular-nums text-foreground/40">
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
              ? STATUS_STYLE.error.fill
              : assy.done
                ? STATUS_STYLE.done.fill
                : STATUS_STYLE.inProgress.fill
          )}
          style={{
            width: `${assy.reqQty === 0 ? 0 : Math.min(100, (assy.recognizedQty / assy.reqQty) * 100)}%`,
          }}
        />
      </div>

      <MatchBlock match={assy.match} />

      {/* 고를 수 있는 카드는 다음 열에 무엇이 서는지 적는다 */}
      {selectable && childTier && (
        /* 높이를 맞춘 카드에서 이 줄은 늘 바닥에 — 카드마다 같은 자리에 선다 */
        <div className={cn('mt-auto flex items-center justify-between pt-2 text-[11px]', selected ? 'text-accent' : 'text-foreground/50')}>
          <span>{t('performance.asm.childCount', { tier: t(TIER_KEY[childTier]), count: childCount })}</span>
          <span aria-hidden>›</span>
        </div>
      )}
    </div>
  )
}

/**
 * 카드 크기 맞추기 — **폭은 모든 단을 통틀어 가장 넓은 카드**에, **높이는 같은 단에서 가장 긴 카드**에
 * 맞춘다(사용자 확정). 카드 폭이 내용에서 나오므로 CSS 그리드의 열·행 맞춤으로는 못 한다 — 그린 뒤 재서
 * 가장 큰 값을 준다. 크기가 바뀌거나 단의 카드가 바뀌면 다시 잰다.
 */
function useUniformCards(ref: React.RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return
    const measure = () => {
      const cards = [...root.querySelectorAll<HTMLElement>('[data-assy-card]')]
      for (const card of cards) {
        card.style.width = ''
        card.style.minHeight = ''
      }
      /* 폭 — 전부 같은 폭(가장 넓은 카드), 단 칸 폭을 넘지는 않는다 */
      const widest = Math.max(0, ...cards.map((card) => card.getBoundingClientRect().width))
      const limit = root.getBoundingClientRect().width
      for (const card of cards) card.style.width = `${Math.min(widest, limit)}px`
      /* 높이 — 폭을 맞춘 뒤 급(대조 · 중조 · 소조)마다 가장 긴 카드에. 고른 카드는 묶음 안에 서도 같은 급과 맞춘다 */
      for (const tier of ['grand', 'mid', 'sub']) {
        const own = cards.filter((card) => card.dataset.assyCard === tier)
        const tallest = Math.max(0, ...own.map((card) => card.getBoundingClientRect().height))
        for (const card of own) card.style.minHeight = `${tallest}px`
      }
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => measure())
    observer.observe(root)
    return () => observer.disconnect()
  })
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
  const focus = useMemo(() => new Set(focusAssys ?? []), [focusAssys])
  /* 모든 카드 같은 폭, 단마다 같은 높이 */
  const tiersRef = useRef<HTMLDivElement>(null)
  useUniformCards(tiersRef)
  /* 스크롤 목표는 트리 순서상 첫 번째 포커스 ASSY 하나 — 여럿이 서로 스크롤을 뺏지 않게 */
  const scrollTo = useMemo(
    () => assyTreeOrder(summary.assys).find((u) => focus.has(u.assyNo))?.assyNo ?? null,
    [summary.assys, focus]
  )

  /* 급마다 한 열 — 부모 → 자식 목록. 트리 순서(pre-order)를 지켜 같은 부모의 자식이 늘 같은 차례로 선다 */
  const ordered = useMemo(() => assyTreeOrder(summary.assys), [summary.assys])
  const byNo = useMemo(() => new Map(ordered.map((u) => [u.assyNo, u])), [ordered])
  const childrenOf = useMemo(() => {
    const map = new Map<string, AssyUnit[]>()
    for (const u of ordered) {
      if (!u.parentAssyNo) continue
      const list = map.get(u.parentAssyNo) ?? []
      list.push(u)
      map.set(u.parentAssyNo, list)
    }
    return map
  }, [ordered])
  const grands = useMemo(() => ordered.filter((u) => u.tier === 'grand'), [ordered])

  /* 지목된 ASSY(딥링크)가 있으면 그 조상 줄을 골라 둔 채로 연다 — 지목해 놓고 숨기면 링크가 헛돈다 */
  const ancestry = useMemo(() => {
    const first = ordered.find((u) => focus.has(u.assyNo))
    const chain: AssyUnit[] = []
    for (let u = first; u; u = u.parentAssyNo ? byNo.get(u.parentAssyNo) : undefined) chain.unshift(u)
    return {
      grand: chain.find((u) => u.tier === 'grand')?.assyNo ?? null,
      mid: chain.find((u) => u.tier === 'mid')?.assyNo ?? null,
    }
  }, [ordered, focus, byNo])
  const [pickedGrand, setPickedGrand] = useState<string | null>(null)
  const [pickedMid, setPickedMid] = useState<string | null>(null)
  /* 처음(검색만 했을 때)에는 아무 대조도 고르지 않는다(사용자 확정) — 대조 단만 서고, 누르면 그 중조가 선다.
     딥링크가 ASSY 를 지목했으면 그 조상은 골라 둔다 */
  const grandNo = pickedGrand ?? ancestry.grand ?? null
  const mids = useMemo(() => (grandNo ? (childrenOf.get(grandNo) ?? []).filter((u) => u.tier === 'mid') : []), [childrenOf, grandNo])
  const midNo = pickedMid && mids.some((m) => m.assyNo === pickedMid) ? pickedMid : pickedGrand ? null : ancestry.mid
  /* 소조 — 고른 중조의 자식. 중조 없이 대조에 바로 붙은 소조가 있으면 중조를 고르기 전까지 그것을 보인다 */
  const subs = useMemo(() => {
    if (midNo) return (childrenOf.get(midNo) ?? []).filter((u) => u.tier === 'sub')
    return grandNo ? (childrenOf.get(grandNo) ?? []).filter((u) => u.tier === 'sub') : []
  }, [childrenOf, midNo, grandNo])

  const pickGrand = (no: string) => {
    setPickedGrand(no)
    setPickedMid(null)
  }

  /* 카드가 하나도 없는 단은 아예 세우지 않는다(사용자 확정) — 다음 단으로 갈 카드는 바닥 줄(「소조 n ›」)이 알린다 */
  /*
   * 하위 단은 **누구의 하위인지** 머리에 적는다. 위 단과의 묶음은 들여쓰기가 아니라 테두리(`frame`)가 말한다
   * (사용자 확정: 왼쪽 들여쓰기는 없애고, 하위 단을 상위 단과 함께 한 테두리로 묶는다).
   */
  const column = (
    tier: AssyUnit['tier'],
    items: AssyUnit[],
    render: (u: AssyUnit) => React.ReactNode,
    parent?: AssyUnit | null,
    /** 이 단에서 고른 카드와 그 아래에 펼 하위 단 — 주면 고른 카드와 하위 단이 한 테두리로 이어진다 */
    open?: { no: string | null; children: React.ReactNode; depth: 0 | 1 }
  ) =>
    items.length === 0 ? null : (
      <section
        aria-label={t(TIER_KEY[tier])}
        className="flex min-w-0 flex-col gap-1.5"
      >
      <div className="flex flex-wrap items-center gap-2 px-0.5">
        <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-semibold', TIER_CLASS[tier])}>{t(TIER_KEY[tier])}</span>
        <span className="text-[11px] tabular-nums text-foreground/45">{items.length}</span>
        {parent && (
          <span className="text-[11px] text-accent">
            ↳ <span className="font-mono font-semibold tabular-nums">{parent.assyNo}</span>{' '}
            {t('performance.asm.childrenOf', { tier: t(TIER_KEY[parent.tier]) })}
          </span>
        )}
      </div>
      {/* 한 급의 카드는 가로로 나란히(넘치면 다음 줄) — 급은 위에서 아래로 쌓인다.
          카드 폭은 모든 단을 통틀어 가장 넓은 카드에, 높이는 그 단에서 가장 긴 카드에 맞춘다(사용자 확정, useUniformCards) */}
      {/* 카드 폭은 내용에서 나온다(왼쪽·오른쪽 글 사이 여백만 둔 폭) — 그중 가장 넓은 것으로 모두 맞춘다. 넘치면 다음 줄 */}
      {/*
        카드마다 같은 크기의 테두리 자리(투명)를 늘 둔다 — 고르면 그 자리만 색이 들어 **위치가 움직이지 않는다**
        (사용자 확정). 고른 카드의 자리는 폴더 탭처럼 아래가 열려, 바로 밑 하위 단 칸의 테두리와 한 장으로 잇는다.
      */}
      {/* 줄과 아래 칸 사이는 띄우지 않는다 — 고른 카드의 탭이 칸의 윗변과 붙어야 한 장으로 읽힌다 */}
      <div className="flex min-w-0 flex-col">
        <div className="flex flex-wrap items-end gap-1">
          {items.map((u) => {
            const joined = open != null && open.children != null && u.assyNo === open.no
            return (
              <div
                key={u.assyNo}
                className={cn(
                  /* 여백은 조금만(사용자 확정) — 테두리가 카드 윤곽을 바짝 따라간다 */
                  'relative rounded-t-inshop-xl border-2 border-b-0 px-1 pt-1 pb-1.5',
                  joined ? cn('z-10', FRAME_TONE[open.depth]) : 'border-transparent'
                )}
              >
                {render(u)}
              </div>
            )
          })}
        </div>
        {open?.children != null && open.no != null && (
          <div
            data-assy-frame={open.depth}
            className={cn(
              /* 폭은 안의 카드만큼 — 오른쪽 끝까지 늘이지 않고 마지막 카드에 맞춘다(사용자 확정) */
              '-mt-[2px] flex w-fit min-w-0 max-w-full flex-col gap-3 self-start rounded-inshop-xl border-2 p-2',
              /* 고른 카드가 줄 맨 앞이면 탭의 왼쪽 선과 칸의 왼쪽 선이 한 줄로 이어진다 — 그 모서리는 둥글리지 않는다 */
              items[0]?.assyNo === open.no && 'rounded-tl-none',
              FRAME_TONE[open.depth]
            )}
          >
            {open.children}
          </div>
        )}
      </div>
    </section>
  )

  const grandCard = (u: AssyUnit) => {
    const mids = (childrenOf.get(u.assyNo) ?? []).filter((c) => c.tier === 'mid')
    return (
      <AssyRow
        key={u.assyNo}
        assy={u}
        focused={focus.has(u.assyNo)}
        scrollTarget={scrollTo === u.assyNo}
        selected={u.assyNo === grandNo}
        childTier="mid"
        childCount={mids.length}
        onSelect={() => pickGrand(u.assyNo)}
      />
    )
  }
  const midCard = (u: AssyUnit) => {
    const subsOf = (childrenOf.get(u.assyNo) ?? []).filter((c) => c.tier === 'sub')
    return (
      <AssyRow
        key={u.assyNo}
        assy={u}
        focused={focus.has(u.assyNo)}
        scrollTarget={scrollTo === u.assyNo}
        selected={u.assyNo === midNo}
        childTier="sub"
        childCount={subsOf.length}
        onSelect={() => setPickedMid(u.assyNo)}
      />
    )
  }
  /*
   * **고른 카드 + 그 하위 단만** 한 테두리로 묶는다(사용자 확정) — 옆 카드는 묶음 밖이고, 카드는 제자리다.
   * 고른 카드의 테두리(폴더 탭)가 바로 아래 하위 단 칸과 이어진다. 중조까지 고르면 그 안에서 한 겹 더.
   */
  const subTier = column('sub', subs, (u) => (
    <AssyRow key={u.assyNo} assy={u} focused={focus.has(u.assyNo)} scrollTarget={scrollTo === u.assyNo} />
  ), byNo.get(midNo ?? grandNo ?? '') ?? null)
  const midTier = column('mid', mids, midCard, grandNo ? byNo.get(grandNo) : null, {
    no: midNo,
    children: subTier,
    depth: grands.length > 0 ? 1 : 0,
  })
  /* 중조를 고르기 전에는 대조 바로 아래 소조(있으면)도 대조 묶음에 */
  const grandChildren = midTier || subTier ? (
    <>
      {midTier}
      {midNo ? null : subTier}
    </>
  ) : null
  const grandTier = column('grand', grands, grandCard, null, { no: grandNo, children: grandChildren, depth: 0 })
  /* 대조가 없는 블록은 중조가 맨 위 단이다 — 그 아래 소조는 고른 중조의 묶음 안에 선다 */
  const tiers = grands.length > 0 ? grandTier : mids.length > 0 ? midTier : subTier

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

      {/* ── 급마다 한 단 — 대조 → 중조 → 소조를 위에서 아래로(사용자 확정: 세로 나열).
             대조를 누르면 아래 단에 그 중조가, 중조를 누르면 그 아래 단에 소조가 선다 ── */}
      <div ref={tiersRef} className="flex flex-col gap-4">
        {tiers}
      </div>
    </div>
  )
}
