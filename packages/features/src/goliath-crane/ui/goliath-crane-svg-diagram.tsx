import { useEffect, useRef, useState } from 'react';
import type { GoliathCraneDetail } from '@crane/domain/goliath-crane';
import { cn } from '@crane/core/lib/utils';

function getValueColor(current: number, max: number): string {
  const percent = (current / max) * 100;
  if (percent >= 90) return 'fill-red-500';
  if (percent >= 70) return 'fill-amber-500';
  return 'fill-emerald-500';
}

function ValueLabel({
  x,
  y,
  label,
  value,
  unit,
  colorClass,
  anchor = 'start',
}: {
  x: number;
  y: number;
  label: string;
  value: string;
  unit: string;
  colorClass?: string;
  anchor?: 'start' | 'middle' | 'end';
}) {
  return (
    <g>
      <text
        x={x}
        y={y - 12}
        textAnchor={anchor}
        className="fill-muted-foreground text-[9px] font-medium tracking-wider uppercase"
      >
        {label}
      </text>
      <text
        x={x}
        y={y + 2}
        textAnchor={anchor}
        className={cn(
          'text-[13px] font-bold tabular-nums',
          colorClass ?? 'fill-foreground',
        )}
      >
        {value}
        <tspan className="fill-muted-foreground text-[10px] font-normal">
          {' '}
          {unit}
        </tspan>
      </text>
    </g>
  );
}

// ── 위협 물체 타입 ────────────────────────────────────────────────────────────
type ThreatType = 'person' | 'vehicle';

interface ThreatObject {
  id: string;
  type: ThreatType;
  /** SVG x 좌표 (현재 위치) */
  x: number;
  /** SVG y 좌표 (현재 위치) */
  y: number;
  /** 이동 방향 (1 = 오른쪽→왼쪽, -1 = 반대) */
  dx: number;
  /** 속도 (px/tick) */
  speed: number;
  /** 접근 y 타겟 (훅 아래 방향) */
  dy: number;
}

// ── 충돌 위협 레벨 ─────────────────────────────────────────────────────────────
type ThreatLevel = 'safe' | 'caution' | 'warning' | 'danger';

function getThreatLevel(dist: number): ThreatLevel {
  if (dist < 55) return 'danger';
  if (dist < 100) return 'warning';
  if (dist < 160) return 'caution';
  return 'safe';
}

const THREAT_ZONE_COLORS: Record<ThreatLevel, string> = {
  safe: 'stroke-emerald-500/20',
  caution: 'stroke-amber-400/40',
  warning: 'stroke-orange-500/60',
  danger: 'stroke-red-500',
};

const THREAT_FILL_COLORS: Record<ThreatLevel, string> = {
  safe: 'fill-emerald-500/5',
  caution: 'fill-amber-400/8',
  warning: 'fill-orange-500/12',
  danger: 'fill-red-500/20',
};

// ── 사람 아이콘 (SVG 경로) ────────────────────────────────────────────────────
function PersonIcon({
  x,
  y,
  level,
}: {
  x: number;
  y: number;
  level: ThreatLevel;
}) {
  const color =
    level === 'danger'
      ? '#ef4444'
      : level === 'warning'
        ? '#f97316'
        : level === 'caution'
          ? '#f59e0b'
          : '#10b981';
  const pulse = level === 'danger' || level === 'warning';

  return (
    <g transform={`translate(${x - 7}, ${y - 20})`}>
      {/* 펄스 링 */}
      {pulse && (
        <circle
          cx="7"
          cy="10"
          r="14"
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          opacity="0.4"
        >
          <animate
            attributeName="r"
            values="10;20;10"
            dur={level === 'danger' ? '0.8s' : '1.4s'}
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.6;0;0.6"
            dur={level === 'danger' ? '0.8s' : '1.4s'}
            repeatCount="indefinite"
          />
        </circle>
      )}
      {/* 몸통 */}
      <circle cx="7" cy="3" r="3" fill={color} opacity="0.9" />
      <line
        x1="7"
        y1="6"
        x2="7"
        y2="14"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="7"
        y1="9"
        x2="2"
        y2="12"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="7"
        y1="9"
        x2="12"
        y2="12"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="7"
        y1="14"
        x2="3"
        y2="20"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="7"
        y1="14"
        x2="11"
        y2="20"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </g>
  );
}

