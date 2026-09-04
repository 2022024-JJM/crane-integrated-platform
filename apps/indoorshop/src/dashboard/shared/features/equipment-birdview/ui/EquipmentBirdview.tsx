import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '../../../lib/utils'
import { STATUS_SHAPE, STATUS_STYLE, type StatusMeaning, type StatusShape } from '../../../ui/statusPalette'
import { EquipmentGlyph, symbolOfType } from '../../../entities/equipment/ui/EquipmentSymbol'
import type { LatLon } from '../../../entities/yard-parcels'
import { fitProjection, pathOf } from '../lib/projection'
import { birdviewRotationOf } from '../lib/orientation'
import { bayFrameOf, layoutBlueprint } from '../lib/blueprint'
import type { BirdviewBay, BirdviewCard, BirdviewPoint } from '../model/types'

/*
 * ── 설비 버드뷰 — 공장 하나를 위에서 곧게 내려다본 **도면** ──
 *
 * 그리드는 "무엇이 몇 대 있고 어느 것이 이상인가"를 답하지만 **"어디"** 는 답하지 못한다.
 * 라이다가 죽었을 때 다음 질문은 늘 "그게 어느 자리냐" 이고, 그 답은 목록이 아니라 그림이다.
 *
 * 판단 셋:
 *  · **벡터(SVG)** 로 그린다. 캔버스로 그리면 hover/click 판정을 좌표로 다시 짜야 하는데,
 *    여기서 필요한 상호작용은 "이 점에 마우스가 올라갔나" 하나뿐이라 DOM 이 이미 잘한다.
 *  · **모양이 종류, 색은 아끼기.** 종류는 그리드와 **같은 글리프**가 말하고(R37), 색은
 *    이상에만 쓴다 — 정상까지 색을 두르면 화면이 상시 경보가 되어 진짜 이상이 묻힌다.
 *  · **id 가 그리드 셀과 같다.** 두 층의 링킹은 그 값 하나로 이어진다.
 *
 * ── R35 · 산점도가 아니라 배치도 ──
 * 설비는 실좌표가 아니라 **베이 좌표계 위의 줄**에 선다(`lib/blueprint`). 실좌표대로
 * 찍으면 그림이 얼룩이 되어 "몇 번째 줄 어느 자리"라는 질문에 답하지 못한다. 베이 소속과
 * 종류·앞뒤 순서는 지키고, 센티미터 단위의 편차만 버린다.
 *
 * ── R37 · 아이콘은 그리드의 것을 그대로 ──
 * 그림 안에서만 통하는 도형(원·삼각·마름모)을 따로 두면, 목록의 라이다 칩과 그림의
 * 라이다 점이 서로 다른 그림이 되어 눈이 둘을 잇지 못한다. 그래서 `EquipmentGlyph`
 * **한 벌**을 두 층이 함께 쓰고, 그림 안에서는 색만 모노로 죽인다(잉크 농도가 위계다).
 *
 * ── R41 · 주인공은 베이다 (공장 외곽선을 그리지 않는다) ──
 * 한때 모든 것을 감싸는 볼록 껍질을 공장 외곽으로 둘렀다. 그 선은 **실제 건물 모양이
 * 아니라 점들의 껍질**이라 도면으로 읽는 순간 거짓말이 되고(오목한 공장이 볼록해진다),
 * 베이 구획보다 굵고 크게 서서 눈을 먼저 가져갔다. 사용자가 여러 번 뺄 것을 지시한
 * 이유가 그것이다. 공장 형태는 **베이들의 합**이 자연히 말한다 — 칸 여럿이 모여 선
 * 자리가 곧 공장이고, 그 위에 한 겹 더 두를 필요가 없다.
 * (대시보드 지도의 공장 실루엣은 별개다 — 저쪽은 야드에서 공장을 **찾는** 그림이라
 *  외곽이 곧 정보다. 여기는 이미 공장 하나 안에 들어와 있다.)
 *
 * ── R42 · 도면은 똑바로 선다 ──
 * 회전 보정은 **투영**이 건다(`lib/orientation` + `lib/projection`). 베이 장변이 가로로
 * 서므로 칸도 설비 줄도 직각으로 읽힌다 — 방위를 잃는 대신 도면을 얻는 교환이다.
 *
 * ── 그리기 규칙은 야드 맵의 하우스룰을 그대로 따른다 (R25) ──
 *  1. **그리는 순서가 곧 의미 순서다**: 베이 → 베이 이름 → 정상 설비 → 이상 설비 →
 *     강조. 나중에 그린 것이 위에 남는다.
 *  2. **두 겹 선(two-ply)**: 어떤 바탕 위에 놓일지 모르는 글자·심볼은 바탕색 받침을
 *     깔고 그 위에 얹는다. 심볼은 바탕색 판(plate)이 그 몫을 한다.
 *  3. **색은 상태에만, 그중에서도 이상에만.** 베이 선·이름·정상 심볼은 무채다.
 *  4. **읽히지 않을 것은 그리지 않는다.** 칸이 좁으면 이름을 적지 않는다(줄이지 않는다).
 *  5. **상태를 튕기지 않고 물린다.** 강조·감쇄는 전부 transition 을 탄다.
 */

