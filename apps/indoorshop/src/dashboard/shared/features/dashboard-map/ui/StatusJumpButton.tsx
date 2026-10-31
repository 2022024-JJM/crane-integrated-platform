import { useTranslation } from '../../../lib/i18n/useTranslation'

/** 글자 앞 아이콘 — 무엇이 열리는지(설비 현황판·3D 뷰어·블록 실적)를 모양으로 */
export type StatusJumpIcon = 'status' | 'viewer' | 'performance'

function JumpIcon({ kind }: { kind: StatusJumpIcon }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    className: 'shrink-0',
  }
  if (kind === 'viewer') {
    /* 정육면체 — 3D 뷰어 */
    return (
      <svg {...common}>
        <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
        <path d="M4 7.5l8 4.5 8-4.5M12 12v9" />
      </svg>
    )
  }
  if (kind === 'performance') {
    /* 막대 — 블록·실적 */
    return (
      <svg {...common}>
        <path d="M4 20h16" />
        <path d="M7 16v-5M12 16V7M17 16v-8" />
      </svg>
    )
  }
  /* 칸 넷 — 설비 현황판 */
  return (
    <svg {...common}>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </svg>
  )
}

/** 글자 뒤 '↗' — 누르면 지금 화면 위에 **창이 열린다**는 표시 */
function OpenArrow() {
  return (
    <svg
      width={15}
      height={15}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0 opacity-80"
    >
      <path d="M7 17L17 7M9 7h8v8" />
    </svg>
  )
}

/**
 * 카드 머리의 **'현황'·'3D'·'실적'** 문 — 지금 카드가 말하는 공장·베이의 화면을 창으로 연다.
 *
 * 카드 **제목 바로 아래 줄**에 선다 — 무엇의 현황인지가 바로 위의 이름이다. 화면을 떠나지 않고
 * 창으로 띄운다(`ScreenPreviewDialog`) — 주소는 부르는 쪽이 드릴다운 계약으로 만들어
 * 준다(이 버튼은 공정 라우트를 모른다). 갈 곳이 없으면 호출부가 세우지 않는다.
 *
 * **버튼으로 읽혀야 한다**(사용자 지적: 글자 칩처럼 보였다) — 시안 E 로 확정했다: 또렷한
 * 테두리와 한 단 밝은 면에, 글자 **뒤에 '↗'** 를 붙여 "누르면 창이 열린다"를 말한다. 모서리는
 * 작게(4px) — 둥근 알약은 칩·태그로 읽혔다(사용자 확정). 카드 제목 **아래 줄**에 선다.
 * 글자 앞에는 무엇이 열리는지 아이콘(현황판·정육면체·막대)을 둔다.
 */
export function StatusJumpButton({
  title,
  onOpen,
  label,
  icon = 'status',
}: {
  /** 무엇의 현황인지 — 툴팁·보조기기 이름 */
  title: string
  /** 창 열기 */
  onOpen: () => void
  /** 버튼 글자 — 기본은 '현황'. 같은 자리·같은 모양의 다른 문('3D'·'실적')이 쓴다 */
  label?: string
  /** 글자 앞 아이콘 — 기본은 현황판 */
  icon?: StatusJumpIcon
}) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={onOpen}
      title={title}
      aria-label={title}
      className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded border border-white/30 bg-white/[0.12] pl-2.5 pr-2 text-inshop-sm font-semibold text-white transition-colors hover:border-white/50 hover:bg-white/[0.22] active:bg-white/[0.16] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
    >
      <JumpIcon kind={icon} />
      {label ?? t('dashboard.map.statusJump.label')}
      <OpenArrow />
    </button>
  )
}
