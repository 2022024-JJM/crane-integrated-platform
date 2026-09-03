import { Link } from 'react-router-dom'
import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import { cn } from '../../../shared/lib/utils'
import { performanceLinkFor } from '../../../shared/entities/vessel'
import { STATUS_STYLE } from '../../../shared/ui/statusPalette'
import type { OutfittingWipBlock } from '../../../shared/model/processModule'

/*
 * **진행중 판별** 구획 — 이 공장에서 지금 판별이 돌고 있는 블록 (W8-4).
 *
 * R15 때 의장에는 이 구획을 세우지 않았다. 그때 근거는 "판별 축이 조립뿐이라 의장 블록의
 * 진행중 집합이 구조적으로 0건" 이었는데, 곧이어 W7-11 이 **의장 판별 %(라이다 기반)** 를
 * 세우면서 그 근거가 사라졌다. 이제 셀 것이 있다.
 *
 * **아래 블록 목록과 역할이 다르다** — 같은 데이터를 두 번 그리는 것이 아니다:
 *   · 이 구획 = **판별 렌즈의 요약.** 지금 돌고 있는 것만, 판별 % 축으로, 통합실적으로
 *     나가는 문과 함께. "여기서 지금 무엇이 만들어지고 있나" 하나에 답한다.
 *   · 블록 목록 = **전체.** 대기·진행중·완료를 구역별로 묶어 "이 공장에 무엇이 있나" 에
 *     답한다. 완료된 블록도, 갓 반입돼 아직 시작 안 한 블록도 거기 있어야 한다.
 *
 * 수치는 통합실적 의장 카드와 **같은 함수**(`api/wipBlocks`)를 지난다 — 여기서 다시 세지
 * 않는다. 두 화면이 같은 블록을 두고 다른 %를 말하면 그 순간 둘 다 못 믿게 된다.
 */

function JudgingRow({ block }: { block: OutfittingWipBlock }) {
  const { t } = useTranslation()
  return (
    <li>
      <Link
        to={performanceLinkFor({ projNo: block.projNo, blocks: [block.blockNo] })}
        title={t('common.viewPerformanceHint', {
          block: `${block.projNo}-${block.blockNo}`,
        })}
        className="flex items-center gap-3 rounded-inshop-md px-2 py-1.5 transition-colors hover:bg-surface-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <span className="w-24 shrink-0 truncate font-mono text-inshop-xs text-foreground">
          {block.projNo}-{block.blockNo}
        </span>
        <span className="w-28 shrink-0 truncate text-2xs text-foreground/55">{block.areaName}</span>
        <span className="w-10 shrink-0 font-mono text-2xs text-foreground/45">
          {block.wstgCode}
        </span>
        <div className="min-w-0 flex-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-secondary">
            <span
              className={cn('block h-full rounded-full', STATUS_STYLE.inProgress.fill)}
              style={{ width: `${Math.min(100, block.judgedRate)}%` }}
            />
          </div>
        </div>
        {/* 이 줄이 답하는 수치 하나 — 판별 % */}
        <span className="w-12 shrink-0 text-right font-mono text-inshop-sm font-semibold tabular-nums text-foreground">
          {Math.round(block.judgedRate)}
          <span className="text-2xs font-normal text-foreground/45">%</span>
        </span>
        <span aria-hidden="true" className="shrink-0 text-2xs text-foreground/35">
          →
        </span>
      </Link>
    </li>
  )
}

export function JudgingBlockList({
  blocks,
  className,
}: {
  blocks: readonly OutfittingWipBlock[]
  className?: string
}) {
  const { t } = useTranslation()

  return (
    <section className={cn('rounded-inshop-lg border border-border bg-surface p-3', className)}>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-inshop-sm font-semibold text-foreground">
          {t('outfitting.judging.title')}{' '}
          <span className="font-normal text-foreground/54">{blocks.length}</span>
        </h3>
        <span className="text-2xs text-foreground/50">{t('outfitting.judging.basis')}</span>
      </div>

      {blocks.length === 0 ? (
        /* 비어 있는 것이 정상인 공장이 있다 — 왜 비었는지를 말한다(빈 자리로 두지 않는다) */
        <p className="px-2 py-6 text-center text-inshop-sm text-foreground/45">
          {t('outfitting.judging.empty')}
        </p>
      ) : (
        <>
          <ul>
            {blocks.map((block) => (
              <JudgingRow key={`${block.projNo}-${block.blockNo}`} block={block} />
            ))}
          </ul>
          <p className="mt-2 px-2 text-2xs leading-relaxed text-foreground/40">
            {t('outfitting.judging.note')}
          </p>
        </>
      )}
    </section>
  )
}
