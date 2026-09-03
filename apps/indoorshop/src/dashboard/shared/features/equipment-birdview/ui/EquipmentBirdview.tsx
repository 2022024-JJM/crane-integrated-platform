import { useMemo, useState } from 'react'
import { cn } from '../../../lib/utils'
import { STATUS_STYLE, type StatusMeaning } from '../../../ui/statusPalette'
import type { LatLon } from '../../../entities/yard-parcels'
import { boundsOfPoints, fitProjection, pathOf } from '../lib/projection'
import { convexHullOf } from '../lib/hull'
import { declusterPoints } from '../lib/decluster'
import type { BirdviewBay, BirdviewPoint } from '../model/types'

/*
 * ── 설비 버드뷰 — 공장 하나를 위에서 곧게 내려다본 2D 벡터 그림 ──
 *
 * 그리드는 "무엇이 몇 대 있고 어느 것이 이상인가"를 답하지만 **"어디"** 는 답하지 못한다.
 * 라이다가 죽었을 때 다음 질문은 늘 "그게 어느 자리냐" 이고, 그 답은 목록이 아니라 그림이다.
 *
 * 판단 셋:
 *  · **벡터(SVG)** 로 그린다. 캔버스로 그리면 hover/click 판정을 좌표로 다시 짜야 하는데,
 *    여기서 필요한 상호작용은 "이 점에 마우스가 올라갔나" 하나뿐이라 DOM 이 이미 잘한다.
 *    설비는 공장당 수십~백 점이라 DOM 으로 충분하다(야드 전체 지도와는 규모가 다르다).
 *  · **모양이 종류, 색이 상태.** 색만으로 종류까지 말하면 색각 이상에서 둘 다 사라진다.
 *  · **id 가 그리드 셀과 같다.** 두 층의 링킹은 그 값 하나로 이어진다 — 라이다·틸팅 페어가
 *    한 점인 것도 셀이 한 칸인 것과 같은 이유다.
 *
 * ── 그리기 규칙은 야드 맵의 하우스룰을 그대로 따른다 (R25) ──
 *  1. **그리는 순서가 곧 의미 순서다**: 공장 바닥 → 공장 외곽 → 베이 → 베이 이름 →
 *     정상 설비 → 이상 설비 → 강조. 나중에 그린 것이 위에 남는다.
 *  2. **두 겹 선(two-ply)**: 어떤 바탕 위에 놓일지 모르는 경계선은 넓은 무채 받침선을 깔고
 *     그 위에 진짜 선을 얹는다. 한 겹이면 어두운 바탕에서 사라진다.
 *  3. **색은 상태에만.** 공장 외곽·베이 선·이름은 전부 무채다 — 경계선에 색을 주면 없는
 *     뜻이 생긴다.
 *  4. **읽히지 않을 것은 그리지 않는다.** 칸이 좁으면 이름을 적지 않는다(줄이지 않는다).
 *  5. **상태를 튕기지 않고 물린다.** 강조·감쇄는 전부 transition 을 탄다.
 */

/** 종류 → 모양. 색이 아니라 모양이 종류를 말한다 */
function Glyph({
  typeId,
  x,
  y,
  size,
}: {
  typeId: string
  x: number
  y: number
  size: number
}) {
  const half = size / 2
  /* 받침(halo)은 바탕색 — 선 위에 놓여도 점이 끊기지 않는다(두 겹 규칙) */
  const shell = { fill: 'currentColor', stroke: 'var(--color-surface)', strokeWidth: 1.8, strokeLinejoin: 'round' as const }
  if (typeId === 'PNL' || typeId === 'EDGE') {
    /* 캐비닛류 — 모난 사각(아래를 거느리는 쪽) */
    return <rect x={x - half} y={y - half} width={size} height={size} rx={2.5} {...shell} />
  }
  if (typeId === 'GH') {
    /* 가열류 — 위가 뾰족한 삼각 */
    const h = half * 1.15
    return (
      <polygon points={`${x},${y - h} ${x + h},${y + h * 0.78} ${x - h},${y + h * 0.78}`} {...shell} />
    )
  }
  if (typeId === 'DH') {
    /* 제습류 — 마름모 */
    const h = half * 1.2
    return <polygon points={`${x},${y - h} ${x + h},${y} ${x},${y + h} ${x - h},${y}`} {...shell} />
  }
  /* 관측류(라이다·틸팅 페어) — 원 */
  return <circle cx={x} cy={y} r={half} {...shell} />
}

