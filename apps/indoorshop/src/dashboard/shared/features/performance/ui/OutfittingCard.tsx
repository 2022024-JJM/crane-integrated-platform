import { Link } from 'react-router-dom'
import { useTranslation } from '../../../lib/i18n/useTranslation'
import type { InshopKey } from '../../../lib/i18n/keys'
import { cn } from '../../../lib/utils'
import { Card } from '../../../ui/atoms/Card'
import { STATUS_STYLE } from '../../../ui/statusPalette'
import { performanceLinkFor } from '../../../entities/vessel'
import type { AssyMatchState } from '../model/types'
import type { OutfittingOverall, OutfittingRow } from '../api/outfittingPerformance'

/*
 * 의장 — **블록 단위 판별 카드** (W7-11, 사용자 확정).
 *
 * 가공·도장에는 절점이 있어 카드가 단계로 갈리지만, 의장에는 없다 — 설치 판별 단건 수집이
 * 전부다. 그래서 **절점을 만들지 않고** 블록 한 줄에 판별 %를 놓는다. 없는 단계를 그려
 * 넣으면 그건 화면이 지어낸 구조이지 공정의 구조가 아니다.
 *
 * ⚠️ **계층이 없다.** 조립은 블록 아래 대조·중조·소조가 있고 카드가 그 트리를 그리지만,
 *    의장의 축은 블록 하나다(R1). 이 파일에 그 어휘가 들어오지 않게 한다.
 *
 * 수치는 **의장 공장 화면과 같은 원천**에서 온다(`api/outfittingPerformance` → 레지스트리).
 * 여기서 다시 세지 않는다 — 두 화면이 같은 블록을 두고 다른 %를 말하면 그 순간 둘 다
 * 못 믿게 된다.
 *
 * W/O 는 조립과 같은 문법으로 **참고**다: 판별이 원천이고 오더는 그 위의 주석이다.
 */

/*
 * 상태·'막 반입' 문구를 **이 카드가 갖는다.**
 *
 * 의장 화면에도 같은 낱말이 있지만 그 키는 의장 모듈 소유다 — shared 가 그걸 읽으면
 * "shared 는 특정 공정을 모른다" 는 경계가 깨진다(경계 검사기가 잡는다). 같은 낱말이
 * 두 네임스페이스에 사는 것은 그 경계의 값이다: 두 화면의 임자가 다르므로, 한쪽 문구를
 * 고칠 때 다른 쪽이 딸려 바뀌지 않는 편이 맞다.
 */
const STATUS_KEY: Record<OutfittingRow['status'], InshopKey> = {
  waiting: 'performance.ofit.status.waiting',
  in_progress: 'performance.ofit.status.inProgress',
  completed: 'performance.ofit.status.completed',
}

const STATUS_INK: Record<OutfittingRow['status'], string> = {
  waiting: 'text-foreground/50',
  in_progress: STATUS_STYLE.inProgress.ink,
  completed: STATUS_STYLE.done.ink,
}

const STATUS_FILL: Record<OutfittingRow['status'], string> = {
  waiting: 'bg-foreground/25',
  in_progress: STATUS_STYLE.inProgress.fill,
  completed: STATUS_STYLE.done.fill,
}

/* 매칭 배지 — 조립 카드와 **같은 키·같은 색 무게**를 쓴다(참고는 테두리만, 불일치만 채움) */
const MATCH_KEY: Record<AssyMatchState, InshopKey> = {
  matched: 'performance.asm.matchState.matched',
  fallback: 'performance.asm.matchState.fallback',
  unmatched: 'performance.asm.matchState.unmatched',
}

const MATCH_NOTE_KEY: Record<AssyMatchState, InshopKey> = {
  matched: 'performance.asm.matchStateNote.matched',
  fallback: 'performance.asm.matchStateNote.fallback',
  unmatched: 'performance.asm.matchStateNote.unmatched',
}

const MATCH_CLASS: Record<AssyMatchState, string> = {
  matched: 'border border-border text-foreground/55',
  fallback: `border border-status-degraded/50 ${STATUS_STYLE.warning.ink}`,
  unmatched: `border border-status-unhealthy/50 ${STATUS_STYLE.error.chip}`,
}

