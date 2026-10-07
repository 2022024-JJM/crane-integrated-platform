import { useMemo } from 'react'
import { prefersReducedMotion } from '../../../shared/lib/cameraMotion'
import type { BirdviewOverlayContext } from '../../../shared/features/equipment-birdview'
import type { BayAirMode } from '../lib/airEffect'
import { DEHUMIDIFIER, GAS_HEATER } from './equipmentIcon'

/*
 * ── 배치도 위의 **기류** — 2D 도면이 움직인다 (R45) ──
 *
 * 현황 탭의 설비 배치는 지금까지 **정지 화면**이었다. 심볼과 이상 배지는 "무엇이 어디에
 * 있고 어느 것이 고장인가"에 답하지만, 도장 공장에서 종일 일어나는 일 — 히터가 데우고
 * 제습기가 말린다 — 은 어디에도 없었다. 그 답은 가동 뷰(3D)에만 있었고, 그래서 도면을
 * 보던 사람은 "지금 저 칸이 돌고 있나"를 알려면 화면을 갈아타야 했다.
 *
 * 여기서 그 한 겹을 도면 위에 올린다. **3D 와 같은 낱말**을 쓴다 — 두 화면이 다른 그림을
 * 그리면 탭을 옮길 때마다 새로 배워야 한다:
 *
 *   가스히터 가동  →  붉은 기류가 **피어오른다**(위로 흐르는 파선)
 *   제습기 가동    →  푸른 기류가 **빨려든다**(설비 쪽으로 흐르는 파선)
 *   정지           →  아무것도 그리지 않는다 (심볼만 남는다)
 *
 * 세기는 3D 와 같은 규칙(`lib/airEffect`)에서 온다 — 목표에 못 미칠수록 빠르고 진하다.
 * 값이 같은 두 화면이 다른 속도로 흐르면, 둘 중 하나는 거짓말이다.
 *
 * ── 판단 셋 ──
 *  · **SMIL(`<animate>`)로 움직인다.** CSS 키프레임은 설비마다 다른 속도를 주려면 인라인
 *    스타일로 `animation-duration` 을 따로 박아야 하는데, SMIL 은 `dur` 이 속성이라 그
 *    값이 곧 세기가 된다. 이 그림에는 이미 SVG 가 있으므로 새 기술을 들이는 것도 아니다.
 *  · **배율을 되돌린다.** 확대 변환 안쪽에 그려지므로, 선 굵기와 기류 길이를 그대로 두면
 *    3배로 키운 도면에서 3배 굵은 기류가 심볼을 덮는다. 굵기만 `scale` 로 나눈다 —
 *    자리와 길이는 도면과 함께 커져야 "저 칸의 기류"로 읽힌다.
 *  · **움직임을 끈 사람에게는 그리되 흐르지 않는다.** `prefers-reduced-motion` 이면 같은
 *    그림을 정지로 세운다 — 지우면 그 사람만 '가동 중'을 못 읽는다.
 */

/** 기류를 뿜는 설비 한 대 — 자리는 도면(`placed`)이 알고, 여기서는 무엇을·얼마나만 */
export interface PlanFlowUnit {
  id: string
  kind: '가스히터' | '제습기'
  /** 0~1 — `hazeIntensityOf`/`streakIntensityOf` 가 낸 값 그대로 */
  intensity: number
}

/** 칸 하나가 지금 하는 일 — 바닥 물빛의 근거 */
export interface PlanFlowBay {
  groupKey: string
  mode: BayAirMode
  /** 그 칸에서 가장 센 기류(0~1) */
  intensity: number
}

/** 기류 한 줄기의 길이(도면 px) — 베이 한 칸이 40~120px 인 그림에서 읽히는 치수 */
const STREAK_LEN = 17
/** 설비 심볼 반지름 — 기류가 심볼을 덮지 않게 이만큼 띄운다 */
const SYMBOL_R = 9

/** 세기 → 한 바퀴 도는 시간(초). 셀수록 빠르다 */
function durationOf(intensity: number): number {
  return 2.4 - 1.5 * Math.min(1, Math.max(0, intensity))
}

/** 모드 → 바닥 물빛 */
function washOf(mode: BayAirMode): string | null {
  if (mode === 'heating') return GAS_HEATER
  if (mode === 'drying') return DEHUMIDIFIER
  /* 섞인 칸은 데우는 쪽을 세운다 — 두 색을 겹치면 탁한 보라가 되어 어느 쪽도 아니게 된다 */
  if (mode === 'mixed') return GAS_HEATER
  return null
}

/**
 * 기류 한 줄기.
 *
 * 파선의 `stroke-dashoffset` 을 한 주기만큼 움직이면 선이 흐르는 것처럼 보인다 —
 * 점을 여럿 그려 각각 옮기는 것보다 훨씬 싸고(요소 하나), 곡선을 따라 자연히 흐른다.
 * 히터는 **밖으로**(피어오름), 제습기는 **안으로**(빨려듦) — 부호 하나가 그 차이다.
 */
