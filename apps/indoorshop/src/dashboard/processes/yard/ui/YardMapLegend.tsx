import { useMemo } from 'react'
import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import { DraggableCard } from '../../../shared/ui/atoms/DraggableCard'
import { cn } from '../../../shared/lib/utils'
import { lotCategories } from '../api/yardRepository'
import { LOCATION_STATUS_META } from '../../../shared/entities/location/model/types'
import { bayColor, paletteOf } from '../lib/yardColors'
import type { MapTheme } from '../lib/basemapStyle'

/**
 * 지번 색 범례.
 *
 * 지번이 1,977개인데 색은 일곱이다 — 색이 무엇을 묶은 것인지 말해 주지 않으면
 * 사용자는 색마다 다른 뜻이 있다고 읽고 지번 하나하나를 눌러 확인하게 된다.
 *
 * 갈래 이름은 번역하지 않는다. 레거시(BTS)가 부르는 이름 그대로여야 화면에서 본 것을
 * 현장에서 같은 말로 물어볼 수 있다 — 필터 칩의 용도 이름과 같은 규칙이다.
 */
export function YardMapLegend({
  mapTheme,
  showMoves,
  showPlans,
  showShops,
  className,
}: {
  mapTheme: MapTheme
  showMoves: boolean
  showPlans: boolean
  /** 감시 대상 조립공장 레이어가 켜져 있는가 — 켜져 있을 때만 정반 상태색을 설명한다 */
  showShops: boolean
  className?: string
}) {
  const { t } = useTranslation()
  const categories = useMemo(() => lotCategories(), [])
  const palette = paletteOf(mapTheme)

  return (
    <DraggableCard
      cardKey="legend"
      className={cn(
        'pointer-events-auto absolute left-3 top-3 rounded-inshop-lg glass-panel px-2.5 py-1.5',
        className,
      )}
    >
      <p className="mb-1 text-2xs font-semibold uppercase tracking-wide text-glass-foreground/54">
        {t('yard.legend.title')}
      </p>
      <ul className="space-y-0.5">
        {categories.map(({ category, color, count }) => (
          <li key={category} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-2 w-5 shrink-0 rounded-inshop-xs"
              style={{ background: color }}
            />
            <span className="text-2xs text-glass-foreground/80">{category}</span>
            <span className="ml-auto pl-2 font-mono text-2xs text-glass-foreground/45 tabular-nums">
              {count}
            </span>
          </li>
        ))}

        <li className="mt-1 flex items-center gap-2 border-t border-glass-border/70 pt-1">
          <Dot color={palette.block} />
          <span className="text-2xs text-glass-foreground/80">{t('yard.legend.block')}</span>
        </li>

        {showMoves && (
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="flex h-2 w-5 shrink-0 items-center">
              {/* 경로 색은 서로 갈라 보이려는 것일 뿐 뜻이 없다 — 여러 색을 겹쳐 그렇게 말한다 */}
              {palette.moves.slice(0, 4).map((color) => (
                <span key={color} className="h-0.5 flex-1" style={{ background: color }} />
              ))}
            </span>
            <span className="text-2xs text-glass-foreground/80">{t('yard.legend.move')}</span>
          </li>
        )}

        {showPlans && (
          <li className="flex items-center gap-2">
            <Dot color={palette.plan} />
            <span className="text-2xs text-glass-foreground/80">{t('yard.legend.plan')}</span>
          </li>
        )}
      </ul>

      {/*
       * 조립공장은 지번 성격과 다른 층이다 — 위 목록은 "이 구획이 무엇에 쓰이는가"고
       * 이쪽은 "센서가 보고 있는가, 그 정반이 지금 찼는가"라서, 줄을 갈라 둔다.
       */}
      {showShops && (
        <div className="mt-1.5 border-t border-glass-border/70 pt-1.5">
          <p className="mb-1 text-2xs font-semibold uppercase tracking-wide text-glass-foreground/54">
            {t('yard.legend.shopTitle')}
          </p>
          <ul className="space-y-0.5">
            {(['occupied', 'unknown', 'empty'] as const).map((status) => (
              <li key={status} className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="h-2 w-5 shrink-0 rounded-inshop-xs"
                  style={{ background: bayColor(status, palette) }}
                />
                <span className="text-2xs text-glass-foreground/80">
                  {t(LOCATION_STATUS_META[status].labelKey)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </DraggableCard>
  )
}

function Dot({ color }: { color: string }) {
  return (
    <span aria-hidden="true" className="flex h-2 w-5 shrink-0 items-center justify-center">
      <span
        className="h-2 w-2 rounded-full"
        style={{ background: color, boxShadow: '0 0 0 1px rgba(10,14,19,.85)' }}
      />
    </span>
  )
}
