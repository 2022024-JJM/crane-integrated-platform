import { Link } from 'react-router-dom'
import { cn } from '../../lib/utils'

/**
 * 어디에 서는가 — 종이 위(`page`)냐 3D 위(`glass`)냐.
 * 두 자리는 바탕이 다를 뿐 **같은 문**이라, 모양·크기·눌림은 하나로 둔다.
 */
export type BackLinkTone = 'page' | 'glass'

interface BackLinkProps {
  /** 한 계단 위 화면의 경로 */
  to: string
  /** 칩에 적히는 그 화면의 이름 */
  label: string
  /** 툴팁 — 어디로 나가는지를 한 문장으로 */
  title?: string
  tone?: BackLinkTone
  className?: string
}

/**
 * **한 계단 위로 나가는 문.**
 *
 * 화면 안에서 들어왔으면 화면 안에 나오는 길이 있어야 하고, 그 길이 안 보이면 조작자는
 * 들어가기를 주저한다. 그래서 이 칩은 머리글(페이지)과 뷰포트 안(전체 화면) 두 자리에
 * 서는데, **한 번에 한 자리에만** 선다 — 페이지에는 머리글 칩이, 전체 화면에는 유리 칩이.
 * 둘을 동시에 세우면 같은 문이 한 화면에 둘이 되고, 어느 쪽을 눌러야 하는지가 매번
 * 질문이 된다.
 *
 * 진짜 `<a>` 다(브레드크럼과 같은 이유) — 가운데 클릭으로 새 탭에 열고 주소를 복사해
 * 건넬 수 있어야 "자리를 공유한다" 가 성립한다.
 *
 * 눌리는 느낌은 `pressable` 이 낸다: 색만 바뀌면 "가리키고 있다"로 읽히지, "눌렀다"로는
 * 읽히지 않는다. 화살표는 손이 올라오면 왼쪽으로 한 칸 물러서 **나가는 방향**을 먼저 말한다.
 */
/** 두 칩(링크·버튼)이 같은 모양·같은 눌림을 쓰도록 — 한 자리에서만 정한다 */
function chipClass(tone: BackLinkTone, className?: string): string {
  return cn(
    'group inline-flex h-7 max-w-full shrink-0 items-center gap-1 rounded-inshop-md px-2',
    'text-inshop-xs font-medium',
    'pressable',
    'focus:outline-none focus-visible:ring-2',
    tone === 'glass'
      ? [
          'glass-panel glass-pressable text-2xs',
          'hover:bg-glass-hover hover:text-glass-accent',
          'focus-visible:ring-glass-accent',
        ]
      : [
          /* 종이 위에서는 테두리가 높이를 낸다 — 눌리면 그 그림자를 접는다 */
          'border border-border bg-surface text-foreground/70 shadow-sm',
          'hover:border-accent/50 hover:text-accent',
          'active:shadow-none',
          'focus-visible:ring-accent',
        ],
    className,
  )
}

/** 물러나는 방향을 먼저 말하는 화살표 — 손이 올라오면 왼쪽으로 한 칸 */
function BackChevron() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 12 12"
      width={12}
      height={12}
      className="shrink-0 transition-transform duration-150 group-hover:-translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
    >
      <path
        d="M7.2 2.4 3.6 6l3.6 3.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function BackLink({ to, label, title, tone = 'page', className }: BackLinkProps) {
  return (
    <Link to={to} title={title} className={chipClass(tone, className)}>
      <BackChevron />
      <span className="truncate">{label}</span>
    </Link>
  )
}

interface BackActionProps {
  label: string
  title?: string
  onClick: () => void
  tone?: BackLinkTone
  className?: string
}

/**
 * **물러나되 화면을 떠나지 않는 문** — 같은 모양의 버튼.
 *
 * 공장 3D 의 `전체보기` 가 이것이다: 화면을 바꾸는 것이 아니라 카메라를 전 베이로
 * 물린다. 이름과 동작이 어긋나면("전체보기 인데 목록으로 나간다") 한 번 눌러 본 사람은
 * 그 다음부터 그 버튼을 안 믿는다 — 그래서 나가는 문(`BackLink`)과 **모양은 같게,
 * 요소는 다르게**(`<button>`) 둔다. 나가는 문은 새 탭에 열리고 이것은 안 열린다.
 */
export function BackAction({ label, title, onClick, tone = 'glass', className }: BackActionProps) {
  return (
    <button type="button" title={title} onClick={onClick} className={chipClass(tone, className)}>
      <BackChevron />
      <span className="truncate">{label}</span>
    </button>
  )
}