/** 상태 부호 — 색 단독 금지(팔레트의 모양을 그대로 쓴다) */
function StatusMark({ shape, x, y, r }: { shape: StatusShape; x: number; y: number; r: number }) {
  if (shape === 'square') {
    return <rect x={x - r} y={y - r} width={r * 2} height={r * 2} fill="currentColor" />
  }
  if (shape === 'triangle') {
    return <polygon points={`${x},${y - r} ${x + r},${y + r * 0.82} ${x - r},${y + r * 0.82}`} fill="currentColor" />
  }
  if (shape === 'diamond') {
    return <polygon points={`${x},${y - r} ${x + r},${y} ${x},${y + r} ${x - r},${y}`} fill="currentColor" />
  }
  if (shape === 'dash') {
    return <rect x={x - r} y={y - r * 0.42} width={r * 2} height={r * 0.84} rx={r * 0.42} fill="currentColor" />
  }
  return <circle cx={x} cy={y} r={r} fill="currentColor" />
}

/**
 * 심볼 한 개 — **바탕색 판 + 그리드와 같은 글리프**.
 *
 * 판을 까는 이유는 두 겹 규칙과 같다: 베이 선 위에 놓인 글리프는 선과 뒤엉켜 그림이
 * 아니라 얼룩이 된다. 판이 있으면 어디에 놓여도 심볼이 심볼로 읽히고, 판이 격자에
 * 줄지어 서면 그 자체가 도면의 기호열처럼 보인다.
 */
function BirdviewSymbol({ typeId, x, y, size }: { typeId: string; x: number; y: number; size: number }) {
  const half = size / 2
  const glyph = Math.round(size * 0.66)
  return (
    <g transform={`translate(${x - half} ${y - half})`}>
      <rect
        width={size}
        height={size}
        rx={size * 0.22}
        fill="var(--color-surface)"
        stroke="currentColor"
        strokeOpacity={0.45}
        strokeWidth={1}
      />
      <g transform={`translate(${(size - glyph) / 2} ${(size - glyph) / 2})`}>
        <EquipmentGlyph symbol={symbolOfType(typeId)} size={glyph} />
      </g>
    </g>
  )
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
  /**
   * 태그에 실을 관제 정보 (R36) — **그리드 셀을 쥔 층이 채운다.**
   * 주지 않으면 태그는 머리 세 줄(ID·상태·자리)만 낸다.
   */
  cardOf?: (id: string) => BirdviewCard | null
  /** 어두운 바탕(지도 오버레이) 위인가 */
  tone?: 'surface' | 'glass'
  className?: string
  /** 빈 상태 문구 (좌표가 없는 공장) */
  emptyLabel: string
}

/** 그릇을 재기 전에 쓰는 기본 뷰박스 — 서버·테스트처럼 크기를 알 수 없는 곳의 값 */
const FALLBACK_VIEW = { width: 1000, height: 420 }
/** 베이 이름을 적을 최소 칸 길이(px) — 이보다 짧으면 글자가 서로 겹친다 */
const LABEL_MIN_PX = 34
/** 같은 판정의 폭 — 베이는 대개 가늘고 길어서 두 축에 같은 잣대를 대면 다 지워진다 */
const LABEL_MIN_HEIGHT_PX = 15
/** 심볼 판 한 변 — 정상은 물러나고 이상은 한 치수 크다(크기도 위계를 진다) */
const SYMBOL_NORMAL = 12
const SYMBOL_ISSUE = 14
/** 두 심볼 중심의 최소 간격 = 배치 격자의 눈금 */
const MIN_GAP = 15
/** 이 위쪽에 선 설비는 태그를 아래로 편다 — 카드 한 장이 들어갈 높이 */
const TAG_FLIP_Y = 150