function BlockRow({ row, active }: { row: OutfittingRow; active: boolean }) {
  const { t } = useTranslation()
  return (
    <li>
      <Link
        to={performanceLinkFor({ projNo: row.projNo, blocks: [row.blockNo] })}
        className={cn(
          'flex flex-wrap items-center gap-x-3 gap-y-1 rounded-inshop-md px-2 py-1.5 transition-colors',
          'hover:bg-surface-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          active && 'bg-surface-secondary'
        )}
      >
        <span className="w-24 shrink-0 truncate font-mono text-inshop-xs text-foreground">{row.key}</span>
        <span className="w-28 shrink-0 truncate text-2xs text-foreground/55">{row.areaName}</span>
        <span className="w-10 shrink-0 font-mono text-2xs text-foreground/45">{row.wstgCode}</span>
        <span className={cn('w-12 shrink-0 text-2xs font-medium', STATUS_INK[row.status])}>
          {t(STATUS_KEY[row.status])}
        </span>
        {/* 갓 반입은 '대기 0%' 가 정상인 자리다 — 손도 안 댄 것과 갈라 준다 */}
        {row.justArrived && (
          <span className="shrink-0 rounded border border-accent/40 bg-accent/10 px-1.5 py-px text-2xs font-medium text-accent">
            {t('performance.ofit.justArrived')}
          </span>
        )}

        <div className="min-w-[6rem] flex-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-secondary">
            <span
              className={cn('block h-full rounded-full', STATUS_FILL[row.status])}
              style={{ width: `${Math.min(100, row.judgedRate)}%` }}
            />
          </div>
        </div>
        {/* 이 줄이 답하는 수치 하나 — 판별 % */}
        <span className="w-12 shrink-0 text-right font-mono text-inshop-sm font-semibold tabular-nums text-foreground">
          {Math.round(row.judgedRate)}
          <span className="text-2xs font-normal text-foreground/45">%</span>
        </span>

        {/* 오더는 참고 — 색 무게로도 곁다리임이 드러난다(조립 카드와 같은 규칙) */}
        <span
          title={t(MATCH_NOTE_KEY[row.orderMatch])}
          className={cn(
            'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium',
            MATCH_CLASS[row.orderMatch]
          )}
        >
          {t(MATCH_KEY[row.orderMatch])}
        </span>
        <span aria-hidden="true" className="shrink-0 text-2xs text-foreground/35">
          →
        </span>
      </Link>
    </li>
  )
}

export function OutfittingCard({
  rows,
  overall,
  activeBlock,
}: {
  rows: readonly OutfittingRow[]
  overall: OutfittingOverall
  /** 지금 고른 블록 — 목록에서 그 줄을 짚어 준다 */
  activeBlock?: string | null
}) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-3">
      {/* ── 종합 — 게이지 하나. 절점이 없으므로 단계 카드도 없다 ── */}
      <Card className="flex flex-wrap items-center gap-x-6 gap-y-2 bg-surface-secondary/40 p-3.5">
        <div>
          <div className="text-[11px] text-foreground/55">{t('performance.ofit.overall')}</div>
          <div className="text-inshop-2xl font-semibold tabular-nums text-accent">
            {overall.judgedRate}
            <span className="text-inshop-sm text-foreground/45">%</span>
          </div>
        </div>
        <div>
          <div className="text-[11px] text-foreground/55">{t('performance.ofit.blocks')}</div>
          <div className="text-inshop-2xl font-semibold tabular-nums">
            {overall.inProgress}
            <span className="text-inshop-sm text-foreground/45">/{overall.blockCount}</span>
          </div>
        </div>
        {overall.justArrived > 0 && (
          <div>
            <div className="text-[11px] text-foreground/55">
              {t('performance.ofit.justArrived')}
            </div>
            <div className="text-inshop-2xl font-semibold tabular-nums text-foreground/70">
              {overall.justArrived}
            </div>
          </div>
        )}
        <div className="ml-auto max-w-80 text-[10px] leading-4 text-foreground/45">
          {t('performance.ofit.noNodeNote')}
          <div>{t('performance.ofit.meanNote', { count: overall.blockCount })}</div>
        </div>
      </Card>

      {/* ── 블록 목록 — 의장의 축은 블록 하나다(계층 없음) ── */}
      <Card className="p-3">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-inshop-sm font-semibold text-foreground">{t('performance.ofit.listTitle')}</h3>
          <span className="text-2xs text-foreground/50">{t('performance.ofit.basis')}</span>
        </div>
        {rows.length === 0 ? (
          <p className="px-2 py-6 text-center text-inshop-sm text-foreground/45">
            {t('performance.ofit.empty')}
          </p>
        ) : (
          <ul>
            {rows.map((row) => (
              <BlockRow key={row.key} row={row} active={row.blockNo === activeBlock} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
