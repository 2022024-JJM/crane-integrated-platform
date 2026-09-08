import { useTranslation } from '../../lib/i18n/useTranslation'
import type { InshopKey } from '../../lib/i18n/keys'
import { cn } from '../../lib/utils'
import type { StateTone } from './Skeleton'

/*
 * 빈 상태 — 보여 줄 것이 **없다**는 사실과 **왜 없는지**를 함께 내는 자리.
 *
 * "데이터가 없습니다" 한 줄은 사용자에게 아무것도 알려 주지 않는다. 조건을 좁혀서
 * 없는 것인지, 아직 수집이 닿지 않은 곳인지, 오늘 치 배치가 안 왔을 뿐인지에 따라
 * 다음에 할 일이 전혀 다르기 때문이다. 그래서 이 컴포넌트는 **원인(`reason`)** 을
 * 받아 그에 맞는 문구를 내고, 그 다음 행동(`action` 슬롯 — 초기화·다시 조회·다른
 * 화면으로)을 옆에 둔다.
 *
 * 문구는 원인별 기본값이 있고 호출부가 `title`/`description` 으로 덮어쓸 수 있다 —
 * 공정마다 부르는 이름이 달라서(정반/베이/블록) 기본 문구가 늘 맞지는 않는다.
 * 다만 **덮어쓰더라도 원인은 남긴다**: 색·아이콘·읽는 순서가 원인에 매여 있다.
 */

/**
 * 왜 비었는가.
 *
 *   `none`         원래 없다 — 이 공장에 설비가 없는 것처럼 조건과 무관한 부재
 *   `filtered`     고른 조건에 걸리는 것이 없다 — 조건을 풀면 나온다
 *   `notCollected` 수집이 아직 이 자리에 닿지 않았다 — 시스템 쪽 사정
 *   `batchPending` 오늘 배치가 아직 도착하지 않았다 — 레거시 일괄 등록(하루 1회) 대기
 */
export type EmptyReason = 'none' | 'filtered' | 'notCollected' | 'batchPending'

const TITLE_KEY: Record<EmptyReason, InshopKey> = {
  none: 'states.empty.none.title',
  filtered: 'states.empty.filtered.title',
  notCollected: 'states.empty.notCollected.title',
  batchPending: 'states.empty.batchPending.title',
}

const DESCRIPTION_KEY: Record<EmptyReason, InshopKey> = {
  none: 'states.empty.none.description',
  filtered: 'states.empty.filtered.description',
  notCollected: 'states.empty.notCollected.description',
  batchPending: 'states.empty.batchPending.description',
}

export interface EmptyStateProps {
  reason?: EmptyReason
  /** 기본 문구를 덮어쓴다 (공정이 부르는 이름이 따로 있을 때) */
  title?: React.ReactNode
  /** 원인 설명 — `null` 을 주면 제목만 남는다 */
  description?: React.ReactNode | null
  /** 행동 유도 슬롯 — 버튼·링크. 없으면 자리를 만들지 않는다 */
  action?: React.ReactNode
  tone?: StateTone
  /** `sm` 은 카드 안의 작은 칸(패널 구획·수치 상자)용 — 여백과 글자를 줄인다 */
  size?: 'sm' | 'md'
  className?: string
}

/** 원인을 한 획으로 — 아이콘이 아니라 **점선 테두리와 잉크 농도**가 상태를 말한다 */
export function EmptyState({
  reason = 'none',
  title,
  description,
  action,
  tone = 'surface',
  size = 'md',
  className,
}: EmptyStateProps) {
  const { t } = useTranslation()
  const headline = title ?? t(TITLE_KEY[reason])
  const body = description === null ? null : (description ?? t(DESCRIPTION_KEY[reason]))

  return (
    <div
      /* 빈 상태는 "지금 이렇게 됐다"는 알림이 아니라 그려진 결과다 — status 로만 알린다 */
      role="status"
      data-empty-reason={reason}
      className={cn(
        'flex flex-col items-center justify-center rounded-inshop-lg border border-dashed text-center',
        size === 'sm' ? 'gap-1 px-3 py-3' : 'gap-1.5 px-4 py-10',
        tone === 'glass' ? 'border-white/12 bg-white/[0.02]' : 'border-border bg-transparent',
        className,
      )}
    >
      <p
        className={cn(
          'font-medium',
          size === 'sm' ? 'text-2xs' : 'text-inshop-sm',
          tone === 'glass' ? 'text-white/70' : 'text-foreground/70',
        )}
      >
        {headline}
      </p>
      {body && (
        <p
          className={cn(
            'max-w-prose leading-relaxed',
            size === 'sm' ? 'text-[10px]' : 'text-inshop-xs',
            tone === 'glass' ? 'text-white/45' : 'text-foreground/50',
          )}
        >
          {body}
        </p>
      )}
      {action && <div className={cn(size === 'sm' ? 'mt-1' : 'mt-2.5')}>{action}</div>}
    </div>
  )
}

/**
 * '오늘 배치 미도착' — 레거시 일괄 등록을 기다리는 자리의 도메인 변형.
 *
 * 일일공정률(YPWG413M)처럼 **하루 1회 일괄 등록**되는 값은, 값이 비어 있는 것이 곧
 * 고장은 아니다. 아직 오늘 치가 안 온 것뿐이고 어제 치는 유효하다 — 그 둘을 갈라
 * 말해야 사용자가 "센서가 죽었나"로 읽지 않는다. 마지막으로 반영된 날짜를 받으면
 * 그 날짜까지 함께 낸다.
 */
export function BatchPendingState({
  asOf,
  description,
  action,
  tone,
  size = 'sm',
  className,
}: {
  /** 마지막으로 반영된 날짜 (없으면 아직 한 번도 오지 않은 것) */
  asOf?: string | null
  /**
   * 기본 설명을 덮어쓴다 — 값이 비는 대신 **무엇으로 물러섰는지**를 화면이 이미
   * 아는 자리가 있다(도장 카드는 완료 행 기준으로 물러선다). 그 사정을 여기 싣는다.
   */
  description?: React.ReactNode
  action?: React.ReactNode
  tone?: StateTone
  size?: 'sm' | 'md'
  className?: string
}) {
  const { t } = useTranslation()
  return (
    <EmptyState
      reason="batchPending"
      description={
        description ??
        (asOf
          ? t('states.empty.batchPending.lastArrived', { date: asOf })
          : t('states.empty.batchPending.description'))
      }
      action={action}
      tone={tone}
      size={size}
      className={className}
    />
  )
}