export function EquipmentBirdview({
  bays,
  points,
  selectedId,
  onSelectPoint,
  hoveredId,
  onHoverPoint,
  onSelectBay,
  activeGroupKey = null,
  cardOf,
  tone = 'surface',
  className,
  emptyLabel,
}: EquipmentBirdviewProps) {
  const glass = tone === 'glass'
  /*
   * 뷰박스를 **그릇 크기에 맞춘다** — 그래야 1 뷰박스 단위 = 1 화면 픽셀이 된다.
   *
   * 고정 뷰박스(1000×420)를 쓰면 letterbox 가 두 번 걸린다: 투영이 데이터를 그 상자에
   * 맞추고, 다시 SVG 가 그 상자를 그릇에 맞춘다. 낮고 넓은 패널에서는 그림이 절반
   * 크기로 줄어 심볼이 7px 가 되고, 그러면 어떤 글리프를 쓰든 얼룩으로 보인다.
   * 그릇을 재서 맞추면 심볼 크기·간격을 **픽셀로** 정할 수 있다(그리드 칩과 같은 치수).
   */
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [view, setView] = useState(FALLBACK_VIEW)
  useEffect(() => {
    const node = rootRef.current
    if (!node || typeof ResizeObserver === 'undefined') return
    const sync = () => {
      const width = Math.round(node.clientWidth)
      const height = Math.round(node.clientHeight)
      if (width > 0 && height > 0) setView({ width, height })
    }
    sync()
    const observer = new ResizeObserver(sync)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const projection = useMemo(() => {
    const all: LatLon[] = [
      ...bays.flatMap((bay) => [...bay.hull]),
      ...points.map((point) => point.position),
    ]
    /*
     * 회전각은 **베이가 정한다** (R42). 규칙은 공장을 가리지 않고 하나다 — 베이 장변이
     * 가로. 그릇 모양에 따라 90° 를 더 돌리는 편이 크게 보일 때가 있지만 그렇게 하지
     * 않는다: 창을 줄이는 것만으로 그림이 통째로 돌아 버리면, 방금 본 자리를 다시
     * 찾아야 한다. 자리는 그릇이 아니라 건물이 정해야 한다.
     * 베이가 없으면 0 이라 좌표만 있는 공장은 그대로 북쪽이 위로 남는다.
     */
    const rotation = birdviewRotationOf(bays)
    return fitProjection(all, {
      width: view.width,
      height: view.height,
      padding: 18,
      rotation,
    })
  }, [bays, points, view])

  /* 도면 배치 — 베이의 줄 위에 세운다(실좌표가 아니다, R35) */
  const placed = useMemo(() => {
    if (!projection) return new Map<string, { x: number; y: number }>()
    return layoutBlueprint(
      points.map((point) => ({
        id: point.id,
        typeId: point.typeId,
        bay: point.bay,
        ...projection.project(point.position),
      })),
      bays.map((bay) => ({ groupKey: bay.groupKey, hull: bay.hull.map(projection.project) })),
      { minGap: MIN_GAP }
    )
  }, [bays, points, projection])

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

  /* 무채 잉크 — 외곽·베이·이름·정상 심볼이 함께 쓴다(도면의 선은 색을 갖지 않는다) */
  const chrome = glass ? 'text-white' : 'text-foreground'
  const active = selectedId ?? hoveredId
  /* 태그는 **고른 것**을 따라간다 — 알람 딥링크(?equip=)로 들어와도 카드가 서 있다 */
  const tagged = points.find((point) => point.id === active) ?? null
  const tagAt = tagged ? (placed.get(tagged.id) ?? projection.project(tagged.position)) : null
  const card = tagged && cardOf ? cardOf(tagged.id) : null

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <svg
        viewBox={`0 0 ${view.width} ${view.height}`}
        preserveAspectRatio="xMidYMid meet"
        className={cn('h-full w-full', chrome)}
        role="img"
        aria-label={emptyLabel}
      >
        {/* ① 베이 — 이 그림의 주인공이자 유일한 뼈대다 (R41) */}
        {bays.map((bay) => {
          const isActive = activeGroupKey === bay.groupKey
          /*
           * 이름은 **들어갈 자리가 있을 때만** 적는다. 도장 공장처럼 작은 칸이 촘촘히
           * 붙은 곳에서는 이름이 서로 겹쳐 글자 더미가 되고, 그러면 이름이 있는 편이
           * 없는 편보다 읽기 어려워진다. 고른 베이만은 좁아도 적는다(지금 보는 칸이므로).
           */
          const projected = bay.hull.map((point) => projection.project(point))
          /*
           * 이름은 **베이 자신의 축**을 기준으로 놓는다. 화면 축의 경계상자를 쓰면 비스듬한
           * 베이에서 이름이 칸 밖 모서리로 달아나 어느 칸의 이름인지 알 수 없게 된다.
           * 자리는 칸 가운데가 아니라 단변 쪽 벽 — 가운데는 설비 줄이 지나가는 자리다.
           */
          const frame = bayFrameOf(projected)
          const roomy =
            frame !== null &&
            frame.halfU * 2 >= LABEL_MIN_PX &&
            frame.halfV * 2 >= LABEL_MIN_HEIGHT_PX
          const anchor =
            frame && (roomy || isActive)
              ? {
                  x: frame.cx + frame.vx * (frame.halfV - 6),
                  y: frame.cy + frame.vy * (frame.halfV - 6),
                }
              : null
          const d = pathOf(bay.hull, projection)
          return (
            <g key={bay.id} className="transition-opacity duration-200">
              <path
                data-bay={bay.groupKey}
                d={d}
                className="cursor-pointer"
                fill="currentColor"
                fillOpacity={isActive ? 0.09 : 0.018}
                stroke="currentColor"
                strokeWidth={isActive ? 1.8 : 0.9}
                strokeOpacity={isActive ? 0.5 : 0.24}
                strokeLinejoin="miter"
                onClick={() => onSelectBay?.(bay.groupKey)}
              />
              {anchor && (
                <text
                  x={anchor.x}
                  y={anchor.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  /* 글자 뒤에 바탕색 테두리를 깔아 베이 선 위에서도 끊기지 않게 한다 */
                  stroke="var(--color-surface)"
                  strokeWidth={3}
                  strokeLinejoin="round"
                  paintOrder="stroke"
                  fill="currentColor"
                  fillOpacity={isActive ? 0.75 : 0.42}
                  className="pointer-events-none select-none font-mono text-[10px] font-semibold tracking-[0.12em]"
                >
                  {bay.label}
                </text>
              )}
            </g>
          )
        })}

        {/* ② 설비 — 이상이 위에 오도록 정상을 먼저 그린다 */}
        {[...points]
          .sort((a, b) => Number(isIssue(a.severity)) - Number(isIssue(b.severity)))
          .map((point) => {
            const { x, y } = placed.get(point.id) ?? projection.project(point.position)
            const isActivePoint = point.id === active
            const issue = isIssue(point.severity)
            const size = issue ? SYMBOL_ISSUE : SYMBOL_NORMAL
            return (
              <g
                key={point.id}
                data-point={point.id}
                data-severity={point.severity}
                className={cn(
                  'cursor-pointer transition-opacity duration-200',
                  /*
                   * 잉크 농도만으로 위계를 진다(R37 모노). 정상은 물러나 도면의 일부가
                   * 되고, 이상은 같은 무채라도 진하게 서며, 상태색은 아래 배지 하나에만
                   * 실린다 — 정상까지 초록으로 빛나면 이상이 묻힌다(R18·R27).
                   */
                  chrome,
                  isActivePoint ? 'opacity-100' : issue ? 'opacity-95' : 'opacity-60',
                  /* 하나를 가리키면 나머지는 물러난다 — 튕기지 않고 물린다 */
                  active && !isActivePoint && 'opacity-30'
                )}
                onMouseEnter={() => onHoverPoint(point.id)}
                onMouseLeave={() => onHoverPoint(null)}
                onClick={() => onSelectPoint(point.id === selectedId ? null : point.id)}
              >
                {isActivePoint && (
                  <rect
                    x={x - size / 2 - 4}
                    y={y - size / 2 - 4}
                    width={size + 8}
                    height={size + 8}
                    rx={4}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    opacity={0.8}
                  />
                )}
                <BirdviewSymbol typeId={point.typeId} x={x} y={y} size={size} />
                {/*
                  이상만 상태색을 얻는다 — 심볼 어깨에 얹힌 작은 부호 하나.
                  색과 **모양**을 함께 내므로 색각 이상에서도 살아남는다.
                */}
                {issue && (
                  <g className={ink(point.severity)}>
                    <circle
                      cx={x + size / 2}
                      cy={y - size / 2}
                      r={4.4}
                      fill="var(--color-surface)"
                    />
                    <StatusMark
                      shape={STATUS_SHAPE[point.severity]}
                      x={x + size / 2}
                      y={y - size / 2}
                      r={3}
                    />
                  </g>
                )}
                {/* 클릭 판정을 넉넉히 — 14px 짜리 판을 정확히 겨누게 하지 않는다 */}
                <circle cx={x} cy={y} r={MIN_GAP / 2} fill="transparent" />
              </g>
            )
          })}
      </svg>

      {tagged && tagAt && (
        <div
          role="tooltip"
          className={cn(
            'pointer-events-none absolute z-10 w-max max-w-[15rem] -translate-x-1/2 rounded-inshop-md px-2 py-1.5 shadow-lg',
            glass
              ? 'bg-[#0b0e12]/95 text-white ring-1 ring-white/15'
              : 'bg-surface text-foreground ring-1 ring-border',
            /* 위쪽 설비는 카드가 그림 밖으로 넘쳐 머리글을 덮는다 — 그럴 때는 아래로 편다 */
            tagAt.y > TAG_FLIP_Y && '-translate-y-full'
          )}
          style={{
            left: Math.min(Math.max(tagAt.x, 96), Math.max(96, view.width - 96)),
            top: tagAt.y > TAG_FLIP_Y ? tagAt.y - SYMBOL_ISSUE : tagAt.y + SYMBOL_ISSUE,
          }}
        >
          {/* 머리 — 무엇인가 · 지금 어떤가 */}
          <p className="flex items-center gap-1.5 font-mono text-2xs font-semibold">
            <span className={cn('shrink-0', glass ? 'text-white/70' : 'text-foreground/70')}>
              <EquipmentGlyph symbol={symbolOfType(tagged.typeId)} size={12} />
            </span>
            <span className="truncate">{tagged.tooltip.title}</span>
          </p>
          <p className={cn('mt-0.5 text-2xs', ink(tagged.severity))}>{tagged.tooltip.status}</p>
          {/* 소재 — 공장·베이 */}
          <p className={cn('text-2xs', glass ? 'text-white/55' : 'text-foreground/55')}>
            {card?.place ?? tagged.tooltip.freshness}
          </p>

          {card && (
            <>
              {/* 램프 — 그리드 셀의 그것 그대로(같은 원천·같은 값) */}
              {card.lamps && card.lamps.length > 0 && (
                <ul
                  className={cn(
                    'mt-1 flex flex-col gap-0.5 border-t pt-1',
                    glass ? 'border-white/12' : 'border-border'
                  )}
                >
                  {card.lamps.map((lamp) => (
                    <li key={lamp.label} className="flex items-center gap-1.5 text-2xs">
                      <svg width={7} height={7} viewBox="-4 -4 8 8" className={ink(lamp.meaning)}>
                        <StatusMark shape={STATUS_SHAPE[lamp.meaning]} x={0} y={0} r={3.2} />
                      </svg>
                      <span className={glass ? 'text-white/55' : 'text-foreground/55'}>
                        {lamp.label}
                      </span>
                      {lamp.value && (
                        <span className="ml-auto font-mono tabular-nums">{lamp.value}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {/* 종류별 핵심 특성값 — 각도·온도·소속 (R19) */}
              {card.note && (
                <p
                  className={cn(
                    'mt-1 font-mono text-2xs tabular-nums',
                    glass ? 'text-white/68' : 'text-foreground/68'
                  )}
                >
                  {card.note}
                </p>
              )}
              {/* 최근 신호 — 그리드의 핵심 수치와 같은 값 */}
              {card.metric && (
                <p className={cn('font-mono text-2xs tabular-nums', ink(card.metric.meaning))}>
                  {card.metric.text}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function isIssue(meaning: StatusMeaning): boolean {
  return meaning === 'error' || meaning === 'warning'
}
