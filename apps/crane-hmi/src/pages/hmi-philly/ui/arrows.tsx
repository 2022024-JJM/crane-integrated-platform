type ArrowDirection = 'up' | 'down' | 'left' | 'right';

const ROTATION: Record<ArrowDirection, number> = {
  up: 0,
  right: 90,
  down: 180,
  left: 270,
};

/** 원본 HMI의 굵은 화살표 아이콘 (활성 방향은 파란색) */
export function ArrowIcon({
  direction,
  color,
  size = 24,
}: {
  direction: ArrowDirection;
  color: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <path
        d="M12 2.6 L20.6 11.8 H15.7 V21.4 H8.3 V11.8 H3.4 Z"
        fill={color}
        transform={`rotate(${ROTATION[direction]} 12 12)`}
      />
    </svg>
  );
}
