import { Link } from 'react-router-dom'
import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import { DraggableCard } from '../../../shared/ui/atoms/DraggableCard'
import { cn } from '../../../shared/lib/utils'
import { ChevronRightIcon, CloseIcon } from '../../../shared/ui/icons'
import type { MapTheme } from '../lib/basemapStyle'
import { facilityBayNumbers, type YardFacility } from '../lib/facilities'

interface YardFacilityOverlayProps {
  facility: YardFacility
  mapTheme: MapTheme
  onClose: () => void
  /** 고른 BAY — 아직 이름뿐인 선택이다 (좌표·데이터 연동 전) */
  selectedBay: number | null
  onSelectBay: (bay: number | null) => void
  /** 공정 화면 경로 — 없으면(전처리·미지정) 이동 없이 정보만 낸다 */
  href: string | null
  className?: string
}

/**
 * 선택한 공장·샵의 상세 — 블록·경로·정반 상세와 같은 자리(맵 왼쪽 위)를 쓴다.
 *
 * 네온으로 들어온 다음의 걸음이 여기서 이어진다: **BAY 칩을 눌러 그 공장 안의
 * 베이 하나를 고른다.** BAY 는 아직 좌표가 없는 이름뿐이라 맵 도형이 아니라 칩이며,
 * 지금은 고르는 것까지만 한다 — 고른 BAY 는 공정 화면 경로에 `&bay=` 로 실려 간다.
 *
 * 공정 페이지가 연결된 공장은 아래에 이동 버튼이 서고, 연결이 없는 공장은 그 자리에
 * "왜 이동이 없는지"를 적는다 — 버튼이 그냥 사라지면 고장으로 읽힌다 (요청 문서의
 * "매핑 안 된 시설은 팝업만" 규칙).
 */
export function YardFacilityOverlay({
  facility,
  mapTheme,
  onClose,
  selectedBay,
  onSelectBay,
  href,
  className,
}: YardFacilityOverlayProps) {
  const { t } = useTranslation()
  const color = facility.process.color[mapTheme]
  const bays = facilityBayNumbers(facility)

  const rows: [string, string][] = [
    [t('yard.facility.detail.process'), facility.process.label],
    [t('yard.facility.detail.sections'), `${facility.sections}`],
    [t('yard.facility.detail.lots'), `${facility.lotCount}`],
  ]

  return (
    <DraggableCard
      cardKey="facility"
      className={cn(
        'absolute left-3 top-3 w-64 animate-fade-in overflow-hidden rounded-inshop-lg glass-panel',
        className,
      )}
    >
      <div data-drag-handle className="flex items-center gap-2 border-b border-glass-border/70 px-2.5 py-2">
        {/* 점이 곧 범례다 — 맵의 발광색과 같은 색이 "이 갈래"라고 말한다 */}
        <span
          aria-hidden="true"
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: color, boxShadow: `0 0 6px ${color}` }}
        />
        <span className="min-w-0 flex-1 truncate text-inshop-xs font-semibold text-glass-foreground">
          {facility.name}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('yard.detail.close')}
          className={cn(
            'shrink-0 rounded-inshop-xs p-0.5 text-glass-foreground/54 transition-colors',
            'hover:bg-glass-hover hover:text-glass-foreground',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-glass-accent',
          )}
        >
          <CloseIcon size={12} />
        </button>
      </div>

      <table className="w-full table-fixed">
        <tbody>
          {rows.map(([term, value]) => (
            <tr key={term} className="border-b border-glass-border/40 last:border-b-0">
              <th
                scope="row"
                className="w-[4.5rem] px-2.5 py-1 text-left align-top text-2xs font-normal text-glass-foreground/54"
              >
                {term}
              </th>
              <td className="px-2.5 py-1 text-right align-top text-2xs text-glass-foreground/85">
                {value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {bays.length > 0 && (
        <fieldset className="border-t border-glass-border/40 px-2.5 py-2">
          <legend className="sr-only">{t('yard.facility.bayLegend', { name: facility.name })}</legend>
          <p aria-hidden="true" className="mb-1.5 text-2xs text-glass-foreground/54">
            {t('yard.facility.detail.bays')}
          </p>
          <div className="flex flex-wrap gap-1">
            {bays.map((bay) => {
              const active = bay === selectedBay
              return (
                <button
                  key={bay}
                  type="button"
                  aria-pressed={active}
                  title={t('yard.facility.selectBay', { name: facility.name, bay })}
                  onClick={() => onSelectBay(active ? null : bay)}
                  className={cn(
                    'flex h-6 min-w-6 cursor-pointer items-center justify-center rounded-inshop-md border px-1',
                    'font-mono text-2xs tabular-nums transition-colors',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-glass-accent',
                    !active &&
                      'border-glass-border/70 text-glass-foreground/72 hover:bg-glass-hover hover:text-glass-foreground',
                  )}
                  style={
                    active
                      ? /* 고른 BAY 는 그 공장의 공정색으로 빛난다 — 카드와 맵이 같은 말을 쓴다 */
                        {
                          background: color,
                          borderColor: color,
                          color: '#0d1218',
                          fontWeight: 700,
                          boxShadow: `0 0 8px ${color}`,
                        }
                      : undefined
                  }
                >
                  {bay}
                </button>
              )
            })}
          </div>
        </fieldset>
      )}

      {href ? (
        <Link
          to={href}
          className={cn(
            'flex items-center justify-center gap-1 border-t border-glass-border/70 px-2.5 py-2',
            'text-2xs font-semibold text-glass-accent transition-colors',
            'hover:bg-glass-hover',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-glass-accent',
          )}
        >
          {selectedBay === null
            ? t('yard.facility.openZone', {
                name: facility.name,
                process: facility.process.label,
              })
            : t('yard.facility.openZoneBay', {
                name: facility.name,
                bay: selectedBay,
                process: facility.process.label,
              })}
          <ChevronRightIcon size={12} />
        </Link>
      ) : (
        <p className="border-t border-glass-border/70 px-2.5 py-2 text-2xs text-glass-foreground/54">
          {t('yard.facility.noRoute')}
        </p>
      )}
    </DraggableCard>
  )
}
