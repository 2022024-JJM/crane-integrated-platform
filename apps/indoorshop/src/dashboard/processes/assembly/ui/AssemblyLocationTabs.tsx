import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import type { Factory } from '../../../shared/entities/factory/model/types'
import type { Location } from '../../../shared/entities/location/model/types'
import {
  LocationTabs,
  type LocationTabsRouting,
} from '../../../shared/features/bay-viewer/ui/LocationTabs'

interface AssemblyLocationTabsProps {
  factories: Factory[]
  locations: Location[]
  currentFactoryId: string
  currentLocationId?: string
  highlightedId?: string | null
  onHighlight?: (locationId: string | null) => void
  tone?: 'surface' | 'glass' | 'attached'
  attachedColors?: { background: string; foreground: string }
  parts?: 'both' | 'factories' | 'bays'
  className?: string
}

/**
 * 조립 몫의 공장·정반 전환 탭 — 부품은 shared(`bay-viewer/ui/LocationTabs`)로 승격됐고
 * (W7-10: 의장 워크스페이스가 같은 문법을 쓴다), 여기는 조립의 경로·문구만 꽂는다.
 */
export function AssemblyLocationTabs({ factories, ...rest }: AssemblyLocationTabsProps) {
  const { t } = useTranslation()
  const routing: LocationTabsRouting = {
    factoryHref: (factoryId) => `/indoorshop/zones/assembly/${factoryId}`,
    bayHref: (factoryId, bayId) => `/indoorshop/zones/assembly/${factoryId}/${bayId}`,
    navLabel: t('assembly.tabs.label'),
    allLabel: t('assembly.tabs.all'),
    bayTitle: (name, code) => t('assembly.tabs.bayTitle', { name, code }),
  }
  return <LocationTabs factories={factories} routing={routing} {...rest} />
}
