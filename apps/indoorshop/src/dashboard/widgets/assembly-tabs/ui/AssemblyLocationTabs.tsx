import { Link } from 'react-router-dom'
import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import type { Factory } from '../../../entities/factory/model/types'
import type { Location, LocationStatus } from '../../../entities/location/model/types'
import { cn } from '../../../shared/lib/utils'

interface AssemblyLocationTabsProps {
  factories: Factory[]
  locations: Location[]
  currentFactoryId: string
  /** 정반 화면이면 그 정반 id — 공장 전체 뷰에서는 없다 */
  currentLocationId?: string
  /** 3D 뷰와 공유하는 강조 대상 — 탭에 손을 얹으면 뷰 쪽 정반도 켜진다 */
  highlightedId?: string | null
  onHighlight?: (locationId: string | null) => void
  className?: string
}

const statusDot: Record<LocationStatus, string> = {
  occupied: 'bg-status-healthy',
  empty: 'bg-foreground/25',
  unknown: 'bg-status-degraded',
}

/**
 * 공장·정반 전환 탭.
 *
 * 같은 내용을 좌측 트리로 두면 폭을 256px 먹는데, 이 화면에서 폭은 곧 뷰어의
 * 해상도다 — 그래서 위쪽으로 눕히되, 공장(상위)과 정반(하위)은 **위아래 두 줄로**
 * 나눈다. 한 줄에 섞으면 어느 것이 어느 것에 속하는지가 사라진다.
 *
 * 강조는 한 곳에만 준다: 채워진 강조색은 **지금 보고 있는 것**(정반, 또는 공장 전체)
 * 하나뿐이고, 상위 줄의 현재 공장은 눌린 세그먼트로만 표시한다.
 * 두 줄 다 채우면 어느 쪽이 지금인지 눈이 못 고른다.
 * 넘치면 페이지가 아니라 각 줄이 가로로 구른다.
 */
export function AssemblyLocationTabs({
  factories,
  locations,
  currentFactoryId,
  currentLocationId,
  highlightedId,
  onHighlight,
  className,
}: AssemblyLocationTabsProps) {
  const { t } = useTranslation()
  const bays = locations.filter((location) => location.factoryId === currentFactoryId)

  return (
    <nav
      aria-label={t('assembly.tabs.label')}
      className={cn('flex flex-col gap-1 rounded-inshop-lg border border-border bg-surface p-1', className)}
    >
      {/* 상위 — 공장. 누르면 그 공장의 전체 뷰로 간다 */}
      <div className="flex items-center gap-0.5 self-start overflow-x-auto rounded-inshop-md bg-surface-secondary p-0.5">
        {factories.map((factory) => {
          const isCurrent = factory.id === currentFactoryId

          return (
            <Link
              key={factory.id}
              to={`/indoorshop/zones/assembly/${factory.id}`}
              aria-current={isCurrent ? 'page' : undefined}
              className={cn(
                'flex h-6 shrink-0 items-center rounded-inshop-sm px-2 text-inshop-xs font-medium transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                isCurrent
                  ? 'bg-surface text-foreground shadow-sm ring-1 ring-material-border'
                  : 'text-foreground/58 hover:text-foreground',
              )}
            >
              {factory.displayName}
            </Link>
          )
        })}
      </div>

      {/* 하위 — 그 공장의 정반. 한 칸 들여써서 위에 매달린 것으로 읽히게 한다 */}
      <div className="flex items-center gap-0.5 overflow-x-auto pl-2">
        <Link
          to={`/indoorshop/zones/assembly/${currentFactoryId}`}
          aria-current={currentLocationId ? undefined : 'page'}
          className={cn(
            'flex h-6 shrink-0 items-center rounded-inshop-sm px-2 text-inshop-xs transition-colors',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            currentLocationId
              ? 'text-foreground/68 hover:bg-foreground/6 hover:text-foreground'
              : 'bg-accent font-medium text-on-accent shadow-sm',
          )}
        >
          {t('assembly.tabs.all')}
        </Link>

        <span aria-hidden="true" className="mx-1 h-3.5 w-px shrink-0 bg-border" />

        {bays.map((bay) => {
          const isActive = bay.id === currentLocationId
          const isHighlighted = !isActive && highlightedId === bay.id

          return (
            <Link
              key={bay.id}
              to={`/indoorshop/zones/assembly/${currentFactoryId}/${bay.id}`}
              onMouseEnter={() => onHighlight?.(bay.id)}
              onMouseLeave={() => onHighlight?.(null)}
              onFocus={() => onHighlight?.(bay.id)}
              onBlur={() => onHighlight?.(null)}
              aria-current={isActive ? 'page' : undefined}
              title={t('assembly.tabs.bayTitle', { name: bay.name, code: bay.workCntr })}
              className={cn(
                'flex h-6 shrink-0 items-center gap-1.5 rounded-inshop-sm px-2 text-inshop-xs transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                isActive
                  ? 'bg-accent font-medium text-on-accent shadow-sm'
                  : isHighlighted
                    ? 'bg-accent/10 text-foreground'
                    : 'text-foreground/70 hover:bg-foreground/6 hover:text-foreground',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'h-1.5 w-1.5 shrink-0 rounded-full',
                  isActive ? 'bg-on-accent/70' : statusDot[bay.status],
                )}
              />
              <span className="whitespace-nowrap">{bay.name}</span>
              {/* 정반코드는 현재 항목에서만 — 늘 붙어 있으면 줄이 코드로 가득 찬다 */}
              {isActive && <span className="font-mono text-2xs text-on-accent/70">{bay.workCntr}</span>}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
