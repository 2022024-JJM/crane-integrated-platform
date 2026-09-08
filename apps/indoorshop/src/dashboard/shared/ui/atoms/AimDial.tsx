import { cn } from '../../lib/utils'
import { lampStyle, type StatusMeaning } from '../statusPalette'

/*
 * 조준 다이얼 — **방향은 숫자가 아니라 방향으로** 그린다.
 *
 * 팬틸트가 달린 관측 장비(조립·의장 라이다)의 자세는 `pan -80° / tilt -9°` 같은 부호
 * 붙은 숫자 두 개로 적혀 왔다. 그 표기는 정확하지만 읽히지 않는다 — 337칸을 훑는 눈이
 * 칸마다 두 숫자를 좌표로 되옮기지는 않는다. 방위는 본래 그림으로 아는 값이다.
 *
 * 그래서 이 다이얼은 **평면 투영**이다: 위에서 내려다본 조준 벡터를 그대로 그린다.
 *  · 바늘의 **방향** = pan (0° 가 위, 시계 방향)
 *  · 바늘의 **길이** = cos(tilt) — 아래를 깊게 볼수록 위에서 본 그림자가 짧아진다.
 *    꾸민 비유가 아니라 실제 투영이라, 두 대의 바늘을 견주면 자세가 견줘진다.
 *  · 오른쪽 **고도 눈금** = tilt 부호와 크기. 길이만으로는 위를 보는지 아래를 보는지
 *    갈리지 않아(cos 는 짝함수) 한 채널을 더 둔다.
 *  · **유령 바늘** = 목표 자세. 도달했으면 그리지 않는다 — 늘 서 있으면 소음이 된다.
 *
 * 색은 뜻만 고른다(`statusPalette`) — 여기서 색을 새로 정하지 않는다. 통신 상태는
 * 이 그림이 말하지 않는다: 그 자리는 옆에 서는 `StatusDot`(모양 부호가 붙는 램프)의
 * 몫이고, 다이얼은 **구동**만 말한다. 한 그림이 두 가지를 말하면 어느 쪽이 나쁜지가
 * 흐려진다.
 *
 * 색 단독 금지: 이 그림은 색이 없어도 방위·고도를 다 말하고(형상), 상태 이름은
 * `label` 로 툴팁·보조기술 양쪽에 나간다.
 */

export interface AimDialProps {
  /** 현재 방위 (deg) — 0 이 위, 시계 방향. -180~180 */
  panDeg: number
  /** 현재 고도 (deg) — 아래를 보면 음수. -90~90 */
  tiltDeg: number
  /** 목표 자세 — 도달하지 않았을 때만 유령 바늘로 함께 선다. 없으면 생략 */
  target?: { panDeg: number; tiltDeg: number } | null
  /** 바늘이 말하는 뜻 — 구동 상태(대기·틸팅중·에러) */
  meaning: StatusMeaning
  /** 툴팁·보조기술에 낼 한 마디 — 없으면 장식으로 본다 */
  label?: string
  /** 어두운 유리(지도 오버레이) 위에 설 때 */
  glass?: boolean
  /** 칸이 많은 화면인가 — 정상·대기의 소리를 낮춘다 */
  dense?: boolean
  /** 그려지는 높이(px). 폭은 7:5 비율로 따라온다 */
  size?: number
  className?: string
}

/* 28×20 좌표계 — 다이얼(중심 10,10 · 반지름 7.4)과 오른쪽 고도 눈금(x=23.4) */
const CENTER = 10
const RADIUS = 7.4
const NEEDLE_MAX = 6.5
const NEEDLE_MIN = 2.3
const GAUGE_X = 23.4
const GAUGE_TOP = 3.4
const GAUGE_BOTTOM = 16.6

