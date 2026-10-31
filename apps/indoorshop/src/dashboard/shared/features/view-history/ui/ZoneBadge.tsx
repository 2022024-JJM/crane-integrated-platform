import { useSyncExternalStore, type CSSProperties } from 'react'
import { useTranslation } from '../../../lib/i18n/useTranslation'
import { activeProcessPaletteId, colorOfProcess, subscribeProcessPalette } from '../../../entities/yard-parcels'
import type { HistoryZone } from '../model/viewHistory'

/** 화면 → 야드 맵 공정 색의 이름. 통합실적은 공정이 아니라 강조색을 쓴다 */
const ZONE_PROCESS: Partial<Record<HistoryZone, string>> = {
  fabrication: '가공',
  assembly: '조립',
  outfitting: '의장',
  painting: '도장',
}

/**
 * 히스토리 · 즐겨찾기 줄의 **화면 이름** — 글자를 화면마다 야드 맵의 공정 색으로 칠한다(사용자 지적:
 * 모두 같은 강조색이라 구별이 안 된다). 통합실적 블록 카드의 권역 구간과 같은 색이라 한눈에 이어진다.
 * 시안(공정 색표)을 바꾸면 함께 바뀐다.
 */
export function ZoneBadge({ zone }: { zone: HistoryZone }) {
  const { t } = useTranslation()
  useSyncExternalStore(subscribeProcessPalette, activeProcessPaletteId, activeProcessPaletteId)
  const process = ZONE_PROCESS[zone]
  const color = process ? colorOfProcess(process) : 'var(--color-accent)'
  const label = zone === 'performance' ? t('history.integrated') : t(`performance.process.${zone}` as const)
  return (
    <span
      data-zone={zone}
      style={{ '--zone': color } as CSSProperties}
      /* 글자만 칠한다 — 칩(바탕 · 테두리)은 목록에서 무겁다(사용자 확정). 폭을 고정해 뒤의 호선-블록이 한 줄로 선다 */
      className="w-14 shrink-0 text-inshop-xs font-semibold text-[color:var(--zone)]"
    >
      {label}
    </span>
  )
}