export interface EquipmentBirdviewProps {
  bays: readonly BirdviewBay[]
  points: readonly BirdviewPoint[]
  /** 그리드와 공유하는 선택 — 같은 설비를 두 층이 함께 가리킨다 */
  selectedId: string | null
  onSelectPoint: (id: string | null) => void
  hoveredId: string | null
  onHoverPoint: (id: string | null) => void
  /** 베이를 누르면 그리드가 그 구획으로 점프한다 */
  onSelectBay?: (groupKey: string) => void
  /** 지금 그리드가 보고 있는 구획 — 버드뷰가 그 베이를 밝힌다 */
  activeGroupKey?: string | null
  /** 어두운 바탕(지도 오버레이) 위인가 */
  tone?: 'surface' | 'glass'
  className?: string
  /** 빈 상태 문구 (좌표가 없는 공장) */
  emptyLabel: string
}

const VIEW_W = 1000
const VIEW_H = 420
/** 베이 이름을 적을 최소 칸 크기(뷰박스 단위) — 이보다 좁으면 글자가 서로 겹친다 */
const LABEL_MIN_PX = 34
/** 설비 심볼 지름 — 정상은 물러나고 이상은 한 치수 크다(크기도 위계를 진다) */
const GLYPH_NORMAL = 12
const GLYPH_ISSUE = 16
/** 이 간격 안에 든 점은 서로 밀어낸다. 밀리는 거리는 그 절반까지만 */
const MIN_GAP = 15
const MAX_SHIFT = 7