// ── 차량 아이콘 ────────────────────────────────────────────────────────────────
function VehicleIcon({
  x,
  y,
  level,
  flipX,
}: {
  x: number;
  y: number;
  level: ThreatLevel;
  flipX?: boolean;
}) {
  const color =
    level === 'danger'
      ? '#ef4444'
      : level === 'warning'
        ? '#f97316'
        : level === 'caution'
          ? '#f59e0b'
          : '#10b981';
  const pulse = level === 'danger' || level === 'warning';
  const flip = flipX ? `scale(-1,1) translate(-${x * 2}, 0)` : '';

  return (
    <g transform={`translate(${x - 14}, ${y - 12}) ${flip}`}>
      {pulse && (
        <circle
          cx="14"
          cy="6"
          r="18"
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          opacity="0.4"
        >
          <animate
            attributeName="r"
            values="14;26;14"
            dur={level === 'danger' ? '0.8s' : '1.4s'}
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.6;0;0.6"
            dur={level === 'danger' ? '0.8s' : '1.4s'}
            repeatCount="indefinite"
          />
        </circle>
      )}
      {/* 차체 */}
      <rect
        x="0"
        y="4"
        width="28"
        height="10"
        rx="2"
        fill={color}
        opacity="0.85"
      />
      <rect
        x="4"
        y="1"
        width="16"
        height="7"
        rx="2"
        fill={color}
        opacity="0.6"
      />
      {/* 바퀴 */}
      <circle cx="6" cy="14" r="3.5" fill={color} opacity="0.9" />
      <circle cx="22" cy="14" r="3.5" fill={color} opacity="0.9" />
      <circle cx="6" cy="14" r="1.5" fill="black" opacity="0.4" />
      <circle cx="22" cy="14" r="1.5" fill="black" opacity="0.4" />
    </g>
  );
}