function Streak({
  x,
  y,
  angle,
  color,
  inward,
  duration,
  delay,
  opacity,
  width,
  animated,
}: {
  x: number
  y: number
  /** 기류가 뻗는 방향(도) — 0 = 위 */
  angle: number
  color: string
  inward: boolean
  duration: number
  delay: number
  opacity: number
  width: number
  animated: boolean
}) {
  const rad = (angle * Math.PI) / 180
  const dx = Math.sin(rad)
  const dy = -Math.cos(rad)
  /* 살짝 휘어야 '흐름'으로 읽힌다 — 곧은 선은 눈금으로 보인다 */
  const bend = 3.4
  const x1 = x + dx * SYMBOL_R
  const y1 = y + dy * SYMBOL_R
  const x2 = x + dx * (SYMBOL_R + STREAK_LEN)
  const y2 = y + dy * (SYMBOL_R + STREAK_LEN)
  const cx = (x1 + x2) / 2 - dy * bend
  const cy = (y1 + y2) / 2 + dx * bend
  const dash = 5
  const gap = 6
  const period = dash + gap
  return (
    <path
      d={`M${x1.toFixed(1)},${y1.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      strokeOpacity={opacity}
      strokeDasharray={`${dash} ${gap}`}
      strokeDashoffset={0}
    >
      {animated && (
        <animate
          attributeName="stroke-dashoffset"
          from={inward ? -period : period}
          to={0}
          dur={`${duration.toFixed(2)}s`}
          begin={`${delay.toFixed(2)}s`}
          repeatCount="indefinite"
        />
      )}
    </path>
  )
}

export interface PaintingPlanFlowProps {
  context: BirdviewOverlayContext
  units: readonly PlanFlowUnit[]
  bays: readonly PlanFlowBay[]
}

/**
 * 도면 위 기류 층 — 버드뷰의 `overlay` 슬롯이 부른다.
 *
 * 이 컴포넌트는 상태를 갖지 않는다. 무엇이 얼마나 도는지는 현황 탭이 이미 알고 있고
 * (같은 `mockEquipmentStatus` 를 그리드·심볼과 함께 읽는다), 여기서는 그 값을 그림으로
 * 옮길 뿐이다 — 세기를 여기서 다시 계산하면 같은 설비가 두 층에서 다른 말을 한다.
 */
export function PaintingPlanFlow({ context, units, bays }: PaintingPlanFlowProps) {
  const animated = !prefersReducedMotion()
  /* 확대해도 선은 굵어지지 않는다 — 자리만 커진다 */
  const stroke = 1.7 / Math.max(1, context.scale)

  const washes = useMemo(() => {
    const byKey = new Map(context.bays.map((bay) => [bay.groupKey, bay.points]))
    return bays.flatMap((bay) => {
      const color = washOf(bay.mode)
      const points = byKey.get(bay.groupKey)
      if (!color || !points || points.length < 3) return []
      return [{ key: bay.groupKey, color, intensity: bay.intensity, points }]
    })
  }, [bays, context.bays])

  return (
    <g aria-hidden="true" className="pointer-events-none">
      {/*
        ① 바닥 물빛 — **한 눈에 읽히는 층.**
        기류 줄기는 가까이 봐야 보인다. 도면 전체를 훑을 때 필요한 것은 "어느 칸이 지금
        돌고 있나" 한 줄이고, 그건 칸 바닥의 색이 답한다. 아주 옅게(4~9%) 깔아 베이 구획의
        번갈아 칠한 농도를 덮지 않는다 — 이 층이 진해지면 도면이 아니라 히트맵이 된다.
      */}
      {washes.map((wash) => {
        const base = 0.04 + 0.05 * wash.intensity
        return (
          <path
            key={wash.key}
            d={`${wash.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')} Z`}
            fill={wash.color}
            fillOpacity={base}
          >
            {animated && (
              <animate
                attributeName="fill-opacity"
                values={`${base.toFixed(3)};${(base * 1.75).toFixed(3)};${base.toFixed(3)}`}
                dur="3.4s"
                repeatCount="indefinite"
              />
            )}
          </path>
        )
      })}

      {/*
        ② 설비마다의 기류 — **어느 대가** 일하고 있는가.
        히터는 위로 세 줄기, 제습기는 세 방향에서 안으로. 방향이 곧 뜻이라 색을 못 보는
        눈에도 둘이 갈린다(내뿜음 ↔ 빨아들임).
      */}
      {units.map((unit) => {
        const at = context.placed.get(unit.id)
        if (!at || unit.intensity <= 0) return null
        const heater = unit.kind === '가스히터'
        const color = heater ? GAS_HEATER : DEHUMIDIFIER
        const duration = durationOf(unit.intensity)
        const opacity = 0.4 + 0.45 * unit.intensity
        /* 히터는 위로 부채꼴, 제습기는 사방에서 — 같은 부품, 각도만 다르다 */
        const angles = heater ? [-26, 0, 26] : [-120, 0, 120]
        return (
          <g key={unit.id}>
            {angles.map((angle, index) => (
              <Streak
                key={angle}
                x={at.x}
                y={at.y}
                angle={angle}
                color={color}
                inward={!heater}
                duration={duration}
                delay={-index * (duration / 3)}
                opacity={opacity}
                width={stroke}
                animated={animated}
              />
            ))}
          </g>
        )
      })}
    </g>
  )
}