/** 조준 벡터의 평면 투영 끝점 — pan 은 방위(위가 0), tilt 는 길이를 줄인다 */
export function needleEnd(panDeg: number, tiltDeg: number): { x: number; y: number } {
  const length = Math.max(
    NEEDLE_MIN,
    NEEDLE_MAX * Math.cos((clampTilt(tiltDeg) * Math.PI) / 180)
  )
  const bearing = (panDeg * Math.PI) / 180
  return {
    x: CENTER + length * Math.sin(bearing),
    y: CENTER - length * Math.cos(bearing),
  }
}

/** 고도 눈금의 y — 위(+90)가 위쪽, 아래(-90)가 아래쪽 */
export function gaugeY(tiltDeg: number): number {
  const mid = (GAUGE_TOP + GAUGE_BOTTOM) / 2
  const half = (GAUGE_BOTTOM - GAUGE_TOP) / 2
  return mid - (clampTilt(tiltDeg) / 90) * half
}

function clampTilt(deg: number): number {
  return Math.min(90, Math.max(-90, deg))
}

export function AimDial({
  panDeg,
  tiltDeg,
  target,
  meaning,
  label,
  glass = false,
  dense = true,
  size = 16,
  className,
}: AimDialProps) {
  const { ink } = lampStyle(meaning, { dense, glass })
  const now = needleEnd(panDeg, tiltDeg)
  const goal = target ? needleEnd(target.panDeg, target.tiltDeg) : null

  return (
    <span
      title={label}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn('inline-flex shrink-0 items-center', ink, className)}
      style={{ width: (size * 7) / 5, height: size }}
    >
      <svg
        viewBox="0 0 28 20"
        width={(size * 7) / 5}
        height={size}
        fill="none"
        stroke="currentColor"
        aria-hidden="true"
      >
        {/* 눈금테 — 뜻이 없는 바탕이라 소리를 낮춘다. 정북(위)에만 짧은 기점 */}
        <circle cx={CENTER} cy={CENTER} r={RADIUS} strokeWidth="1" opacity="0.22" />
        <path
          d={`M${CENTER} ${CENTER - RADIUS - 1.4}v1.5`}
          strokeWidth="1"
          strokeLinecap="round"
          opacity="0.4"
        />

        {/* 목표 자세 — 도달했으면 그리지 않는다 */}
        {goal && (
          <path
            d={`M${CENTER} ${CENTER}L${goal.x.toFixed(2)} ${goal.y.toFixed(2)}`}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray="1.6 1.6"
            opacity="0.42"
          />
        )}

        {/* 지금 자세 */}
        <path
          d={`M${CENTER} ${CENTER}L${now.x.toFixed(2)} ${now.y.toFixed(2)}`}
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <circle cx={CENTER} cy={CENTER} r="1.5" fill="currentColor" stroke="none" />

        {/*
          고도 눈금 — 위를 보는지 아래를 보는지는 바늘 길이로 갈리지 않는다(cos 은 짝함수).
          자(尺)로 읽히도록 위·아래 끝과 수평(0°) 자리에 걸음쇠를 둔다: 눈금 없는 막대에
          찍힌 표시는 값이 아니라 얼룩으로 보인다.
        */}
        <path
          d={`M${GAUGE_X} ${GAUGE_TOP}v${GAUGE_BOTTOM - GAUGE_TOP}`}
          strokeWidth="1.1"
          strokeLinecap="round"
          opacity="0.3"
        />
        <path
          d={
            `M${GAUGE_X - 1} ${GAUGE_TOP}h2` +
            `M${GAUGE_X - 1.4} ${CENTER}h2.8` +
            `M${GAUGE_X - 1} ${GAUGE_BOTTOM}h2`
          }
          strokeWidth="1"
          strokeLinecap="round"
          opacity="0.3"
        />
        <path
          d={`M${GAUGE_X - 2.1} ${gaugeY(tiltDeg).toFixed(2)}h4.2`}
          strokeWidth="1.9"
          strokeLinecap="round"
        />
      </svg>
    </span>
  )
}
