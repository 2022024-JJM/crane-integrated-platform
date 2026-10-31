import type { ReactNode } from 'react'
import { useTranslation } from '../../../lib/i18n/useTranslation'
import { cn } from '../../../lib/utils'
import { STATUS_STYLE } from '../../../ui/statusPalette'
import type { StripNode } from './NodeStrip'

/**
 * 절점 **목록** — 큰 블록 카드(통합실적)의 권역 칸에 선다(사용자 확정: 칩은 작고 줄이 안 맞는다).
 *
 * 칩을 줄바꿈으로 흘리면 칸 폭마다 줄 끝이 달라져 열이 맞지 않는다. 그래서 절점 하나를 **한 줄**로
 * 세우고 열을 고정한다 — 상태 표시 · 코드 · 이름 · 상태. 색 단독으로 뜻을 나르지 않는다(표시 + 글자).
 * 묶음(`group`, 가공의 적치/가공)이 있으면 묶음마다 한 열로 나란히 선다.
 */
export function NodeList({ nodes }: { nodes: StripNode[] }) {
  const { t } = useTranslation()
  if (nodes.length === 0) {
    return <p className="text-inshop-sm text-foreground/50">{t('performance.nodes.none')}</p>
  }
  const groups: { label?: string; nodes: StripNode[] }[] = []
  for (const node of nodes) {
    const last = groups[groups.length - 1]
    if (last && last.label === node.group) last.nodes.push(node)
    else groups.push({ label: node.group, nodes: [node] })
  }
  return (
    <div className={cn('grid gap-x-4 gap-y-2', groups.length > 1 && 'grid-cols-2')}>
      {groups.map((group, gi) => (
        <div key={group.label ?? gi} className="min-w-0">
          {group.label && <div className="mb-1 text-inshop-xs font-medium text-foreground/50">{group.label}</div>}
          <ol aria-label={group.label ?? t('performance.nodes.title')} className="flex flex-col">
            {group.nodes.map((node) => {
              const s = stateOf(node)
              /* 이름이 코드로 시작하면(「S1 강재 입고」) 코드는 앞 열이 이미 말하므로 떼어 낸다 */
              const name = node.name.startsWith(node.short) ? node.name.slice(node.short.length).trim() : node.name
              return (
                <li
                  key={node.key}
                  title={node.note ? `${node.name} · ${node.note}` : node.name}
                  className="grid grid-cols-[1rem_auto_minmax(0,1fr)_auto] items-center gap-x-2 py-0.5 text-inshop-sm"
                >
                  {s.pie ? (
                    /* 진행중 — 반쯤 찬 원(진행 중이라는 뜻을 모양으로). 점 세 개는 '줄임표' 로 읽혀 어색했다(사용자 지적) */
                    <svg aria-hidden viewBox="0 0 16 16" className={cn('size-4', s.ink)}>
                      <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M8 3 A5 5 0 0 1 8 13 Z" fill="currentColor" />
                    </svg>
                  ) : (
                    <span aria-hidden className={cn('grid size-4 place-items-center rounded-full text-[10px] font-bold', s.dot)}>
                      {s.mark}
                    </span>
                  )}
                  <span className="font-semibold tabular-nums text-foreground">{node.short}</span>
                  <span className="truncate text-foreground/60">{name}</span>
                  <span className={cn('text-inshop-xs font-medium', s.ink)}>{t(s.labelKey)}</span>
                </li>
              )
            })}
          </ol>
        </div>
      ))}
    </div>
  )
}

function stateOf(node: StripNode) {
  if (node.passed)
    return { labelKey: 'performance.nodes.passed', mark: '✓', dot: `${STATUS_STYLE.done.fill} text-background`, ink: STATUS_STYLE.done.ink, pie: false } as const
  if (node.delayed)
    return { labelKey: 'performance.nodes.delayed', mark: '!', dot: `${STATUS_STYLE.error.fill} text-background`, ink: STATUS_STYLE.error.ink, pie: false } as const
  if (node.inProgress)
    return { labelKey: 'performance.nodes.inProgress', mark: '', dot: '', ink: STATUS_STYLE.inProgress.ink, pie: true } as const
  return { labelKey: 'performance.nodes.notDue', mark: '', dot: 'border border-foreground/30', ink: 'text-foreground/45', pie: false } as const
}

/**
 * 요약 수치 — "항목 · 값" 한 줄씩. 칩 대신 열을 맞춰 큰 카드에서 한눈에 읽힌다.
 * `tone` 으로 값의 뜻(좋음·경고·흐림)을 글자색에 싣는다.
 */
export function MetricRows({
  rows,
}: {
  rows: { label: string; value: ReactNode; tone?: 'default' | 'good' | 'bad' | 'muted'; title?: string }[]
}) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-inshop-sm">
      {rows.map((row) => (
        <div key={row.label} className="contents" title={row.title}>
          <dt className="text-foreground/55">{row.label}</dt>
          <dd
            className={cn(
              'text-right font-semibold tabular-nums',
              row.tone === 'good' && STATUS_STYLE.done.ink,
              row.tone === 'bad' && STATUS_STYLE.error.ink,
              row.tone === 'muted' && 'font-medium text-foreground/50',
              (!row.tone || row.tone === 'default') && 'text-foreground'
            )}
          >
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