// ── 충돌 경보 배너 ─────────────────────────────────────────────────────────────
function CollisionAlarmBanner({
  level,
  objectType,
}: {
  level: ThreatLevel;
  objectType: ThreatType;
}) {
  if (level === 'safe') return null;

  const configs = {
    caution: {
      bgFill: '#f59e0b22',
      borderStroke: '#f59e0b99',
      textFill: '#fbbf24',
      label: '⚠ 주의 구역 진입',
      blink: false,
    },
    warning: {
      bgFill: '#f9731622',
      borderStroke: '#f97316cc',
      textFill: '#fb923c',
      label: '⚠ 경고 — 접근 감지',
      blink: false,
    },
    danger: {
      bgFill: '#ef444433',
      borderStroke: '#ef4444',
      textFill: '#f87171',
      label: '🚨 위험 — 충돌 임박!',
      blink: true,
    },
    safe: {
      bgFill: '',
      borderStroke: '',
      textFill: '',
      label: '',
      blink: false,
    },
  };
  const cfg = configs[level];
  const label = `${cfg.label}  [${objectType === 'person' ? '작업자' : '차량'}]`;

  return (
    <g>
      <rect
        x="200"
        y="362"
        width="320"
        height="26"
        rx="5"
        fill={cfg.bgFill}
        stroke={cfg.borderStroke}
        strokeWidth="1.5"
      >
        {cfg.blink && (
          <animate
            attributeName="opacity"
            values="1;0.3;1"
            dur="0.6s"
            repeatCount="indefinite"
          />
        )}
      </rect>
      <text
        x="360"
        y="379"
        textAnchor="middle"
        fontSize="11"
        fontWeight="bold"
        letterSpacing="0.03em"
        fill={cfg.textFill}
      >
        {label}
        {cfg.blink && (
          <animate
            attributeName="opacity"
            values="1;0.2;1"
            dur="0.6s"
            repeatCount="indefinite"
          />
        )}
      </text>
    </g>
  );
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────────
export function GoliathCraneSvgDiagram({
  crane,
}: {
  crane: GoliathCraneDetail;
}) {
  const trolleyX = 160 + (crane.trolleyPosition / crane.girderLength) * 400;
  const auxTrolleyX = trolleyX + 50;
  const mainCableLength = 40 + (1 - crane.hoistHeight / 50) * 100;
  const auxCableLength = 40 + (1 - crane.auxHoistHeight / 50) * 80;
  const loadColor = getValueColor(crane.load, crane.maxLoad);
  const windColor =
    crane.windSpeed / crane.windSpeedThreshold >= 0.7
      ? crane.windSpeed / crane.windSpeedThreshold >= 0.9
        ? 'fill-red-500'
        : 'fill-amber-500'
      : 'fill-emerald-500';

  // 훅 위치 (SVG 좌표)
  const hookX = trolleyX + 4; // 약간 오프셋
  const hookY = 94 + mainCableLength + 14;

  // ── 위협 물체 시뮬레이션 state ───────────────────────────────────────────────
  const [threats, setThreats] = useState<ThreatObject[]>(() => [
    {
      id: 'person-1',
      type: 'person',
      x: 580, // 오른쪽에서 출발
      y: 335, // 지면
      dx: -1,
      speed: 0.55,
      dy: 0,
    },
    {
      id: 'vehicle-1',
      type: 'vehicle',
      x: 160, // 왼쪽에서 출발
      y: 330,
      dx: 1,
      speed: 0.9,
      dy: 0,
    },
  ]);

  const frameRef = useRef<number | null>(null);
  const tickRef = useRef(0);

  useEffect(() => {
    const step = () => {
      tickRef.current += 1;

      setThreats((prev) =>
        prev.map((obj) => {
          let nx = obj.x + obj.dx * obj.speed;
          let ndx = obj.dx;

          // 훅 X 근처에 충분히 접근하면 방향 반전 (충돌 시뮬 반복)
          const distToHook = Math.abs(nx - hookX);
          if (distToHook < 30) {
            // 되돌아가기
            ndx = obj.dx * -1;
          }

          // 화면 경계 반전
          if (nx < 120) ndx = 1;
          if (nx > 620) ndx = -1;

          return { ...obj, x: nx, dx: ndx };
        }),
      );

      frameRef.current = window.setTimeout(step, 30);
    };

    frameRef.current = window.setTimeout(step, 30);
    return () => {
      if (frameRef.current) clearTimeout(frameRef.current);
    };
  }, [hookX]);

  // 각 위협 물체와 훅 사이의 거리 계산
  const threatLevels = threats.map((obj) => {
    const dist = Math.sqrt(
      Math.pow(obj.x - hookX, 2) + Math.pow(obj.y - hookY, 2),
    );
    return { ...obj, dist, level: getThreatLevel(dist) };
  });

  // 최고 위협 레벨
  const maxLevel: ThreatLevel = threatLevels.reduce<ThreatLevel>((acc, t) => {
    const order: ThreatLevel[] = ['safe', 'caution', 'warning', 'danger'];
    return order.indexOf(t.level) > order.indexOf(acc) ? t.level : acc;
  }, 'safe');

  // 위험 존 반경 (훅 기준)
  const zoneRadii = [160, 100, 55] as const;
  const zoneLevels: ThreatLevel[] = ['caution', 'warning', 'danger'];

  return (
    <svg
      viewBox="0 0 720 400"
      className={cn(
        'h-full w-full transition-all duration-200',
        maxLevel === 'danger' && 'drop-shadow-[0_0_12px_rgba(239,68,68,0.6)]',
      )}
      role="img"
      aria-label="Goliath crane anti-collision diagram"
    >
      {/* ── 전체 테두리 플래시 (danger 시) ── */}
      {maxLevel === 'danger' && (
        <rect
          x="1"
          y="1"
          width="718"
          height="398"
          rx="6"
          fill="none"
          stroke="#ef4444"
          strokeWidth="2"
        >
          <animate
            attributeName="opacity"
            values="0.8;0;0.8"
            dur="0.6s"
            repeatCount="indefinite"
          />
        </rect>
      )}
      {maxLevel === 'warning' && (
        <rect
          x="1"
          y="1"
          width="718"
          height="398"
          rx="6"
          fill="none"
          stroke="#f97316"
          strokeWidth="1.5"
          opacity="0.5"
        />
      )}

      {/* Background grid */}
      <defs>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path
            d="M 20 0 L 0 0 0 20"
            fill="none"
            className="stroke-foreground/4"
            strokeWidth="0.5"
          />
        </pattern>
        <linearGradient id="cableGrad" x1="0" y1="0" x2="0" y2="1">
          <stop
            offset="0%"
            stopColor="var(--hanwha-orange-100)"
            stopOpacity="0.9"
          />
          <stop
            offset="100%"
            stopColor="var(--hanwha-orange-70)"
            stopOpacity="0.6"
          />
        </linearGradient>
        <linearGradient id="girderGrad" x1="0" y1="0" x2="1" y2="0">
          <stop
            offset="0%"
            stopColor="var(--hanwha-orange-50)"
            stopOpacity="0.3"
          />
          <stop
            offset="50%"
            stopColor="var(--hanwha-orange-100)"
            stopOpacity="0.15"
          />
          <stop
            offset="100%"
            stopColor="var(--hanwha-orange-50)"
            stopOpacity="0.3"
          />
        </linearGradient>
      </defs>
      <rect width="720" height="400" fill="url(#grid)" />

      {/* ── 충돌 방지 위험 존 (훅 중심) ── */}
      {zoneRadii.map((r, i) => {
        const lvl = zoneLevels[i];
        const isActive = threatLevels.some((t) => t.dist < r * 1.3);
        return (
          <g key={r}>
            <circle
              cx={hookX}
              cy={hookY}
              r={r}
              className={cn(
                'transition-all duration-500',
                THREAT_FILL_COLORS[isActive ? lvl : 'safe'],
                THREAT_ZONE_COLORS[isActive ? lvl : 'safe'],
              )}
              strokeWidth={isActive ? (lvl === 'danger' ? 1.5 : 1) : 0.5}
              strokeDasharray={lvl === 'caution' ? '4 4' : undefined}
              fill="inherit"
            >
              {lvl === 'danger' && isActive && (
                <animate
                  attributeName="r"
                  values={`${r};${r + 6};${r}`}
                  dur="1s"
                  repeatCount="indefinite"
                />
              )}
            </circle>
            {/* 존 라벨 */}
            {isActive && (
              <text
                x={hookX + r + 4}
                y={hookY}
                textAnchor="start"
                className={cn(
                  'text-[8px] font-bold',
                  lvl === 'danger'
                    ? 'fill-red-400'
                    : lvl === 'warning'
                      ? 'fill-orange-400'
                      : 'fill-amber-400',
                )}
              >
                {r}m
              </text>
            )}
          </g>
        );
      })}

      {/* Ground / Rail track */}
      <rect
        x="80"
        y="340"
        width="560"
        height="4"
        rx="2"
        className="fill-muted-foreground/30"
      />
      <rect
        x="80"
        y="348"
        width="560"
        height="8"
        rx="1"
        className="fill-muted-foreground/10"
      />
      {Array.from({ length: 20 }, (_, i) => (
        <rect
          key={i}
          x={100 + i * 28}
          y="344"
          width="8"
          height="6"
          rx="1"
          className="fill-muted-foreground/15"
        />
      ))}

      {/* Left Leg (A-frame) */}
      <g>
        <rect
          x="152"
          y="70"
          width="16"
          height="270"
          rx="3"
          className="fill-foreground/20 stroke-foreground/40"
          strokeWidth="1"
        />
        <rect
          x="140"
          y="70"
          width="12"
          height="270"
          rx="2"
          className="fill-foreground/10 stroke-foreground/30"
          strokeWidth="0.5"
        />
        <line
          x1="148"
          y1="120"
          x2="168"
          y2="160"
          className="stroke-foreground/15"
          strokeWidth="1.5"
        />
        <line
          x1="168"
          y1="120"
          x2="148"
          y2="160"
          className="stroke-foreground/15"
          strokeWidth="1.5"
        />
        <line
          x1="148"
          y1="200"
          x2="168"
          y2="240"
          className="stroke-foreground/15"
          strokeWidth="1.5"
        />
        <line
          x1="168"
          y1="200"
          x2="148"
          y2="240"
          className="stroke-foreground/15"
          strokeWidth="1.5"
        />
        <rect
          x="130"
          y="332"
          width="50"
          height="10"
          rx="3"
          className="fill-foreground/25 stroke-foreground/40"
          strokeWidth="1"
        />
      </g>

      {/* Right Leg (A-frame) */}
      <g>
        <rect
          x="552"
          y="70"
          width="16"
          height="270"
          rx="3"
          className="fill-foreground/20 stroke-foreground/40"
          strokeWidth="1"
        />
        <rect
          x="568"
          y="70"
          width="12"
          height="270"
          rx="2"
          className="fill-foreground/10 stroke-foreground/30"
          strokeWidth="0.5"
        />
        <line
          x1="552"
          y1="120"
          x2="572"
          y2="160"
          className="stroke-foreground/15"
          strokeWidth="1.5"
        />
        <line
          x1="572"
          y1="120"
          x2="552"
          y2="160"
          className="stroke-foreground/15"
          strokeWidth="1.5"
        />
        <line
          x1="552"
          y1="200"
          x2="572"
          y2="240"
          className="stroke-foreground/15"
          strokeWidth="1.5"
        />
        <line
          x1="572"
          y1="200"
          x2="552"
          y2="240"
          className="stroke-foreground/15"
          strokeWidth="1.5"
        />
        <rect
          x="540"
          y="332"
          width="50"
          height="10"
          rx="3"
          className="fill-foreground/25 stroke-foreground/40"
          strokeWidth="1"
        />
      </g>

      {/* Girder */}
      <rect
        x="130"
        y="60"
        width="460"
        height="18"
        rx="4"
        className="fill-foreground/15 stroke-foreground/40"
        strokeWidth="1.5"
      />
      <rect
        x="130"
        y="62"
        width="460"
        height="14"
        rx="3"
        fill="url(#girderGrad)"
      />
      <line
        x1="160"
        y1="69"
        x2="560"
        y2="69"
        className="stroke-foreground/8"
        strokeWidth="0.5"
        strokeDasharray="4 4"
      />

      {/* Top beam */}
      <rect
        x="160"
        y="48"
        width="60"
        height="14"
        rx="4"
        className="fill-foreground/20 stroke-foreground/30"
        strokeWidth="1"
      />
      <rect
        x="500"
        y="48"
        width="60"
        height="14"
        rx="4"
        className="fill-foreground/20 stroke-foreground/30"
        strokeWidth="1"
      />

      {/* Main Hoist Trolley */}
      <g
        style={{
          transform: `translateX(${trolleyX - 160}px)`,
          transition: 'transform 0.8s ease-out',
        }}
      >
        <rect
          x="145"
          y="78"
          width="38"
          height="16"
          rx="4"
          className="fill-(--hanwha-orange-100) stroke-(--hanwha-orange-100)/70"
          strokeWidth="1"
        />
        <circle cx="153" cy="78" r="3.5" className="fill-foreground/40" />
        <circle cx="175" cy="78" r="3.5" className="fill-foreground/40" />
        <line
          x1="159"
          y1="94"
          x2="159"
          y2={94 + mainCableLength}
          stroke="url(#cableGrad)"
          strokeWidth="2"
        />
        <line
          x1="169"
          y1="94"
          x2="169"
          y2={94 + mainCableLength}
          stroke="url(#cableGrad)"
          strokeWidth="2"
        />
        <g>
          <rect
            x="153"
            y={94 + mainCableLength}
            width="22"
            height="10"
            rx="3"
            className="fill-(--hanwha-orange-70) stroke-(--hanwha-orange-100)/50"
            strokeWidth="1"
          />
          <path
            d={`M 164 ${104 + mainCableLength} Q 164 ${114 + mainCableLength} 158 ${114 + mainCableLength} Q 152 ${114 + mainCableLength} 152 ${108 + mainCableLength}`}
            fill="none"
            className="stroke-(--hanwha-orange-100)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </g>
        {crane.load > 0 && (
          <rect
            x="149"
            y={118 + mainCableLength}
            width="30"
            height={12 + (crane.load / crane.maxLoad) * 10}
            rx="3"
            className={cn('stroke-foreground/20', loadColor)}
            strokeWidth="0.5"
            opacity={0.7}
          />
        )}
        <ValueLabel
          x={164}
          y={140 + mainCableLength + (crane.load > 0 ? 16 : 0)}
          label="MAIN HOIST"
          value={crane.load.toFixed(1)}
          unit="ton"
          colorClass={loadColor}
          anchor="middle"
        />
      </g>

      {/* Auxiliary Hoist Trolley */}
      <g
        style={{
          transform: `translateX(${auxTrolleyX - 160}px)`,
          transition: 'transform 0.8s ease-out',
        }}
      >
        <rect
          x="158"
          y="80"
          width="24"
          height="12"
          rx="3"
          className="fill-(--hanwha-orange-70) stroke-(--hanwha-orange-70)/50"
          strokeWidth="1"
        />
        <circle cx="163" cy="80" r="2.5" className="fill-foreground/30" />
        <circle cx="177" cy="80" r="2.5" className="fill-foreground/30" />
        <line
          x1="170"
          y1="92"
          x2="170"
          y2={92 + auxCableLength}
          stroke="url(#cableGrad)"
          strokeWidth="1.5"
          opacity="0.7"
        />
        <path
          d={`M 170 ${92 + auxCableLength} Q 170 ${102 + auxCableLength} 165 ${102 + auxCableLength} Q 160 ${102 + auxCableLength} 160 ${97 + auxCableLength}`}
          fill="none"
          className="stroke-(--hanwha-orange-70)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <ValueLabel
          x={170}
          y={110 + auxCableLength}
          label="AUX HOIST"
          value={crane.auxLoad.toFixed(1)}
          unit="ton"
          anchor="middle"
        />
      </g>

      {/* ── 위협 물체 렌더링 ── */}
      {threatLevels.map((obj) =>
        obj.type === 'person' ? (
          <PersonIcon key={obj.id} x={obj.x} y={obj.y} level={obj.level} />
        ) : (
          <VehicleIcon
            key={obj.id}
            x={obj.x}
            y={obj.y}
            level={obj.level}
            flipX={obj.dx < 0}
          />
        ),
      )}

      {/* ── 거리 표시선 (warning 이상일 때) ── */}
      {threatLevels
        .filter((t) => t.level !== 'safe')
        .map((t) => (
          <g key={`dist-${t.id}`} opacity="0.5">
            <line
              x1={t.x}
              y1={t.y - 10}
              x2={hookX}
              y2={hookY}
              strokeDasharray="3 3"
              strokeWidth="1"
              stroke={
                t.level === 'danger'
                  ? '#ef4444'
                  : t.level === 'warning'
                    ? '#f97316'
                    : '#f59e0b'
              }
            />
            {/* 거리 수치 */}
            <text
              x={(t.x + hookX) / 2}
              y={(t.y + hookY) / 2 - 4}
              textAnchor="middle"
              fontSize="9"
              fill={
                t.level === 'danger'
                  ? '#ef4444'
                  : t.level === 'warning'
                    ? '#f97316'
                    : '#f59e0b'
              }
              fontWeight="bold"
            >
              {Math.round(t.dist)}px
            </text>
          </g>
        ))}

      {/* Wind indicator */}
      <g>
        <g
          className="origin-center"
          style={{ transform: 'rotate(-15deg)', transformOrigin: '650px 50px' }}
        >
          <line
            x1="630"
            y1="50"
            x2="670"
            y2="50"
            className="stroke-foreground/40"
            strokeWidth="2"
            markerEnd="url(#arrowHead)"
          />
          <polygon
            points="670,45 680,50 670,55"
            className="fill-foreground/40"
          />
        </g>
        <ValueLabel
          x={655}
          y={80}
          label="WIND"
          value={crane.windSpeed.toFixed(1)}
          unit="m/s"
          colorClass={windColor}
          anchor="middle"
        />
      </g>

      {/* Trolley position indicator */}
      <g>
        <line
          x1="160"
          y1="42"
          x2="560"
          y2="42"
          className="stroke-foreground/10"
          strokeWidth="0.5"
        />
        <circle
          cx={trolleyX}
          cy="42"
          r="4"
          className="fill-(--hanwha-orange-100)"
          opacity="0.8"
        />
        <ValueLabel
          x={360}
          y={28}
          label="TROLLEY POS"
          value={crane.trolleyPosition.toFixed(1)}
          unit={`/ ${crane.girderLength}m`}
          anchor="middle"
        />
      </g>

      {/* Hoist height indicator */}
      <g>
        <ValueLabel
          x={68}
          y={100}
          label="HEIGHT"
          value={crane.hoistHeight.toFixed(1)}
          unit="m"
          anchor="end"
        />
        <line
          x1="80"
          y1="115"
          x2="80"
          y2="335"
          className="stroke-foreground/10"
          strokeWidth="0.5"
        />
        {Array.from({ length: 5 }, (_, i) => (
          <line
            key={i}
            x1="75"
            y1={115 + i * 55}
            x2="80"
            y2={115 + i * 55}
            className="stroke-foreground/15"
            strokeWidth="1"
          />
        ))}
      </g>

      {/* Slew angle */}
      <g>
        <ValueLabel
          x={85}
          y={378}
          label="SLEW"
          value={crane.slewAngle.toFixed(0)}
          unit="°"
          anchor="start"
        />
      </g>

      {/* Boom angle */}
      <g>
        <ValueLabel
          x={635}
          y={378}
          label="BOOM"
          value={crane.boomAngle.toFixed(1)}
          unit="°"
          anchor="end"
        />
      </g>

      {/* Rail position labels */}
      <g>
        <text
          x="155"
          y="362"
          textAnchor="middle"
          className="fill-muted-foreground text-[8px]"
        >
          Rail L: {crane.railPositionLeft.toFixed(1)}m
        </text>
        <text
          x="565"
          y="362"
          textAnchor="middle"
          className="fill-muted-foreground text-[8px]"
        >
          Rail R: {crane.railPositionRight.toFixed(1)}m
        </text>
      </g>

      {/* ── 충돌 경보 배너 (맨 위) ── */}
      <CollisionAlarmBanner
        level={maxLevel}
        objectType={
          threatLevels.find((t) => t.level === maxLevel)?.type ?? 'person'
        }
      />
    </svg>
  );
}
