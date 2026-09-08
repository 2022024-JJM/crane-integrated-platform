import { cn } from '../../../shared/lib/utils'
import { useCompactTime } from '../lib/useCompactTime'

/**
 * 판별 현황판의 표·셀 조각.
 *
 * 이 화면은 표가 다섯 개다 — 머리글·셀 여백·모노 서체를 한 곳에서 정해 두지 않으면
 * 표마다 조금씩 다른 밀도로 서서 눈이 매번 다시 맞춰야 한다.
 */

/** `label` 은 표의 접근 가능한 이름 — 화면에 표가 다섯 개라 스크린리더·테스트가 이것으로 고른다 */
export function DataTable({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('overflow-x-auto rounded-inshop-lg border border-border', className)}>
      <table aria-label={label} className="w-full text-inshop-sm">
        {children}
      </table>
    </div>
  )
}

export function Th({
  children,
  align = 'left',
  className,
  title,
}: {
  children: React.ReactNode
  align?: 'left' | 'right'
  className?: string
  title?: string
}) {
  return (
    <th
      title={title}
      className={cn(
        'whitespace-nowrap px-3 py-2 text-inshop-xs font-semibold text-foreground/68',
        align === 'right' ? 'text-right' : 'text-left',
        className,
      )}
    >
      {children}
    </th>
  )
}

export function Td({
  children,
  align = 'left',
  mono = false,
  muted = false,
  className,
  title,
}: {
  children: React.ReactNode
  align?: 'left' | 'right'
  mono?: boolean
  muted?: boolean
  className?: string
  title?: string
}) {
  return (
    <td
      title={title}
      className={cn(
        'whitespace-nowrap px-3 py-1.5',
        align === 'right' ? 'text-right' : 'text-left',
        mono && 'font-mono text-inshop-xs',
        muted ? 'text-foreground/50' : 'text-foreground',
        className,
      )}
    >
      {children}
    </td>
  )
}

export function HeadRow({ children }: { children: React.ReactNode }) {
  return <tr className="border-b border-border bg-surface-secondary/60">{children}</tr>
}

export function BodyRow({
  children,
  onClick,
  selected = false,
  muted = false,
}: {
  children: React.ReactNode
  onClick?: () => void
  selected?: boolean
  muted?: boolean
}) {
  return (
    <tr
      onClick={onClick}
      aria-selected={onClick ? selected : undefined}
      className={cn(
        'border-b border-border last:border-b-0',
        onClick && 'cursor-pointer transition-colors hover:bg-surface-secondary/40',
        selected && 'bg-accent/8 hover:bg-accent/10',
        muted && 'opacity-55',
      )}
    >
      {children}
    </tr>
  )
}

/** 시각 셀 — 없으면 '—', 있으면 compact 표기 + ISO 원문 툴팁 */
export function TimeCell({
  iso,
  align = 'left',
  emphasis = false,
}: {
  iso: string | null | undefined
  align?: 'left' | 'right'
  emphasis?: boolean
}) {
  const { time } = useCompactTime()
  return (
    <Td align={align} mono muted={!iso} title={iso ?? undefined} className={cn(emphasis && iso && 'font-semibold')}>
      {time(iso)}
    </Td>
  )
}

/** 코드값 옆에 뜻을 옅게 붙인다 — 코드를 지우면 레거시 화면과 대조할 수 없다 */
export function CodeWithLabel({ code, label }: { code: string | null | undefined; label: string }) {
  if (!code) return <span className="text-foreground/50">{label}</span>
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="font-mono text-inshop-xs font-semibold text-foreground">{code}</span>
      {label !== code && <span className="text-inshop-xs text-foreground/58">{label}</span>}
    </span>
  )
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-6 text-center text-inshop-sm text-foreground/58">
        {children}
      </td>
    </tr>
  )
}

/** 이름표 + 값 (BayIdentityBar 의 IdentityPill 과 같은 형태) */
export function IdentityPill({
  label,
  value,
  code,
  muted = false,
}: {
  label: string
  value: string
  /** 툴팁에 붙는 레거시 컬럼명 */
  code?: string
  muted?: boolean
}) {
  return (
    <span
      className="inline-flex items-baseline gap-1.5 rounded-inshop-md bg-surface-secondary px-2 py-1"
      title={code ? `${label} (${code})` : label}
    >
      <span className="text-2xs font-medium text-foreground/54">{label}</span>
      <span className={cn('font-mono text-inshop-sm font-bold leading-none', muted ? 'text-foreground/40' : 'text-foreground')}>
        {value}
      </span>
    </span>
  )
}
