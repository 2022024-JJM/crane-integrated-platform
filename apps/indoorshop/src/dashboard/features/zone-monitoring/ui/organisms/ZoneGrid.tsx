import type { Zone } from '../../../../entities/zone/model/types'
import { ZoneCard } from '../molecules/ZoneCard'

interface ZoneGridProps {
  zones: Zone[]
}

export function ZoneGrid({ zones }: ZoneGridProps) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {zones.map((zone) => (
        <ZoneCard key={zone.id} zone={zone} />
      ))}
    </div>
  )
}
