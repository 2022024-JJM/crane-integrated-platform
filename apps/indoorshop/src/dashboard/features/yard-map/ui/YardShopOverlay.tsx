import { Link } from 'react-router-dom'
import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import { cn } from '../../../shared/lib/utils'
import { CloseIcon } from '../../../shared/ui/icons'
import { LOCATION_STATUS_META } from '../../../entities/location/model/types'
import { bayColor, paletteOf } from '../lib/yardColors'
import type { MapTheme } from '../lib/basemapStyle'
import type { YardShop, YardShopBay } from '../lib/assemblyShops'

interface YardShopOverlayProps {
  shop: YardShop
  bay: YardShopBay
  mapTheme: MapTheme
  onClose: () => void
  shopHref: string
  bayHref: string
  className?: string
}

/**
 * 맵에서 고른 정반의 상세.
 *
 * 블록 상세(`YardBlockOverlay`)와 **같은 자리·같은 골격**을 쓴다 — 야드 위에서 무엇을
 * 고르든 답은 같은 곳에서 같은 모양으로 나와야, 블록과 정반을 번갈아 누르며 비교할 수
 * 있다. 다른 점은 아래 두 링크뿐이다: 야드에서 본 것을 조립 화면에서 이어 보는 길.
 */
export function YardShopOverlay({
  shop,
  bay,
  mapTheme,
  onClose,
  shopHref,
  bayHref,
  className,
}: YardShopOverlayProps) {
  const { t } = useTranslation()
  const palette = paletteOf(mapTheme)
  const meta = LOCATION_STATUS_META[bay.status]
  const fault = bay.sensorOnline < bay.sensorTotal

  const rows: { term: string; value: string; tone?: string }[] = [
    { term: t('yard.shop.detail.workCntr'), value: bay.workCntr },
    { term: t('yard.shop.detail.status'), value: t(meta.labelKey) },
    {
      /* 공석은 위의 상태 줄이 이미 말했다 — 여기서 또 '공석'이라고 하면 두 번 읽힌다 */
      term: t('yard.shop.detail.block'),
      value: bay.projNo && bay.blkNo ? `${bay.projNo}-${bay.blkNo}` : '-',
    },
    {
      term: t('yard.shop.detail.lidar'),
      value: `${bay.sensorOnline}/${bay.sensorTotal}`,
      tone: fault ? 'text-glass-degraded' : undefined,
    },
    {
      /* 항목 이름이 이미 '오늘'이라 값에는 수만 낸다 (칩과 달리 여기는 이름이 붙어 있다) */
      term: t('yard.shop.detail.today'),
      value: t('common.count', { count: bay.todayCount }),
    },
    {
      term: t('yard.shop.detail.lastScan'),
      value: bay.lastScanAt ?? '-',
    },
    {
      /* 지번은 이 패널의 존재 이유다 — 정반이 야드의 **어디**인지가 여기서만 읽힌다 */
      term: t('yard.shop.detail.lots'),
      value: bay.lots.map((lot) => lot.lot).join(', '),
    },
    {
      term: t('yard.shop.detail.area'),
      value: `${Math.round(bay.lots.reduce((sum, lot) => sum + lot.area, 0)).toLocaleString()} m²`,
    },
  ]

  return (
    <div
      className={cn(
        'absolute left-3 top-3 w-64 animate-fade-in overflow-hidden rounded-inshop-lg glass-panel',
        className,
      )}
    >
      <div className="flex items-center gap-1.5 border-b border-glass-border/70 px-2.5 py-2">
        <span
          aria-hidden="true"
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: bayColor(bay.status, palette) }}
        />
        <span className="min-w-0 flex-1 truncate text-inshop-xs font-semibold text-glass-foreground">
          {shop.name} · {bay.name}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('yard.detail.close')}
          className={cn(
            'shrink-0 rounded-inshop-xs p-0.5 text-glass-foreground/54 transition-colors',
            'hover:bg-white/12 hover:text-glass-foreground',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-glass-accent',
          )}
        >
          <CloseIcon size={12} />
        </button>
      </div>

      <table className="w-full table-fixed">
        <tbody>
          {rows.map(({ term, value, tone }) => (
            <tr key={term} className="border-b border-glass-border/40">
              <th
                scope="row"
                className="w-[4.5rem] px-2.5 py-1 text-left align-top text-2xs font-normal text-glass-foreground/54"
              >
                {term}
              </th>
              <td
                className={cn(
                  'px-2.5 py-1 text-right align-top text-2xs',
                  tone ?? 'text-glass-foreground/85',
                )}
              >
                {value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex items-stretch gap-px p-1.5">
        <Link
          to={bayHref}
          className={cn(
            'flex min-h-7 flex-1 items-center justify-center rounded-inshop-sm bg-white/12 px-2 text-2xs font-medium',
            'text-glass-foreground transition-colors hover:bg-white/20',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-glass-accent',
          )}
        >
          {t('yard.shop.detail.openBay')}
        </Link>
        <Link
          to={shopHref}
          className={cn(
            'flex min-h-7 shrink-0 items-center justify-center rounded-inshop-sm px-2 text-2xs font-medium',
            'text-glass-foreground/68 transition-colors hover:bg-white/12 hover:text-glass-foreground',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-glass-accent',
          )}
        >
          {t('yard.shop.detail.openShop')}
        </Link>
      </div>
    </div>
  )
}
