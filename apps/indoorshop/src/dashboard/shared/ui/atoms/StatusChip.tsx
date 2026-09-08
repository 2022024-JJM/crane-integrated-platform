import { cn } from '../../lib/utils'
import {
  StatusGoodIcon,
  StatusProgressIcon,
  StatusWarningIcon,
  StatusCriticalIcon,
} from '../icons'
import { STATUS_STYLE, type StatusMeaning } from '../statusPalette'

/*
 * 상태 표시의 단일 표현.
 *
 * - 색은 예약된 상태 토큰만 쓴다 (accent 계열 재사용 금지). 어떤 색인지는 이 파일이
 *   모른다 — `statusPalette` 가 의미마다 하나씩 정해 둔 것을 가져다 쓸 뿐이다.
 * - 색 단독으로 의미를 나르지 않는다 — 항상 아이콘 + 라벨을 함께 낸다.
 *   (색각 이상·흑백 출력·forced-colors 에서도 상태가 읽혀야 한다)
 * - 채움 배지 + 흰 글씨는 쓰지 않는다. 상태색 위의 흰 글씨는 본문 대비
 *   4.5:1 을 통과하지 못한다. 대신 10% 틴트 배경 + 상태색 글씨로 낸다.
 */

/**
 * 칩의 톤 — 상태 의미(`StatusMeaning`)의 다른 이름이다.
 *
 * 색은 여기서 고르지 않는다. 의미→색은 `statusPalette` 한 곳이고 이 표는 그 의미에
 * 붙는 **아이콘**만 더한다. `progress`(진행중)는 감사 F-7 로 신설됐다 — 그전에는
 * 돌고 있는 일이 강조색(주황)이라 확인 필요(빨강)와 한 덩어리로 읽혔다.
 */
export type ChipTone = 'good' | 'progress' | 'warning' | 'critical' | 'neutral'

/** 톤 → 상태 의미. 색은 팔레트가 정한다 */
const TONE_MEANING: Record<ChipTone, StatusMeaning> = {
  good: 'done',
  progress: 'inProgress',
  warning: 'warning',
  critical: 'error',
  neutral: 'idle',
}

const toneIcon: Record<ChipTone, typeof StatusGoodIcon | null> = {
  good: StatusGoodIcon,
  progress: StatusProgressIcon,
  warning: StatusWarningIcon,
  critical: StatusCriticalIcon,
  neutral: null,
}

interface StatusChipProps {
  tone: ChipTone
  label: string
  /** 스크린리더용 보충 설명 (예: "상태: 실행 중") */
  title?: string
  className?: string
}

export function StatusChip({ tone, label, title, className }: StatusChipProps) {
  const toneClassName = STATUS_STYLE[TONE_MEANING[tone]].chip
  const Icon = toneIcon[tone]

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