export function EquipmentBirdview({
  bays,
  points,
  selectedId,
  onSelectPoint,
  hoveredId,
  onHoverPoint,
  onSelectBay,
  activeGroupKey = null,
  tone = 'surface',
  className,
  emptyLabel,
}: EquipmentBirdviewProps) {
  const glass = tone === 'glass'
  const [tooltip, setTooltip] = useState<{ x: number; y: number; point: BirdviewPoint } | null>(
    null
  )

  const projection = useMemo(() => {
    const all: LatLon[] = [
      ...bays.flatMap((bay) => [...bay.hull]),
      ...points.map((point) => point.position),
    ]
    const bounds = boundsOfPoints(all)
    return bounds ? fitProjection(bounds, { width: VIEW_W, height: VIEW_H, padding: 22 }) : null
  }, [bays, points])

  /*
   * 공장 외곽 — 그리는 것 **전부**를 감싸는 한 겹.
   *
   * 베이만으로 감싸면 베이 밖에 선 설비(도장 공장의 도크변 설비가 그렇다)가 외곽선
   * 바깥에 떠서, 그림이 "이 설비는 이 공장 것이 아니다"라고 말하게 된다. 점이 3개를
   * 못 채우면 그리지 않는다 — 선 하나를 외곽이라 부르지 않는다.
   */
  const outline = useMemo(
    () =>
      convexHullOf([
        ...bays.flatMap((bay) => [...bay.hull]),
        ...points.map((point) => point.position),
      ]),
    [bays, points]
  )

  /* 겹친 점 떼어 놓기 — 덮인 점은 없는 점이다 */
  const placed = useMemo(() => {
    if (!projection) return new Map<string, { x: number; y: number }>()
    const raw = points.map((point) => ({ id: point.id, ...projection.project(point.position) }))
    const spread = declusterPoints(raw, { minGap: MIN_GAP, maxShift: MAX_SHIFT })
    return new Map(spread.map((point) => [point.id, { x: point.x, y: point.y }]))
  }, [points, projection])

  if (!projection) {
    return (
      <p
        className={cn(
          'flex items-center justify-center rounded-inshop-lg border border-dashed border-border text-2xs',
          glass ? 'text-glass-foreground/45' : 'text-foreground/45',
          className
        )}
      >
        {emptyLabel}
      </p>
    )
  }

  /*
   * 색은 **CSS 가 고른다** — 클래스를 얹고 `currentColor` 로 칠한다.
   *
   * 처음에는 여기서 hex 를 직접 골랐다가 다크 화면에서 점이 배경에 잠겼다: JS 가 색을
   * 고르면 테마가 바뀌는 것을 따로 구독해야 하고, 그 구독을 빠뜨리면 화면 하나만 밝기를
   * 못 따라간다. 램프·칩이 이미 쓰는 잉크 클래스를 그대로 얹으면 그 문제가 없어진다.
   */
  const ink = (meaning: StatusMeaning) =>
    glass ? STATUS_STYLE[meaning].glassInk : STATUS_STYLE[meaning].ink

  /* 무채 잉크 — 외곽·베이·이름이 함께 쓴다(경계선에 색을 주지 않는다) */
  const chrome = glass ? 'text-white' : 'text-foreground'
  const active = selectedId ?? hoveredId

  return (
    <div className={cn('relative', className)}>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
        className={cn('h-full w-full', chrome)}
        role="img"
        aria-label={emptyLabel}
      >
        {/* ① 공장 바닥 + 외곽 — 안쪽 베이가 비로소 '공장 안의 칸'이 된다 */}
        {outline.length >= 3 && (
          <g className="pointer-events-none">
            <path d={pathOf(outline, projection)} fill="currentColor" opacity={0.04} />
            {/* 두 겹 — 넓은 받침선 위에 진짜 선 */}
            <path
              d={pathOf(outline, projection)}
              fill="none"
              stroke="currentColor"
              strokeWidth={5}
              strokeLinejoin="round"
              opacity={0.06}
            />
            <path
              d={pathOf(outline, projection)}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinejoin="round"
              opacity={0.22}
            />
          </g>
        )}

        {/* ② 베이 — 설비가 어느 칸 안에 있는지가 이 그림의 뼈대다 */}
        {bays.map((bay) => {
          const isActive = activeGroupKey === bay.groupKey
          /*
           * 이름은 **들어갈 자리가 있을 때만** 적는다. 도장 공장처럼 작은 칸이 촘촘히
           * 붙은 곳에서는 이름이 서로 겹쳐 글자 더미가 되고, 그러면 이름이 있는 편이
           * 없는 편보다 읽기 어려워진다. 고른 베이만은 좁아도 적는다(지금 보는 칸이므로).
           */
          const projected = bay.hull.map((point) => projection.project(point))
          const width = Math.max(...projected.map((p) => p.x)) - Math.min(...projected.map((p) => p.x))
          const height = Math.max(...projected.map((p) => p.y)) - Math.min(...projected.map((p) => p.y))
          const roomy = projected.length > 0 && width >= LABEL_MIN_PX && height >= LABEL_MIN_PX
          const centroid =
            roomy || isActive
              ? projection.project({
                  lat: bay.hull.reduce((s, p) => s + p.lat, 0) / bay.hull.length,
                  lon: bay.hull.reduce((s, p) => s + p.lon, 0) / bay.hull.length,
                })
              : null
          const d = pathOf(bay.hull, projection)
          return (
            <g key={bay.id} className="transition-opacity duration-200">
              <path
                data-bay={bay.groupKey}
                d={d}
                className="cursor-pointer"
                fill="currentColor"
                fillOpacity={isActive ? 0.1 : 0.02}
                stroke="currentColor"
                strokeWidth={isActive ? 2.2 : 1.1}
                strokeOpacity={isActive ? 0.5 : 0.2}
                strokeLinejoin="round"
                onClick={() => onSelectBay?.(bay.groupKey)}
              />
              {centroid && (
                <text
                  x={centroid.x}
                  y={centroid.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  /* 글자 뒤에 바탕색 테두리를 깔아 베이 선 위에서도 끊기지 않게 한다 */
                  stroke="var(--color-surface)"
                  strokeWidth={3.5}
                  strokeLinejoin="round"
                  paintOrder="stroke"
                  fill="currentColor"
                  fillOpacity={isActive ? 0.78 : 0.5}
                  className="pointer-events-none select-none text-[13px] font-semibold tracking-[0.06em]"
                >
                  {bay.label}
                </text>
              )}
            </g>
          )
        })}

        {/* ③ 설비 — 이상이 위에 오도록 정상을 먼저 그린다 */}
        {[...points]
          .sort((a, b) => Number(isIssue(a.severity)) - Number(isIssue(b.severity)))
          .map((point) => {
            const at = placed.get(point.id) ?? projection.project(point.position)
            const { x, y } = at
            const isActivePoint = point.id === active
            const issue = isIssue(point.severity)
            const size = issue ? GLYPH_ISSUE : GLYPH_NORMAL
            return (
              <g
                key={point.id}
                data-point={point.id}
                data-severity={point.severity}
                className={cn(
                  'cursor-pointer transition-opacity duration-200',
                  ink(point.severity),
                  /* 하나를 가리키면 나머지는 물러난다 — 튕기지 않고 물린다 */
                  active && !isActivePoint && 'opacity-35'
                )}
                onMouseEnter={(event) => {
                  onHoverPoint(point.id)
                  const box = event.currentTarget.ownerSVGElement?.getBoundingClientRect()
                  const rect = event.currentTarget.getBoundingClientRect()
                  if (box) setTooltip({ x: rect.left - box.left + rect.width / 2, y: rect.top - box.top, point })
                }}
                onMouseLeave={() => {
                  onHoverPoint(null)
                  setTooltip(null)
                }}
                onClick={() => onSelectPoint(point.id === selectedId ? null : point.id)}
              >
                {/* 이상은 은은한 후광을 하나 더 쓴다 — 크기만으로는 멀리서 안 잡힌다 */}
                {issue && (
                  <>
                    <circle cx={x} cy={y} r={size / 2 + 9} fill="currentColor" opacity={0.09} />
                    <circle cx={x} cy={y} r={size / 2 + 5} fill="currentColor" opacity={0.11} />
                  </>
                )}
                {isActivePoint && (
                  <circle
                    cx={x}
                    cy={y}
                    r={size / 2 + 7}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    opacity={0.75}
                  />
                )}
                <Glyph typeId={point.typeId} x={x} y={y} size={size} />
                {/* 클릭 판정을 넉넉히 — 12px 짜리 점을 정확히 겨누게 하지 않는다 */}
                <circle cx={x} cy={y} r={13} fill="transparent" />
              </g>
            )
          })}
      </svg>

      {tooltip && (
        <div
          role="tooltip"
          className={cn(
            'pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-inshop-md px-2 py-1 text-2xs shadow-lg',
            glass
              ? 'bg-[#0b0e12]/95 text-white ring-1 ring-white/15'
              : 'bg-surface text-foreground ring-1 ring-border'
          )}
          style={{ left: tooltip.x, top: tooltip.y - 6 }}
        >
          <p className="font-mono font-semibold">{tooltip.point.tooltip.title}</p>
          <p className={glass ? 'text-white/62' : 'text-foreground/62'}>
            {tooltip.point.tooltip.status} · {tooltip.point.tooltip.freshness}
          </p>
        </div>
      )}
    </div>
  )
}

function isIssue(meaning: StatusMeaning): boolean {
  return meaning === 'error' || meaning === 'warning'
}
