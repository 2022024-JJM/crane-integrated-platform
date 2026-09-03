import { cn } from '../../lib/utils'
import { STATUS_SHAPE, STATUS_STYLE, type StatusMeaning, type StatusShape } from '../statusPalette'

/*
 * 상태 점 — **모양이 색을 거든다**.
 *
 * 점 하나로 상태를 말하는 자리(SCADA 램프·정반 칩·점검 불릿)는 라벨을 붙일 자리가
 * 없어서 색만 남는다. 그런데 적록색각에서 초록·빨강 점은 같은 회색 덩어리이고,
 * 흑백 출력에서도 마찬가지다 — 그래서 의미마다 **다른 모양**을 준다(감사 P2·A8).
 *
 *   완료·정상 ● 원 · 진행중 ◆ 마름모 · 주의 ▲ 삼각 · 이상 ■ 사각 · 대기 ─ 막대
 *
 * 크기는 8px 안팎이라 모양이 뭉개지기 쉬워서, 획이 아니라 **면**으로 그린다.
 * 상태 이름(`label`)은 툴팁과 스크린리더 양쪽에 낸다 — 모양을 못 읽는 사람에게는
 * 그 말이 유일한 경로다.
 */

interface StatusDotProps {
  meaning: StatusMeaning
  /** 사람이 읽는 상태 이름 — 툴팁·스크린리더용 (없으면 장식으로 본다) */
  label?: string
  size?: number
  /** 지도 오버레이(어두운 유리) 위에 설 때 */
  glass?: boolean
  /** 채움색을 직접 준다 — 강제 다크 패널처럼 테마 토큰이 닿지 않는 자리 */
  color?: string
  className?: string
}

/** 모양별 path — 24×24 좌표계, 면으로 채운다 */
const SHAPE_PATH: Record<StatusShape, string> = {
  circle: 'M12 2.5a9.5 9.5 0 1 0 0 19 9.5 9.5 0 0 0 0-19z',
  diamond: 'M12 1.5 22.5 12 12 22.5 1.5 12z',
  triangle: 'M12 2 23 21H1z',
  square: 'M2.5 2.5h19v19h-19z',
  dash: 'M1.5 9h21v6h-21z',
}

export function StatusDot({
  meaning,
  label,
  size = 8,
  glass = false,
  color,
  className,
}: StatusDotProps) {
  const shape = STATUS_SHAPE[meaning]
  const tint = glass ? STATUS_STYLE[meaning].glassInk : STATUS_STYLE[meaning].ink

  return (
    <span
      title={label}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn('inline-flex shrink-0 items-center justify-center', !color && tint, className)}
      style={{ width: size, height: size, color }}
    >
      <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
        <path d={SHAPE_PATH[shape]} />
      </svg>
    </span>
  )
}
