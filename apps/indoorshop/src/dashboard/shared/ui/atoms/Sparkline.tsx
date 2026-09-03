import { cn } from '../../lib/utils'

/*
 * 미니 추이 그림 — 선(line)과 막대(bars) 두 가지.
 *
 * 축도 눈금도 범례도 없다. 그런 것이 필요한 그림은 차트지 스파크라인이 아니고, 이
 * 컴포넌트가 서는 자리(카드 한 줄 옆, 섹션 머리 타일)에는 그만한 공간이 없다. 여기서
 * 말하는 것은 하나다 — **모양**. 오르고 있는가, 멈췄는가, 어느 날이 비었는가.
 *
 * 두 가지 판단:
 *  · 색을 정하지 않는다. 획·채움이 전부 `currentColor` 라 호출부의 글자색을 따라간다 —
 *    라이트/다크 토큰을 이 파일이 다시 알 필요가 없다.
 *  · **그림 옆에 글자를 함께 낸다.** SVG 는 스크린리더에게 아무 말도 하지 않고, 색만으로
 *    말하는 그림은 색각 이상에서 사라진다. 그래서 각 점의 값을 sr-only 목록으로 낸다 —
 *    보조기술이 읽을 수 있고, 화면 테스트도 그 목록으로 값을 확인한다(픽셀을 세지 않는다).
 *
 * 점이 **둘 미만이면 아무것도 그리지 않는다**(null 을 낸다). 한 점짜리 추이는 추이가
 * 아니라서, 선을 그으면 없는 경향을 있는 것처럼 보이게 한다.
 */

export interface SparklinePoint {
  /** x축 이름 — 보통 날짜. sr-only 목록과 툴팁에 그대로 쓴다 */
  label: string
  value: number
}

export interface SparklineProps {
  points: readonly SparklinePoint[]
  /** 선: 값의 흐름 · 막대: 날짜별 개수 (0인 날이 보여야 하는 그림) */
  variant?: 'line' | 'bars'
  width?: number
  height?: number
  /**
   * y축 위끝. 없으면 점의 최대값을 쓴다. 공정률(0~100)처럼 척도가 정해진 그림은
   * 100 을 넘겨야 한다 — 최대값에 맞춰 늘이면 40%→45% 가 바닥에서 천장까지로 보인다.
   */
  max?: number
  /** 그림 전체의 접근성 이름 — 무엇의 추이인지 */
  ariaLabel: string
  /** sr-only 줄의 단위 접미사 (`%`·`건` 등) */
  unit?: string
  className?: string
}

/** 최소 점 수 — 이보다 적으면 그리지 않는다 */
export const SPARKLINE_MIN_POINTS = 2

export function Sparkline({
  points,
  variant = 'line',
  width = 64,
  height = 18,
  max,
  ariaLabel,
  unit = '',
  className,
}: SparklineProps) {
  if (points.length < SPARKLINE_MIN_POINTS) return null

  const top = Math.max(max ?? 0, ...points.map((p) => p.value), 1)
  /* 위아래로 1px 씩 남긴다 — 천장에 닿은 값의 획이 잘려 보이지 않게 */
  const pad = 1
  const usable = height - pad * 2
  const yOf = (value: number) => pad + usable * (1 - Math.max(0, Math.min(top, value)) / top)

  const srList = (
    <ul className="sr-only">
      {points.map((point) => (
        <li key={point.label}>
          {point.label} {point.value}
          {unit}
        </li>
      ))}
    </ul>
  )

  if (variant === 'bars') {
    /* 막대 폭은 칸을 고르게 나눈 뒤 사이를 1px 띄운다 — 붙여 두면 0 인 날이 안 보인다 */
    const slot = width / points.length
    const barWidth = Math.max(1, slot - 1)
    return (
      <span className={cn('inline-flex items-center', className)}>
        <svg
          role="img"
          aria-label={ariaLabel}
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="overflow-visible"
        >
          {points.map((point, i) => {
            const y = yOf(point.value)
            return (
              <rect
                key={point.label}
                x={i * slot}
                /* 값이 0 인 날도 바닥에 1px 흔적을 남긴다 — 빈 날과 데이터 없음은 다르다 */
                y={point.value > 0 ? y : height - pad - 1}
                width={barWidth}
                height={point.value > 0 ? Math.max(1, height - pad - y) : 1}
                fill="currentColor"
                opacity={point.value > 0 ? 1 : 0.28}
              />
            )
          })}
        </svg>
        {srList}
      </span>
    )
  }

  const step = points.length > 1 ? width / (points.length - 1) : width
  const path = points
    .map((point, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(2)},${yOf(point.value).toFixed(2)}`)
    .join(' ')
  const last = points[points.length - 1]

  return (
    <span className={cn('inline-flex items-center', className)}>
      <svg
        role="img"
        aria-label={ariaLabel}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
      >
        <path
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.25}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* 마지막 점만 찍는다 — '지금 여기까지'가 이 그림의 결론이다 */}
        <circle cx={(points.length - 1) * step} cy={yOf(last.value)} r={1.6} fill="currentColor" />
      </svg>
      {srList}
    </span>
  )
}
