import { cn } from '../../lib/utils'
import { StatusGoodIcon, StatusWarningIcon, StatusCriticalIcon } from '../icons'

/**
 * 상태 표시의 단일 표현.
 *
 * - 색은 예약된 상태 토큰만 쓴다 (accent 계열 재사용 금지).
 * - 색 단독으로 의미를 나르지 않는다 — 항상 아이콘 + 라벨을 함께 낸다.
 *   (색각 이상·흑백 출력·forced-colors 에서도 상태가 읽혀야 한다)
 * - 채움 배지 + 흰 글씨는 쓰지 않는다. 상태색 위의 흰 글씨는 본문 대비
 *   4.5:1 을 통과하지 못한다. 대신 10% 틴트 배경 + 상태색 글씨로 낸다.
 */
export type ChipTone = 'good' | 'warning' | 'critical' | 'neutral'

const toneConfig: Record<ChipTone, { className: string; Icon: typeof StatusGoodIcon | null }> = {
  good: {
    className: 'bg-status-healthy/10 text-status-healthy',
    Icon: StatusGoodIcon,
  },
  warning: {
    className: 'bg-status-degraded/10 text-status-degraded',
    Icon: StatusWarningIcon,
  },
  critical: {
    className: 'bg-status-unhealthy/10 text-status-unhealthy',
    Icon: StatusCriticalIcon,
  },
  neutral: {
    className: 'bg-surface-secondary text-foreground/68',
    Icon: null,
  },
}

interface StatusChipProps {
  tone: ChipTone
  label: string
  /** 스크린리더용 보충 설명 (예: "상태: 실행 중") */
  title?: string
  className?: string
}

export function StatusChip({ tone, label, title, className }: StatusChipProps) {
  const { className: toneClassName, Icon } = toneConfig[tone]

  return (
    <span
      title={title}
      className={cn(
        // 라벨은 절대 줄바꿈하지 않는다 — "약/화" 처럼 끊기면 상태를 읽을 수 없다
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-inshop-md px-2 py-1 text-inshop-xs font-medium',
        toneClassName,
        className,
      )}
    >
      {Icon && <Icon size={13} className="shrink-0" />}
      {label}
    </span>
  )
}
