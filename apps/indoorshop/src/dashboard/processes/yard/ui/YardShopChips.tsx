import { Link } from 'react-router-dom'
import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import { cn } from '../../../shared/lib/utils'
import { ChevronRightIcon } from '../../../shared/ui/icons'
import { bayColor, paletteOf } from '../lib/yardColors'
import type { MapTheme } from '../lib/basemapStyle'
import type { YardShop, YardShopBay } from '../lib/assemblyShops'
import { RELIEF_METERS } from '../lib/relief'
import { worldToScreen, type ScreenPoint, type Viewport, type YardView } from '../lib/projection'

/**
 * 공장 이름줄에 수치를 함께 낼 배율.
 *
 * 야드 전체가 보이는 배율(약 21,000)에서 공장은 44px 남짓이다 — 거기에 수치를 붙이면
 * 두 공장의 이름줄이 서로를 덮는다. 멀리서는 이름만, 공장이 화면에서 자리를 차지하기
 * 시작하면 수치까지 낸다.
 */
const SHOP_STATS_MIN_SCALE = 60_000

/* 정반 칩 — 폭을 내용이 정하게 두지 않고 **화면에서 계산한다** (아래 planBayChips 참조) */
const CHIP_MIN_WIDTH = 56
const CHIP_MAX_WIDTH = 152
/** 이 폭부터는 정반 이름 옆에 블록번호까지 담긴다 */
const CHIP_BLOCK_WIDTH = 132
const CHIP_HEIGHT = 26
/** 칩 사이 최소 간격 — 붙으면 두 칩이 한 덩어리로 읽힌다 */
const CHIP_GAP = 6

/** 화면 밖 칩은 그리지 않는다 — 여백은 칩 자체 크기만큼 */
const CULL_MARGIN = 180

interface BayChipPlacement {
  shop: YardShop
  bay: YardShopBay
  left: number
  top: number
  width: number
  showBlock: boolean
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

function overlaps(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w + CHIP_GAP &&
    a.x + a.w + CHIP_GAP > b.x &&
    a.y < b.y + b.h + CHIP_GAP &&
    a.y + a.h + CHIP_GAP > b.y
  )
}

