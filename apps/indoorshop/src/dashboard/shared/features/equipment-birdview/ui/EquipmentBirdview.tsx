import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { cn } from '../../../lib/utils'
import { useEscapeKey } from '../../../lib/useEscapeKey'
import { STATUS_SHAPE, STATUS_STYLE, type StatusMeaning, type StatusShape } from '../../../ui/statusPalette'
import {
  EquipmentGlyph,
  EquipmentSymbolChip,
  colorOfType,
  symbolOfType,
} from '../../../entities/equipment/ui/EquipmentSymbol'
import { useEquipmentTypeLabel } from '../../../entities/equipment/ui/useEquipmentTypeLabel'
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
 * 심볼 한 개 — **판 + 그리드와 같은 글리프**.
 *
 * 판을 까는 이유는 두 겹 규칙과 같다: 베이 선 위에 놓인 글리프는 선과 뒤엉켜 그림이
 * 아니라 얼룩이 된다. 판이 있으면 어디에 놓여도 심볼이 심볼로 읽히고, 판이 격자에
 * 줄지어 서면 그 자체가 도면의 기호열처럼 보인다.
 *
 * ── 종류색 (`colored`) ──
 * 무채로만 그리면 57개의 판이 똑같은 회색 상자가 되고, 종류는 12px 판 안의 8px 글리프
 * 하나에 걸린다 — 그 크기에서 라이다와 캐비닛은 구분되지 않는다. 그런데 이 앱에는 이미
 * 종류색 문법이 있다: 목록의 `EquipmentSymbolChip`(종류색 판 + 흰 글리프)이다. 지도가
 * 그 문법을 안 쓰고 있어서, 그 칩의 주석이 약속한 **"지도의 저 표시 = 목록의 이 줄"이
 * 정작 성립하지 않았다.** 그래서 같은 칩을 그대로 그린다 — 새 어휘를 만드는 것이 아니라
 * 이미 있던 것을 지도까지 잇는다.
 *
 * 색이 상태를 덮지 않는가: 덮지 않는다. **자리가 다르다.** 종류색은 판(무엇인가)이고
 * 상태색은 어깨의 부호(지금 어떤가)다 — `statusPalette` 가 공정색과 상태색을 가르는
 * 방식과 같다. 게다가 정상은 여전히 물러나고(투명도), 이상만 한 치수 크게 서며 상태색
 * 배지를 얻는다. 이상은 전체의 1% 미만이라 색이 늘어도 먼저 눈에 드는 쪽은 그대로다.
 */
