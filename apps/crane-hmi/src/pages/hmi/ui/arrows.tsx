import type { ArrowDir } from '../model/types';
import { useHmiTheme } from './theme';

const ROT: Record<ArrowDir, number> = {
  up: 0,
  right: 90,
  down: 180,
  left: 270,
};

interface MotionArrowProps {
  dir: ArrowDir;
  active?: boolean;
  size?: number;
  activeColor?: string;
}

/** 매뉴얼 동작상태 화살표 — 정지 시 어두운 회색, 동작 시 밝은 녹색 */
export function MotionArrow({
  dir,
  active = false,
  size = 26,
  activeColor,
}: MotionArrowProps) {
  const theme = useHmiTheme();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ transform: `rotate(${ROT[dir]}deg)`, flexShrink: 0 }}
    >
      <polygon
        points="12,2 22,12 16.5,12 16.5,22 7.5,22 7.5,12 2,12"
        fill={
          active
            ? (activeColor ?? theme.text.valueMoving)
            : theme.arrow.idleFill
        }
        stroke={active ? '#ffffff66' : theme.arrow.idleStroke}
        strokeWidth="1"
      />
    </svg>
  );
}

/** 충돌 정보 행의 무알람 상태 — 작은 양방향 회색 화살표 */
export function IdleAxisArrows({
  horizontal = false,
}: {
  horizontal?: boolean;
}) {
  return horizontal ? (
    <span
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
    >
      <MotionArrow dir="left" size={15} />
      <MotionArrow dir="right" size={15} />
    </span>
  ) : (
    <span
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
    >
      <MotionArrow dir="up" size={15} />
      <MotionArrow dir="down" size={15} />
    </span>
  );
}