/** 화면 점들을 감싸는 상자 */
function screenBox(points: ScreenPoint[]): Rect {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const { sx, sy } of points) {
    if (sx < minX) minX = sx
    if (sx > maxX) maxX = sx
    if (sy < minY) minY = sy
    if (sy > maxY) maxY = sy
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

/**
 * 정반 칩을 어디에 몇 개 놓을지 정한다.
 *
 * 정반은 지번을 나란히 붙여 만든 구획이라 서로 **30m 밖에 안 떨어진 것도 있다**(PBS
 * 2·3번 베이). 그 배율에서 칩을 전부 놓으면 두 칩이 겹쳐 둘 다 못 읽는다. 그래서
 * 두 가지를 함께 건다:
 *
 *  1. 칩은 **자기 정반 안에 들어갈 때만** 뜬다 — 정반보다 넓은 칩은 어느 정반을
 *     가리키는지 말하지 못한다. 그래서 폭은 정반의 화면 폭에서 나오고, 넘치는 글자는
 *     자른다(전체 값은 title 로 남는다).
 *  2. 그래도 겹치면 **큰 정반이 이긴다** — 확대할수록 작은 정반의 칩이 하나씩 살아나는
 *     쪽이, 전부 사라지거나 전부 겹치는 쪽보다 읽힌다. 고른 정반은 크기와 무관하게
 *     가장 먼저 자리를 잡는다 (고른 것이 사라지면 고른 뜻이 없다).
 */
function planBayChips(
  shops: YardShop[],
  view: YardView,
  viewport: Viewport,
  selectedBayId: string | null | undefined
): BayChipPlacement[] {
  const candidates: (BayChipPlacement & { area: number; selected: boolean })[] = []
  /* 3D 에서는 세운 정반의 **꼭대기**에 붙인다 — 바닥에 두면 제 옆면에 가린다 */
  const altitude = view.pitch > 0 ? RELIEF_METERS.bay : 0

  for (const shop of shops) {
    for (const bay of shop.bays) {
      /*
       * 정반이 화면에서 차지하는 상자 — 기울이거나 돌리면 위경도 상자의 두 모서리만
       * 봐서는 크기가 나오지 않는다(모서리 넷이 사다리꼴로 흩어진다). 넷을 다 재서
       * 화면 상자를 잡으면 2D·3D 가 같은 코드를 쓴다.
       */
      const box = screenBox([
        worldToScreen(view, viewport, bay.bounds.maxLat, bay.bounds.minLon, altitude),
        worldToScreen(view, viewport, bay.bounds.maxLat, bay.bounds.maxLon, altitude),
        worldToScreen(view, viewport, bay.bounds.minLat, bay.bounds.maxLon, altitude),
        worldToScreen(view, viewport, bay.bounds.minLat, bay.bounds.minLon, altitude),
      ])
      const boxWidth = box.w
      const boxHeight = box.h
      if (boxHeight < CHIP_HEIGHT + 4) continue

      const width = Math.min(CHIP_MAX_WIDTH, boxWidth - 8)
      if (width < CHIP_MIN_WIDTH) continue

      const center = worldToScreen(view, viewport, bay.center.lat, bay.center.lon, altitude)
      if (
        center.sx < -CULL_MARGIN ||
        center.sy < -CULL_MARGIN ||
        center.sx > viewport.width + CULL_MARGIN ||
        center.sy > viewport.height + CULL_MARGIN
      ) {
        continue
      }

      candidates.push({
        shop,
        bay,
        left: center.sx,
        top: center.sy,
        width,
        showBlock: width >= CHIP_BLOCK_WIDTH,
        area: boxWidth * boxHeight,
        selected: bay.locationId === selectedBayId,
      })
    }
  }

  candidates.sort((p, q) => Number(q.selected) - Number(p.selected) || q.area - p.area)

  const placed: Rect[] = []
  const chips: BayChipPlacement[] = []
  for (const candidate of candidates) {
    const rect: Rect = {
      x: candidate.left - candidate.width / 2,
      y: candidate.top - CHIP_HEIGHT / 2,
      w: candidate.width,
      h: CHIP_HEIGHT,
    }
    if (placed.some((other) => overlaps(rect, other))) continue
    placed.push(rect)
    chips.push(candidate)
  }
  return chips
}

interface YardShopChipsProps {
  shops: YardShop[]
  view: YardView
  viewport: Viewport
  mapTheme: MapTheme
  selectedBayId?: string | null
  hoveredBayId?: string | null
  onHoverBay?: (locationId: string | null) => void
  /** 이름줄을 눌렀을 때 — 그 공장이 다 보이도록 맵을 맞춘다 */
  onFocusShop: (shop: YardShop) => void
  /** 공장 화면 경로 — 맵은 앱의 라우팅 규칙을 알지 않는다 */
  shopHref: (shop: YardShop) => string
  /** 정반 3D 화면 경로 */
  bayHref: (bay: YardShopBay) => string
}

/**
 * 맵 위에 뜨는 조립공장 이름줄과 정반 칩.
 *
 * 캔버스가 아니라 DOM 이다 — 글자가 또렷하고(테마·글자 크기 설정을 그대로 따른다),
 * 무엇보다 **누를 수 있는 것이어야** 한다. 캔버스 위의 그림은 탭으로 옮겨 갈 수도,
 * 스크린리더가 읽을 수도 없다. 야드 위 도형에서 그 정반의 3D 화면으로 바로 들어가는
 * 것이 이 레이어의 목적이라, 링크는 진짜 링크(`<a>`)여야 한다.
 *
 * 배율에 따라 셋으로 자란다: 이름만 → 이름 + 수치 → 정반 칩. 야드 전체를 보는 배율에
 * 정반 일곱 개의 칩을 다 낼 자리는 없고, 그 배율에서 알아야 할 것은 "감시하는 공장이
 * 야드의 어디인가"뿐이다.
 */
export function YardShopChips({
  shops,
  view,
  viewport,
  mapTheme,
  selectedBayId,
  hoveredBayId,
  onHoverBay,
  onFocusShop,
  shopHref,
  bayHref,
}: YardShopChipsProps) {
  const { t } = useTranslation()
  const palette = paletteOf(mapTheme)
  if (viewport.width === 0) return null

  const showStats = view.scale >= SHOP_STATS_MIN_SCALE
  const chips = planBayChips(shops, view, viewport, selectedBayId)

  const onScreen = (sx: number, sy: number) =>
    sx > -CULL_MARGIN &&
    sy > -CULL_MARGIN &&
    sx < viewport.width + CULL_MARGIN &&
    sy < viewport.height + CULL_MARGIN

  return (
    /* 레이어 자체는 클릭을 통과시킨다 — 맵을 끌고 확대하는 일이 막히면 안 된다 */
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {shops.map((shop) => {
        /* 이름줄은 공장 **위쪽 모서리**에 세운다 — 가운데 두면 정반 칩과 겹친다 */
        const top = shop.hull.reduce((best, point) => (point.lat > best.lat ? point : best))
        /* 3D 에서는 세운 높이만큼 같이 올린다 — 이름줄이 공장 옆면에 파묻히지 않도록 */
        const anchor = worldToScreen(
          view,
          viewport,
          top.lat,
          shop.center.lon,
          view.pitch > 0 ? RELIEF_METERS.bay : 0,
        )
        if (!onScreen(anchor.sx, anchor.sy)) return null
        const sensorFault = shop.sensorOnline < shop.sensorTotal

        return (
          <div
            key={shop.factoryId}
            style={{ left: anchor.sx, top: anchor.sy }}
            className="absolute flex -translate-x-1/2 -translate-y-full flex-col items-center"
          >
            <div className="pointer-events-auto flex items-stretch overflow-hidden rounded-inshop-md glass-panel">
              <button
                type="button"
                onClick={() => onFocusShop(shop)}
                title={t('yard.shop.focusTitle', { name: shop.name })}
                className={cn(
                  'flex min-h-8 items-center gap-1.5 px-2 py-1 text-left transition-colors',
                  'hover:bg-glass-hover',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-glass-accent',
                )}
              >
                {/*
                 * 여기의 점은 상태가 아니라 **감시 중**이라는 표시다 — 공장 단위의 상태는
                 * 없는 개념이라(정반마다 다르다), 색을 상태로 읽히게 두면 거짓말이 된다.
                 */}
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: palette.shopHull }}
                />
                <span className="whitespace-nowrap text-2xs font-semibold text-glass-foreground">
                  {shop.name}
                </span>
                {showStats && (
                  <span className="whitespace-nowrap font-mono text-2xs text-glass-foreground/54">
                    {shop.assyShop}
                  </span>
                )}
              </button>

              {/* 공장 화면으로 — 이름줄을 누르면 확대이므로, 이동은 따로 둔다 */}
              <Link
                to={shopHref(shop)}
                aria-label={t('yard.shop.openShop', { name: shop.name })}
                title={t('yard.shop.openShop', { name: shop.name })}
                className={cn(
                  'flex min-h-8 shrink-0 items-center border-l border-glass-border/70 px-1.5',
                  'text-glass-foreground/58 transition-colors hover:bg-glass-hover hover:text-glass-foreground',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-glass-accent',
                )}
              >
                <ChevronRightIcon size={12} />
              </Link>
            </div>

            {showStats && (
              <div className="mt-0.5 flex items-center gap-1.5 whitespace-nowrap rounded-inshop-xs glass-panel px-1.5 py-0.5 font-mono text-2xs tabular-nums text-glass-foreground/72">
                <span>
                  {t('yard.shop.bays', { occupied: shop.occupied, total: shop.bayTotal })}
                </span>
                <span aria-hidden="true" className="text-glass-foreground/30">
                  ·
                </span>
                <span className={sensorFault ? 'text-glass-degraded' : undefined}>
                  {t('yard.shop.lidar', { online: shop.sensorOnline, total: shop.sensorTotal })}
                </span>
                <span aria-hidden="true" className="text-glass-foreground/30">
                  ·
                </span>
                <span>{t('yard.shop.today', { count: shop.todayCount })}</span>
              </div>
            )}

            {/* 이름줄과 공장을 잇는 짧은 선 — 어느 도형을 말하는지 이것이 정한다 */}
            <span aria-hidden="true" className="h-2.5 w-px bg-glass-accent/50" />
          </div>
        )
      })}

      {chips.map(({ shop, bay, left, top, width, showBlock }) => {
        const active = bay.locationId === selectedBayId
        const hovered = bay.locationId === hoveredBayId
        const blockLabel =
          bay.projNo && bay.blkNo ? `${bay.projNo}-${bay.blkNo}` : t('yard.shop.vacant')

        return (
          <Link
            key={bay.locationId}
            to={bayHref(bay)}
            style={{ left, top, width }}
            onPointerEnter={() => onHoverBay?.(bay.locationId)}
            onPointerLeave={() => onHoverBay?.(null)}
            onFocus={() => onHoverBay?.(bay.locationId)}
            onBlur={() => onHoverBay?.(null)}
            aria-label={t('yard.shop.openBay', { shop: shop.name, bay: bay.name })}
            title={t('yard.shop.bayTitle', {
              shop: shop.name,
              bay: bay.name,
              code: bay.workCntr,
              block: blockLabel,
            })}
            className={cn(
              'pointer-events-auto absolute flex -translate-x-1/2 -translate-y-1/2 items-center',
              'gap-1.5 overflow-hidden rounded-inshop-md glass-panel px-1.5 py-1 transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-glass-accent',
              active || hovered ? 'bg-glass-active' : 'hover:bg-glass-hover',
            )}
          >
            {/*
             * 상태는 점 색으로만 말하지 않는다 — 색을 못 가리는 눈에도 정반 이름과
             * 블록번호(또는 '공석')가 남고, 전체 값은 title 이 들고 있다.
             */}
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: bayColor(bay.status, palette) }}
            />
            <span className="truncate text-2xs font-semibold text-glass-foreground">
              {bay.name}
            </span>
            {showBlock && (
              <span className="ml-auto shrink-0 font-mono text-2xs text-glass-foreground/63">
                {blockLabel}
              </span>
            )}
          </Link>
        )
      })}
    </div>
  )
}