function BirdviewSymbol({
  typeId,
  x,
  y,
  size,
  colored,
}: {
  typeId: string
  x: number
  y: number
  size: number
  colored: boolean
}) {
  const half = size / 2
  const glyph = Math.round(size * 0.66)
  const color = colorOfType(typeId)
  return (
    <g transform={`translate(${x - half} ${y - half})`}>
      <rect
        width={size}
        height={size}
        rx={size * 0.22}
        /* 색은 여기서 고르지 않는다 — 표시색 층(`ui/typeColor`)이 바탕·글리프와의
           대비까지 감안해 정해 둔 값이고, 목록 칩이 쓰는 것과 같은 값이다 */
        fill={colored ? color : 'var(--color-surface)'}
        /* 흰 테두리는 어두운 종류색 판이 어두운 바탕에 잠기지 않게 한다(칩과 같은 규칙) */
        stroke={colored ? 'rgba(255,255,255,0.42)' : 'currentColor'}
        strokeOpacity={colored ? 1 : 0.45}
        strokeWidth={1}
      />
      <g
        transform={`translate(${(size - glyph) / 2} ${(size - glyph) / 2})`}
        color={colored ? '#fff' : undefined}
      >
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
  /**
   * 종류색으로 그릴 것인가 — 심볼 판이 목록의 종류 칩과 같은 색이 되고, 아래에 **범례**가
   * 선다. 기본은 지금까지 그대로(무채).
   *
   * 켤 자리: 한 그림에 **여러 종류**가 섞여 서는 공장(조립 — 라이다·틸팅·Edge PC·캐비닛).
   * 끌 자리: 사실상 한 종류만 서는 그림. 거기서는 색이 아무것도 가르지 않고 소음만 된다.
   */
  colorByType?: boolean
  className?: string
  /** 빈 상태 문구 (좌표가 없는 공장) */
  emptyLabel: string
}

/**
 * 범례 — **읽는 법이자 찾는 손잡이**.
 *
 * 색을 넣으면 범례는 선택이 아니라 의무다: 보라가 라이다라는 것을 아는 길이 화면에 없으면
 * 색은 장식이 된다. 그런데 범례를 이왕 세울 바에는 **누를 수 있어야** 한다 — 이 그림 앞에
 * 선 사람의 다음 질문은 대개 "그래서 판넬이 어디 있나" 이고, 그 답은 목록이 아니라
 * 나머지를 지운 그림이다. 한 번 더 누르면 원래대로 돌아온다.
 *
 * 대수를 함께 적는 이유는 범례가 곧 요약이기 때문이다 — 종류별 대수를 보려고 다른 곳을
 * 찾아가지 않아도 된다.
 */
function BirdviewLegend({
  points,
  isolated,
  onIsolate,
  glass,
}: {
  points: readonly BirdviewPoint[]
  isolated: string | null
  onIsolate: (typeId: string | null) => void
  glass: boolean
}) {
  const labelOf = useEquipmentTypeLabel()
  /* 있는 종류만, 많은 순으로 — 없는 종류를 적으면 범례가 그림을 설명하지 않는다 */
  const entries = useMemo(() => {
    const counts = new Map<string, { total: number; issues: number }>()
    for (const point of points) {
      const bucket = counts.get(point.typeId) ?? { total: 0, issues: 0 }
      bucket.total += 1
      if (isIssue(point.severity)) bucket.issues += 1
      counts.set(point.typeId, bucket)
    }
    return [...counts.entries()].sort((a, b) => b[1].total - a[1].total || a[0].localeCompare(b[0]))
  }, [points])

  if (entries.length === 0) return null

  return (
    <ul className="mt-1.5 flex flex-wrap items-center gap-x-1 gap-y-1">
      {entries.map(([typeId, count]) => {
        const on = isolated === typeId
        return (
          <li key={typeId}>
            <button
              type="button"
              aria-pressed={on}
              onClick={() => onIsolate(on ? null : typeId)}
              className={cn(
                'flex items-center gap-1.5 rounded-inshop-md px-1.5 py-1 text-2xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                on
                  ? glass
                    ? 'bg-white/12 text-glass-foreground'
                    : 'bg-surface-secondary text-foreground'
                  : glass
                    ? 'text-glass-foreground/62 hover:bg-white/8'
                    : 'text-foreground/62 hover:bg-surface-secondary',
                /* 하나를 고르면 나머지는 물러난다 — 그림이 하는 일과 같게 */
                isolated && !on && 'opacity-50'
              )}
            >
              <EquipmentSymbolChip typeId={typeId} size={13} />
              <span>{labelOf(typeId)}</span>
              <span className="font-mono tabular-nums opacity-70">{count.total}</span>
              {count.issues > 0 && (
                <span className="flex items-center gap-0.5 font-mono tabular-nums text-status-degraded">
                  <svg width={7} height={7} viewBox="-4 -4 8 8" aria-hidden="true">
                    <StatusMark shape={STATUS_SHAPE.warning} x={0} y={0} r={3.2} />
                  </svg>
                  {count.issues}
                </span>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/** 그릇을 재기 전에 쓰는 기본 뷰박스 — 서버·테스트처럼 크기를 알 수 없는 곳의 값 */
const FALLBACK_VIEW = { width: 1000, height: 420 }
/**
 * 심볼 판 한 변 — 정상은 물러나고 이상은 한 치수 크다(크기도 위계를 진다).
 *
 * 12px 이었다. 그 크기에서는 판 안의 글리프가 8px 라 종류가 갈리지 않았고, 종류색을
 * 넣어도 색 조각으로만 보였다 — 도면이라기보다 점 뿌리기였다. 목록의 종류 칩(14px)과
 * 같은 치수로 올려 두 층이 같은 그림으로 읽히게 한다.
 */
const SYMBOL_NORMAL = 15
const SYMBOL_ISSUE = 17
/** 두 심볼 중심의 최소 간격 = 배치 격자의 눈금. 판이 커진 만큼 함께 벌린다 */
const MIN_GAP = 19
/** 이 위쪽에 선 설비는 태그를 아래로 편다 — 카드 한 장이 들어갈 높이 */
const TAG_FLIP_Y = 150
/** 베이 번호패가 칸 밖으로 떨어지는 거리 */
const TAG_OUT = 13

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
  colorByType = false,
  className,
  emptyLabel,
}: EquipmentBirdviewProps) {
  const glass = tone === 'glass'
  /* 범례에서 고른 종류 — 그림이 그 종류만 남긴다("판넬이 어디 있나") */
  const [isolatedType, setIsolatedType] = useState<string | null>(null)
  /*
   * ESC — 키보드로 들어온 사람에게도 놓는 길이 있어야 한다.
   *
   * 여기서는 **범례 고름만** 푼다. 고른 설비는 목록과 함께 쥐고 있는 값이라 보드가 푼다 —
   * 아무것도 안 잡고 있으면 `false` 를 돌려 그쪽으로 넘긴다(한 번에 한 동작).
   */
  useEscapeKey(() => {
    if (isolatedType === null) return false
    setIsolatedType(null)
  })
  /* 그림자 필터의 id — 한 화면에 버드뷰가 둘 서도 서로의 필터를 훔치지 않게 */
  const shadowId = `birdview-shadow-${useId().replace(/[:]/g, '')}`
  /*
   * 뷰박스를 **그릇 크기에 맞춘다** — 그래야 1 뷰박스 단위 = 1 화면 픽셀이 된다.
   *
   * 고정 뷰박스(1000×420)를 쓰면 letterbox 가 두 번 걸린다: 투영이 데이터를 그 상자에
   * 맞추고, 다시 SVG 가 그 상자를 그릇에 맞춘다. 낮고 넓은 패널에서는 그림이 절반
   * 크기로 줄어 심볼이 7px 가 되고, 그러면 어떤 글리프를 쓰든 얼룩으로 보인다.
   * 그릇을 재서 맞추면 심볼 크기·간격을 **픽셀로** 정할 수 있다(그리드 칩과 같은 치수).
   */
  const rootRef = useRef<HTMLDivElement | null>(null)
  const frameRef = useRef<HTMLDivElement | null>(null)
  const [view, setView] = useState(FALLBACK_VIEW)
  useEffect(() => {
    const node = frameRef.current
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

  /*
   * 베이 이름의 자리 — **설비보다 나중에 그리려고** 미리 뽑아 둔다.
   *
   * 예전에는 베이 층 안에서 함께 그렸고, 그래서 설비가 많은 칸에서는 이름이 심볼 판 밑에
   * 깔려 아예 보이지 않았다(PBS 의 5·6·7 번 베이가 그랬다). 판은 불투명하므로 밑에 깔면
   * 없는 것과 같다 — 그런데 "지금 몇 번 베이를 보고 있나"는 이 그림의 첫 번째 질문이다.
   *
   * 그렇다고 맨 위로 올리지는 않는다. 이름이 이상 배지를 덮으면 그건 더 나쁜 교환이다.
   * 자리는 **정상 설비 위, 이상 설비 아래** — 집이 순서로 뜻을 나르는 이 그림의 규칙(R25-1)
   * 그대로다. 글자 뒤 바탕색 테두리(두 겹 규칙)가 심볼 위에서도 글자를 끊기지 않게 한다.
   */
  const bayLabels = bays.flatMap((bay) => {
    const isActive = activeGroupKey === bay.groupKey
    const frame = bayFrameOf(bay.hull.map((point) => projection.project(point)))
    if (!frame) return []
    /*
     * 번호패는 칸 **밖, 장변의 끝**에 단다.
     *
     * 안쪽에 두었더니 설비 줄 한가운데에 앉았다 — 배치가 줄로 서는 그림에서 칸 안쪽은
     * 전부 설비의 자리라 이름이 놓일 빈 자리가 없다. 밖으로 빼면 어떤 칸이든 규칙이
     * 하나가 되고("칸 왼쪽 끝의 패가 그 칸의 번호"), 도면의 행 번호처럼 한 줄로 늘어서
     * 눈이 위아래로 훑을 수 있다. 좁은 칸만 예외로 두던 규칙도 사라진다.
     *
     * 두 끝 중 **화면 왼쪽·위**를 고른다 — 패가 칸마다 다른 쪽에 붙으면 규칙이 아니다.
     */
    const ends = [
      { x: frame.cx + frame.ux * (frame.halfU + TAG_OUT), y: frame.cy + frame.uy * (frame.halfU + TAG_OUT) },
      { x: frame.cx - frame.ux * (frame.halfU + TAG_OUT), y: frame.cy - frame.uy * (frame.halfU + TAG_OUT) },
    ]
    /* 두 끝 중 **왼쪽 위**에 가까운 쪽 — 가로 칸이면 왼쪽, 세로 칸이면 위가 뽑힌다.
       칸이 비스듬해도 규칙이 흔들리지 않도록 한 잣대(x+y)로 고른다 */
    const near = ends[0].x + ends[0].y <= ends[1].x + ends[1].y ? ends[0] : ends[1]
    const half = (bay.label.length * 7 + 13) / 2
    return [
      {
        id: bay.id,
        label: bay.label,
        isActive,
        /* 가장자리 칸의 패가 그림 밖으로 나가지 않게 — 안 보이는 이름은 없는 이름이다 */
        x: Math.min(Math.max(near.x, half + 2), view.width - half - 2),
        y: Math.min(Math.max(near.y, 10), view.height - 10),
      },
    ]
  })
  const active = selectedId ?? hoveredId
  /* 태그는 **고른 것**을 따라간다 — 알람 딥링크(?equip=)로 들어와도 카드가 서 있다 */
  const tagged = points.find((point) => point.id === active) ?? null
  const tagAt = tagged ? (placed.get(tagged.id) ?? projection.project(tagged.position)) : null
  const card = tagged && cardOf ? cardOf(tagged.id) : null

  /** 설비 한 점 — 정상 층과 이상 층이 같은 그림을 쓴다(층만 다르다) */
  const renderPoint = (point: BirdviewPoint) => {
            const { x, y } = placed.get(point.id) ?? projection.project(point.position)
            const isActivePoint = point.id === active
            const issue = isIssue(point.severity)
            const size = issue ? SYMBOL_ISSUE : SYMBOL_NORMAL
            const dimmedByType = isolatedType !== null && point.typeId !== isolatedType
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
                  /*
                   * 하나를 가리키면 나머지는 물러난다 — 다만 **읽을 수는 있게**.
                   * 30% 까지 죽였더니 고른 순간 도면이 꺼진 것처럼 보여, 선택이 도움이
                   * 아니라 갇힘으로 느껴졌다. 물러나되 배치는 계속 읽혀야 한다.
                   */
                  active && !isActivePoint && 'opacity-50',
                  /*
                   * 범례로 종류를 고르면 나머지는 더 깊이 물러난다. 지우지는 않는다 —
                   * 사라지면 "그 자리에 아무것도 없다"로 읽히고, 도면에서 그것은 거짓말이다.
                   */
                  dimmedByType && 'opacity-[0.12]'
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
                <BirdviewSymbol
                  typeId={point.typeId}
                  x={x}
                  y={y}
                  size={size}
                  colored={colorByType}
                />
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
  }

  return (
    <div ref={rootRef} className={cn('flex flex-col', className)}>
      <div ref={frameRef} className="relative min-h-0 flex-1">
      <svg
        viewBox={`0 0 ${view.width} ${view.height}`}
        preserveAspectRatio="xMidYMid meet"
        className={cn('h-full w-full', chrome)}
        role="img"
        aria-label={emptyLabel}
      >
        {/*
          설비는 바닥 **위에 놓인다.**
          평평하게 그리면 판이 바닥 무늬처럼 읽혀 "칸 위에 장비가 서 있다"는 관계가
          사라진다 — 그림이 배치도가 아니라 색 격자가 되는 지점이다. 아주 얕은 그림자
          하나면 층이 갈리고, 그 순간 베이는 바닥이고 심볼은 물건이 된다. 장식이 아니라
          **층을 말하는 최소한**이라 흐림도 치우침도 1px 대다.
        */}
        <defs>
          <filter id={shadowId} x="-30%" y="-30%" width="160%" height="170%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.1" floodColor="#000" floodOpacity="0.5" />
          </filter>
        </defs>

        {/*
          빈 바닥 — **놓는 자리**.
          고른 설비는 태그를 세우고 나머지를 물러나게 하는데, 놓는 길이 "그 심볼을 다시
          정확히 누르기" 하나뿐이면 화면이 붙잡힌 것처럼 느껴진다(15px 짜리 판을 다시
          겨눠야 한다). 지도에서 빈 곳을 누르는 것은 어디서나 '선택 해제'의 뜻이므로
          그 관례를 그대로 둔다. 맨 밑에 깔아 두어 베이·심볼의 클릭을 가로채지 않는다.
        */}
        <rect
          x={0}
          y={0}
          width={view.width}
          height={view.height}
          fill="transparent"
          onClick={() => {
            onSelectPoint(null)
            setIsolatedType(null)
          }}
        />
        {/*
          ① 베이 — 이 그림의 주인공이자 유일한 뼈대다 (R41).

          바닥을 **번갈아** 깐다. 베이는 벽을 맞대고 붙어 있어서 같은 농도로 칠하면 여러
          칸이 한 덩어리로 보이고, 실제로 그렇게 읽혔다 — 선 하나로 갈린 큰 방 하나.
          도면이 인접한 실을 다른 해치로 구분하는 것과 같은 이유이고, 여기서는 해치 대신
          농도를 쓴다(선을 더 그으면 설비 줄과 뒤엉킨다). 차이는 3% 남짓이라 눈에 띄는
          것은 '경계'뿐이고 칸 자체는 여전히 조용하다.
        */}
        {bays.map((bay, index) => {
          const isActive = activeGroupKey === bay.groupKey
          return (
            <path
              key={bay.id}
              data-bay={bay.groupKey}
              /* 고른 칸을 화면이 스스로 말한다 — 강조는 굵기·농도로만 나타나 눈 밖에서는
                 확인할 길이 없고, 밖에서 실어 온 초점(베이 → 현황 승계)도 이 값으로 본다 */
              data-active={isActive ? 'true' : undefined}
              data-band={index % 2 === 0 ? 'even' : 'odd'}
              d={pathOf(bay.hull, projection)}
              className="cursor-pointer transition-[fill-opacity,stroke-opacity] duration-200"
              fill="currentColor"
              fillOpacity={isActive ? 0.11 : index % 2 === 0 ? 0.07 : 0.014}
              stroke="currentColor"
              strokeWidth={isActive ? 1.8 : 1}
              strokeOpacity={isActive ? 0.6 : 0.34}
              strokeLinejoin="miter"
              onClick={() => onSelectBay?.(bay.groupKey)}
            />
          )
        })}

        {/*
          ② 설비 — **그리는 순서가 곧 의미 순서다**(R25-1).
          정상 → 베이 이름 → 이상. 이름을 정상 판 밑에 깔면 설비가 많은 칸에서는 아예
          보이지 않는데("지금 몇 번 베이인가"는 이 그림의 첫 질문이다), 그렇다고 맨 위로
          올리면 이상 배지를 덮는다. 그래서 그 사이에 세운다.
        */}
        <g filter={`url(#${shadowId})`}>
          {points.filter((point) => !isIssue(point.severity)).map(renderPoint)}
        </g>

        {/*
          ③ 베이 번호패 — 정상 설비 위, 이상 설비 아래.

          맨 글자로 띄워 두었을 때는 설비 판과 섞여 "저 숫자가 베이 번호인지 어느 설비의
          값인지" 가 갈리지 않았다. 도면이 실(室) 번호를 다는 방식대로 **패에 얹는다** —
          바탕색 판 위의 숫자는 어디에 놓여도 번호로 읽히고, 판이 벽에 붙어 서면 그 자체가
          "이 칸의 이름" 이라는 뜻이 된다. 고른 칸은 강조색 테두리를 얻어 지금 보는 구획이
          목록과 같은 낱말로 말해진다.
        */}
        {bayLabels.map((label) => {
          const width = label.label.length * 7 + 13
          return (
            <g
              key={label.id}
              data-bay-tag={label.label}
              className={cn(
                'pointer-events-none select-none transition-opacity duration-200',
                label.isActive ? 'opacity-100' : 'opacity-80'
              )}
            >
              <rect
                x={label.x - width / 2}
                y={label.y - 8}
                width={width}
                height={16}
                rx={3}
                fill="var(--color-surface)"
                stroke={label.isActive ? 'var(--color-accent)' : 'currentColor'}
                strokeOpacity={label.isActive ? 0.9 : 0.34}
                strokeWidth={label.isActive ? 1.4 : 1}
              />
              <text
                x={label.x}
                y={label.y + 0.5}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="currentColor"
                fillOpacity={label.isActive ? 0.95 : 0.72}
                className="font-mono text-[11px] font-semibold tracking-[0.1em]"
              >
                {label.label}
              </text>
            </g>
          )
        })}

        {/* ④ 이상 설비 — 무엇보다 위에 남는다 */}
        <g filter={`url(#${shadowId})`}>
          {points.filter((point) => isIssue(point.severity)).map(renderPoint)}
        </g>
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

      {/* 색을 넣었으면 읽는 법을 함께 낸다 — 범례 없는 색은 장식이다 */}
      {colorByType && (
        <BirdviewLegend
          points={points}
          isolated={isolatedType}
          onIsolate={setIsolatedType}
          glass={glass}
        />
      )}
    </div>
  )
}

function isIssue(meaning: StatusMeaning): boolean {
  return meaning === 'error' || meaning === 'warning'
}
