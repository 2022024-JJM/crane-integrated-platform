interface IconProps {
  className?: string
  size?: number
}

/**
 * 모든 아이콘은 stroke 1.75 규격으로 통일한다.
 * fill 기반 아이콘을 섞으면 같은 크기에서도 굵기가 들쭉날쭉해 보인다.
 */
function Icon({ className, size = 20, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

/**
 * 브랜드 마크 — 아이소메트릭 블록.
 *
 * 선으로만 그린 큐브는 19px 타일 안에서 철사처럼 가늘게 흩어진다. 그래서 면으로
 * 세우고 세 면의 밝기를 달리해 빛이 한쪽에서 드는 입체로 만든다 —
 * 이 제품이 다루는 것이 도면이 아니라 **정반 위에 실제로 놓인 덩어리**라는 뜻이다.
 *
 * 색은 currentColor 하나만 쓰고 면마다 투명도로 층을 낸다. 그래야 강조색 타일
 * 위에서든 흰 배경에서든 같은 마크로 읽힌다.
 */
export function BrandMark({ className, size = 30 }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      {/* 윗면 — 빛을 정면으로 받는다 */}
      <path d="M12 2.4 20.8 7.5 12 12.6 3.2 7.5z" />
      {/* 오른쪽 면 */}
      <path d="M21.4 8.55v8.4L12.6 22.05v-8.4z" opacity="0.75" />
      {/* 왼쪽 면 — 그늘 */}
      <path d="M2.6 8.55v8.4l8.8 5.1v-8.4z" opacity="0.45" />
    </svg>
  )
}

export function DashboardIcon({ className, size }: IconProps) {
  return (
    <Icon className={className} size={size}>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </Icon>
  )
}

/** 가공 — 절단선이 그어진 판재 */
export function FabricationIcon({ className, size }: IconProps) {
  return (
    <Icon className={className} size={size}>
      <rect x="3" y="6.5" width="18" height="11" rx="1.5" />
      <path d="M9 6.5v11" strokeDasharray="2 2.5" />
      <path d="M15 6.5v11" strokeDasharray="2 2.5" />
    </Icon>
  )
}

/** 조립 — 정반 위 블록 적층 */
export function AssemblyIcon({ className, size }: IconProps) {
  return (
    <Icon className={className} size={size}>
      <path d="M3.5 20.5h17" />
      <rect x="5.5" y="13" width="6" height="6" rx="1" />
      <rect x="12.5" y="13" width="6" height="6" rx="1" />
      <rect x="9" y="6.5" width="6" height="6" rx="1" />
    </Icon>
  )
}

/** 선행의장 — 렌치 */
export function OutfittingIcon({ className, size }: IconProps) {
  return (
    <Icon className={className} size={size}>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </Icon>
  )
}

/** 선행도장 — 스프레이 캔과 분사 입자 */
export function PaintingIcon({ className, size }: IconProps) {
  return (
    <Icon className={className} size={size}>
      <rect x="6" y="9" width="8" height="12" rx="1.5" />
      <path d="M8.5 9V6h3v3" />
      <path d="M17 4.5h.01M20 6h.01M17.5 8.5h.01M20.5 10h.01M18 12.5h.01" />
    </Icon>
  )
}

export function SettingsIcon({ className, size }: IconProps) {
  return (
    <Icon className={className} size={size}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Icon>
  )
}

export function SunIcon({ className, size }: IconProps) {
  return (
    <Icon className={className} size={size}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </Icon>
  )
}

export function MoonIcon({ className, size }: IconProps) {
  return (
    <Icon className={className} size={size}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </Icon>
  )
}

export function ComputerIcon({ className, size }: IconProps) {
  return (
    <Icon className={className} size={size}>
      <rect x="2.5" y="3.5" width="19" height="13" rx="2" />
      <path d="M8 20.5h8M12 16.5v4" />
    </Icon>
  )
}

/* 상태 글리프 — 상태는 색만으로 의미를 나르지 않는다(아이콘 + 라벨 동반). */

export function StatusGoodIcon({ className, size }: IconProps) {
  return (
    <Icon className={className} size={size}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" />
    </Icon>
  )
}

/**
 * 진행중 — 도는 시계.
 *
 * 완료(체크)·이상(엑스)과 **모양으로** 갈려야 한다. 색만으로 가르면 색각 이상에서
 * 세 상태가 한 덩어리가 된다(상태 팔레트의 색 단독 금지 규칙).
 */
export function StatusProgressIcon({ className, size }: IconProps) {
  return (
    <Icon className={className} size={size}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V12l3 2" />
    </Icon>
  )
}

export function StatusWarningIcon({ className, size }: IconProps) {
  return (
    <Icon className={className} size={size}>
      <path d="M12 3.5L21 19.5H3L12 3.5z" />
      <path d="M12 9.5v4M12 16.5h.01" />
    </Icon>
  )
}

export function StatusCriticalIcon({ className, size }: IconProps) {
  return (
    <Icon className={className} size={size}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9l6 6M15 9l-6 6" />
    </Icon>
  )
}

/** 사이드바 접기/펼치기 — 패널 모서리와 방향 화살표로 상태를 드러낸다 */
export function SidebarToggleIcon({
  className,
  size,
  collapsed = false,
}: IconProps & { collapsed?: boolean }) {
  return (
    <Icon className={className} size={size}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
      {collapsed ? <path d="M13.5 9.5l2.5 2.5-2.5 2.5" /> : <path d="M16 9.5L13.5 12l2.5 2.5" />}
    </Icon>
  )
}

export function AccountIcon({ className, size }: IconProps) {
  return (
    <Icon className={className} size={size}>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </Icon>
  )
}

export function ChevronDownIcon({ className, size }: IconProps) {
  return (
    <Icon className={className} size={size}>
      <path d="M6 9.5l6 6 6-6" />
    </Icon>
  )
}

export function MenuIcon({ className, size }: IconProps) {
  return (
    <Icon className={className} size={size}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Icon>
  )
}

export function CloseIcon({ className, size }: IconProps) {
  return (
    <Icon className={className} size={size}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Icon>
  )
}

export function ChevronRightIcon({ className, size }: IconProps) {
  return (
    <Icon className={className} size={size}>
      <path d="M9.5 6l6 6-6 6" />
    </Icon>
  )
}

export function CheckIcon({ className, size }: IconProps) {
  return (
    <Icon className={className} size={size}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </Icon>
  )
}

export function LogoutIcon({ className, size }: IconProps) {
  return (
    <Icon className={className} size={size}>
      <path d="M14.5 4.5h3a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-3" />
      <path d="M10 8.5L13.5 12 10 15.5" />
      <path d="M13.5 12h-9" />
    </Icon>
  )
}

export function BellIcon({ className, size }: IconProps) {
  return (
    <Icon className={className} size={size}>
      <path d="M18 8.75a6 6 0 1 0-12 0c0 5.25-2 6.75-2 6.75h16s-2-1.5-2-6.75" />
      <path d="M13.7 19.25a2 2 0 0 1-3.4 0" />
    </Icon>
  )
}

export function DocsIcon({ className, size }: IconProps) {
  return (
    <Icon className={className} size={size}>
      <path d="M13.5 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z" />
      <path d="M13.5 3.5V9H19" />
      <path d="M8.75 13h6.5M8.75 16.5h4.5" />
    </Icon>
  )
}

/** 뷰포트 축 표시 — 3D 좌표계를 나타내는 코너 트라이어드 */
export function AxisIcon({ className, size }: IconProps) {
  return (
    <Icon className={className} size={size}>
      <path d="M12 12V4" />
      <path d="M12 12l-7 4" />
      <path d="M12 12l7 4" />
      <circle cx="12" cy="12" r="1.4" />
    </Icon>
  )
}

/** 야드 — 구획(지번) 격자 위에 놓인 블록 하나 */
export function YardIcon({ className, size }: IconProps) {
  return (
    <Icon className={className} size={size}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1" />
      <circle cx="17" cy="17" r="1.8" fill="currentColor" stroke="none" />
    </Icon>
  )
}

export function ArrowLeftIcon({ className, size }: IconProps) {
  return (
    <Icon className={className} size={size}>
      <path d="M19 12H5" />
      <path d="M11 6l-6 6 6 6" />
    </Icon>
  )
}

export function SearchIcon({ className, size }: IconProps) {
  return (
    <Icon className={className} size={size}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" />
    </Icon>
  )
}

export function TextSizeIcon({ className, size }: IconProps) {
  return (
    <Icon className={className} size={size}>
      <path d="M3.5 8V6h8v2" />
      <path d="M7.5 6v12" />
      <path d="M5.5 18h4" />
      <path d="M13 12.5v-1.5h7.5v1.5" />
      <path d="M16.75 11v7" />
      <path d="M15 18h3.5" />
    </Icon>
  )
}

export function GlobeIcon({ className, size }: IconProps) {
  return (
    <Icon className={className} size={size}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17" />
      <path d="M12 3.5c2.2 2.3 3.4 5.3 3.4 8.5S14.2 18.2 12 20.5c-2.2-2.3-3.4-5.3-3.4-8.5S9.8 5.8 12 3.5z" />
    </Icon>
  )
}

/**
 * 지도 위의 한 자리를 짚는 핀 — 목록의 줄과 지도의 칸이 같은 곳을 가리킬 때 쓴다.
 * 지도 캔버스가 그 자리에 세우는 패(대 + 지번코드)의 목록 쪽 짝이다.
 */
export function PinIcon({ className, size }: IconProps) {
  return (
    <Icon className={className} size={size}>
      <path d="M12 21c4-4.4 6-7.7 6-10.4A6 6 0 006 10.6C6 13.3 8 16.6 12 21z" />
      <circle cx="12" cy="10.5" r="2.25" />
    </Icon>
  )
}
