import { useTranslation } from '../../../lib/i18n/useTranslation'
import type { InshopKey } from '../../../lib/i18n/keys'
import { colorOfProcess } from '../../../entities/yard-parcels'
import { YARD_PROCESS_OF_ZONE, type ProcessZone } from '../../../entities/vessel'
import { cn } from '../../../lib/utils'
import type { SearchGroup, SearchHit } from '../lib/searchIndex'

/*
 * 검색 결과 목록 — **두 진입점이 같은 부품으로 그린다.**
 *
 * 팔레트(Cmd+K)와 대시보드 지도 위 검색창은 재질(밝은 팝오버 / 어두운 유리)만 다르고
 * 읽는 규칙은 같아야 한다: 같은 그룹 이름, 같은 줄 구성(코드형 제목 + 맥락 부제),
 * 같은 활성 표시. 예전에는 두 화면이 각자 줄을 그려서 그룹 이름도 정렬도 달랐다 —
 * 같은 데이터가 화면마다 다르게 보이면 사용자는 그것을 다른 기능으로 읽는다.
 *
 * 색은 `tone` 하나로 갈린다. 지도 위(`glass`)는 어두운 바탕에 뜨는 유리라 흰 계열
 * 잉크를, 팔레트(`panel`)는 테마 토큰을 쓴다 — 새 팔레트 값을 만들지 않는다.
 */

export type SearchRowTone = 'panel' | 'glass'

/** 목록 한 줄이 되는 것 — 검색 결과이거나 최근 검색이거나, 그리는 모양은 같다 */
export type SearchRow = Pick<SearchHit, 'id' | 'group' | 'title' | 'subtitle' | 'href' | 'zone'>

/** 공정 단계 문구 — 지도 마커·블록 카드가 쓰는 그 낱말 그대로 */
const STAGE_KEY: Record<ProcessZone, InshopKey> = {
  fabrication: 'dashboard.map.blockStage.fabrication',
  assembly: 'dashboard.map.blockStage.assembly',
  outfitting: 'dashboard.map.blockStage.outfitting',
  painting: 'dashboard.map.blockStage.painting',
}

export const GROUP_LABEL: Record<SearchGroup, InshopKey> = {
  vessel: 'globalSearch.groups.vessel',
  block: 'globalSearch.groups.block',
  assy: 'globalSearch.groups.assy',
  yard: 'globalSearch.groups.yard',
  wo: 'globalSearch.groups.wo',
  equipment: 'globalSearch.groups.equipment',
}

/** aria-activedescendant 가 가리킬 id — 목록마다 접두사가 다르다(한 화면에 둘이 뜰 수 있다) */
export const rowDomId = (listId: string, index: number) => `${listId}-option-${index}`

const TONE = {
  panel: {
    heading: 'text-foreground/42',
    title: 'text-foreground',
    subtitle: 'text-foreground/55',
    active: 'bg-surface-secondary',
    idle: 'hover:bg-surface-secondary/60',
    ring: 'focus-visible:ring-accent',
  },
  glass: {
    heading: 'text-white/38',
    title: 'text-white',
    subtitle: 'text-white/50',
    active: 'bg-white/10',
    idle: 'hover:bg-white/8',
    ring: 'focus-visible:ring-white/60',
  },
} as const

export function SearchResultRows({
  rows,
  activeIndex,
  listId,
  tone = 'panel',
  showGroupHeadings = true,
  onPick,
  onHover,
}: {
  rows: readonly SearchRow[]
  activeIndex: number
  /** `rowDomId` 의 접두사 — 부모의 aria-controls 와 같은 값 */
  listId: string
  tone?: SearchRowTone
  /** 최근 검색처럼 한 묶음으로 볼 때는 머리글을 끈다 */
  showGroupHeadings?: boolean
  onPick: (row: SearchRow, index: number) => void
  onHover?: (index: number) => void
}) {
  const { t } = useTranslation()
  const ink = TONE[tone]

  /* 이 줄이 제 그룹의 첫 줄인가 — 머리글을 세울 자리 */
  const isGroupStart = (index: number) =>
    index === 0 || rows[index - 1].group !== rows[index].group

  return (
    <>
      {rows.map((row, index) => (
        <li key={row.id}>
          {showGroupHeadings && isGroupStart(index) && (
            <p className={cn('px-2.5 pb-1 pt-1.5 text-2xs font-medium', ink.heading)}>
              {t(GROUP_LABEL[row.group])}
            </p>
          )}
          <button
            type="button"
            id={rowDomId(listId, index)}
            role="option"
            aria-selected={index === activeIndex}
            onClick={() => onPick(row, index)}
            onMouseEnter={() => onHover?.(index)}
            className={cn(
              'flex w-full items-baseline gap-2.5 rounded-inshop-md px-2.5 py-2 text-left transition-colors',
              'focus:outline-none focus-visible:ring-2',
              ink.ring,
              index === activeIndex ? ink.active : ink.idle
            )}
          >
            <span className={cn('shrink-0 font-mono text-inshop-sm font-medium', ink.title)}>
              {row.title}
            </span>
            {/* 공정색 좌막대 칩 — 색은 상태가 아니라 **공정**을 뜻하므로 공정색에서 온다 */}
            {row.zone && (
              <span
                className={cn(
                  'shrink-0 rounded border py-px pl-1.5 pr-1 text-[10px]',
                  tone === 'glass' ? 'border-white/16 text-white/70' : 'border-border text-foreground/62'
                )}
                style={{ boxShadow: `inset 2px 0 0 ${colorOfProcess(YARD_PROCESS_OF_ZONE[row.zone])}` }}
              >
                {t(STAGE_KEY[row.zone])}
              </span>
            )}
            {row.subtitle && (
              <span className={cn('min-w-0 flex-1 truncate text-inshop-xs', ink.subtitle)}>
                {row.subtitle}
              </span>
            )}
            {/* 머리글이 없는 목록(최근 검색)에서는 줄 끝 배지가 그 소속을 말한다 */}
            {!showGroupHeadings && (
              <span
                className={cn(
                  'shrink-0 rounded border px-1 py-px text-[10px]',
                  tone === 'glass'
                    ? 'border-white/16 text-white/48'
                    : 'border-border text-foreground/48'
                )}
              >
                {t(GROUP_LABEL[row.group])}
              </span>
            )}
          </button>
        </li>
      ))}
    </>
  )
}
