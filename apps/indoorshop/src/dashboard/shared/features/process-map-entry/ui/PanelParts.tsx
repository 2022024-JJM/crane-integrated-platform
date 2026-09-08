import { useState, type ReactNode } from 'react'
import { cn } from '../../../lib/utils'

/*
 * 맵 진입 우측 패널의 **공통 부품** — 단 토글 · 접이 구획 · 수집 요약 본문.
 *
 * 조립과 의장이 같은 화면 문법을 쓰기로 하면서(W6-5), 두 모듈이 같은 마크업을 각자
 * 들고 있을 이유가 없어진 것들만 여기로 올린다. **문구는 올라오지 않는다** — 프레임의
 * 다른 부품과 마찬가지로 번역이 끝난 문자열만 받는다(shared 는 공정 로케일 키를 모른다).
 *
 * 여기 없는 것: 설비 목록 자체. 조립은 라이다 진단값(scan rate·온도·RSSI)을 함께 내고
 * 의장은 아직 그 값을 받지 못해 줄의 내용이 다르다 — 억지로 한 컴포넌트로 합치면 양쪽이
 * 서로의 사정을 지고 가게 된다. 겉테(구획·토글)만 공유한다.
 */

export interface PanelModeTab<T extends string> {
  id: T
  /** 번역이 끝난 라벨 */
  label: string
}

/**
 * 우측 패널의 단 토글 — [설비 상태 | 수집 현황] 같은 2~3단.
 * 어두운 오버레이 위에 서므로 배색은 유리 위 흰색 램프를 쓴다.
 */
export function PanelModeTabs<T extends string>({
  tabs,
  value,
  onChange,
  ariaLabel,
}: {
  tabs: readonly PanelModeTab<T>[]
  value: T
  onChange: (mode: T) => void
  ariaLabel: string
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex gap-1 rounded-inshop-md border border-white/10 bg-white/[0.03] p-1"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={value === tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'flex-1 rounded px-2 py-1 text-2xs font-bold tracking-[-0.01em] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70',
            value === tab.id ? 'bg-white/14 text-white' : 'text-white/50 hover:text-white/80'
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

/**
 * 패널 안의 한 구획 — 제목 · 개수 · (접힘일 때도 보이는) 요약 · 본문.
 *
 * `collapsible` 이면 제목이 버튼이 된다. 접어 두는 구획이라도 **요약(`summary`)은 접힌
 * 줄에 남는다** — 접어서 감춘 것이 지금 문제인지 아닌지는 펴 보기 전에 알아야 한다.
 */
export function PanelSection({
  title,
  count,
  summary,
  collapsible = false,
  defaultOpen = true,
  collapsedBody,
  children,
}: {
  title: string
  count?: number
  /** 접힌 줄 오른쪽에 남는 한 마디 (번역 완료 문자열/노드) */
  summary?: ReactNode
  collapsible?: boolean
  defaultOpen?: boolean
  /** 접혀 있을 때 본문 자리에 대신 서는 한 줄 안내 */
  collapsedBody?: ReactNode
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const shown = collapsible ? open : true

  const head = (
    <>
      {collapsible && (
        <span aria-hidden="true" className={cn('transition-transform', !open && '-rotate-90')}>
          ▾
        </span>
      )}
      <span>{title}</span>
      {count !== undefined && <span className="font-mono font-normal text-white/35">{count}</span>}
      {summary && <span className="ml-auto font-normal">{summary}</span>}
    </>
  )

  return (
    <section>
      {collapsible ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-center gap-1.5 rounded px-1 py-1 text-2xs font-semibold text-white/55 transition-colors hover:bg-white/[0.05] hover:text-white/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          {head}
        </button>
      ) : (
        <p className="flex items-center gap-1.5 px-1 py-1 text-2xs font-semibold text-white/55">
          {head}
        </p>
      )}
      {shown ? <div className="mt-0.5">{children}</div> : collapsedBody}
    </section>
  )
}

/** 수집 요약 한 줄 — 라벨과 값 */
export interface CollectionRow {
  label: string
  value: string
  /** 값에 입힐 잉크 클래스 (없으면 기본 흰색) */
  tone?: string
}

/**
 * ②수집 현황 본문 — 라벨/값 몇 줄과 "공장 현황 보기" 문 하나.
 *
 * 조립·의장이 세는 값은 다르지만(정반 vs 블록) **읽는 문법은 같다** — 몇 개를 감지했고,
 * 오늘 무엇이 끝났고, 마지막 수집이 언제인가, 그리고 더 볼 곳은 어디인가.
 */
export function CollectionSummaryBody({
  rows,
  link,
  note,
}: {
  rows: readonly CollectionRow[]
  link?: { to: string; label: string; render: (to: string, label: string) => ReactNode }
  /** 값을 낼 수 없는 사정을 말하는 문단 (CAS/PAS 처럼 수집이 아직 없는 곳) */
  note?: string
}) {
  return (
    <div className="flex flex-col gap-1.5 px-3 py-2.5 text-inshop-xs">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between">
          <span className="text-white/50">{row.label}</span>
          <span className={cn('font-mono tabular-nums', row.tone ?? 'text-white/90')}>
            {row.value}
          </span>
        </div>
      ))}
      {note && <p className="text-2xs leading-relaxed text-white/45">{note}</p>}
      {link && link.render(link.to, link.label)}
    </div>
  )
}
