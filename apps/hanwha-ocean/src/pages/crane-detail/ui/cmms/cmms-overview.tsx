import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getCmmsMockData, getCraneById } from '@crane/domain/crane';
import { RunFaultBadge, OkNgBadge, OnOffBadge } from '@crane/ui/molecules/cmms-status-badge';
import { CmmsPanel } from '@crane/ui/molecules/cmms-panel';
import { CmmsValueRow } from '@crane/ui/molecules/cmms-value-row';
import { CmmsBadgeRow } from '@crane/ui/molecules/cmms-badge-row';
import type { CmmsOverviewMachineRow } from '@crane/domain/crane';

export function CmmsOverview() {
  const { craneId = '' } = useParams<{ craneId: string }>();
  const { t } = useTranslation('cmms');
  const data = getCmmsMockData(craneId).overview;
  const isIndoor = getCraneById(craneId.replace(/-/g, '_'))?.regionId === 'dock-in';

  return (
    <div className="h-full flex flex-col bg-background text-foreground overflow-hidden">

      {/* ── 상단 헤더 바 ── */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-card border-b border-border shrink-0">
        <span className="text-sm font-bold tracking-widest text-foreground uppercase">{t('overview.title')}</span>
        <div className="flex items-center gap-6 text-[11px]">
          <StatusIndicator color="bg-red-500"     label={t('overview.controlStatus')} />
          <StatusIndicator color="bg-emerald-400" label={t('overview.systemStatus')} />
          <StatusIndicator color="bg-emerald-400" label={t('overview.plcCommStatus')} />
          <div className="w-px h-4 bg-border" />
          <span className="text-muted-foreground">
            {t('overview.hoistMode')} <span className="text-foreground font-semibold ml-2">H1</span>
          </span>
          <span className="text-muted-foreground">
            {t('overview.trolleyMode')} <span className="text-foreground font-semibold ml-2">UT</span>
          </span>
        </div>
      </div>

      {/* ── 메인 영역 ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── 크레인 시각화 + 하단 테이블 ── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* SVG */}
          <div className="flex-1 flex items-center justify-center bg-background p-4 min-h-0">
            {isIndoor ? <BridgeCraneSvg /> : <CraneSvg />}
          </div>

          {/* ── 하단 요약 테이블 ── */}
          <div className="shrink-0 border-t border-border overflow-x-auto bg-card">
            <MachineTable machines={data.machines} t={t} />
          </div>
        </div>

        {/* ── 우측 패널 ── */}
        <div className="w-64 shrink-0 flex flex-col border-l border-border bg-card overflow-y-auto">

          {/* WIND */}
          <CmmsPanel variant="side" title={t('overview.wind.title')}>
            <CmmsValueRow label={t('overview.wind.speed')}     value={data.wind.speed.toFixed(1)} bordered align="right" />
            <CmmsValueRow label={t('overview.wind.direction')} value={data.wind.direction}         bordered align="right" />
            <CmmsBadgeRow label={t('overview.wind.highWindWarning')} badge={<OnOffBadge value={data.wind.highWindWarning} />} />
            <CmmsBadgeRow label={t('overview.wind.highWindTrip')}    badge={<OnOffBadge value={data.wind.highWindTrip} />} />
          </CmmsPanel>

          {/* LOAD */}
          <CmmsPanel variant="side" title={t('overview.load.title')}>
            <CmmsValueRow label={t('overview.load.totalLoad')} value={data.load.totalLoad.toFixed(1)} bordered align="right" />
            <CmmsValueRow label={t('overview.load.h1h2Diff')}  value={data.load.h1h2Diff.toFixed(1)} bordered align="right" />
            <div className="mt-1 space-y-1">
              <BadgeGroupRow
                label={t('overview.load.overloadWarning')}
                badges={data.load.overloadWarning}
                headers={['H1','H2','H3']}
              />
              <BadgeGroupRow
                label={t('overview.load.overloadTrip')}
                badges={data.load.overloadTrip}
                headers={['H1','H2','H3']}
              />
              <CmmsBadgeRow label={t('overview.load.totalOverloadWarning')} badge={<OnOffBadge value={data.load.totalOverloadWarning} />} />
              <CmmsBadgeRow label={t('overview.load.totalOverloadTrip')}    badge={<OnOffBadge value={data.load.totalOverloadTrip} />} />
            </div>
          </CmmsPanel>

          {/* E-STOP */}
          <CmmsPanel variant="side" flex title={t('overview.eStop.title')}>
            {(Object.keys(data.eStop) as (keyof typeof data.eStop)[]).map((key) => (
              <div key={key} className="flex items-center gap-2 py-0.5">
                <OkNgBadge value={data.eStop[key]} />
                <span className="text-xs text-foreground">{t(`overview.eStop.${key}`)}</span>
              </div>
            ))}
          </CmmsPanel>
        </div>
      </div>
    </div>
  );
}

/* ── 호이스트 시뮬레이션 상태 ── */
interface HoistSim {
  pos: number;       // 0(top) ~ 1(bottom)
  dir: 1 | -1;
  speed: number;     // per tick (0.003~0.008)
}

function useCraneSim() {
  const [hoists, setHoists] = useState<HoistSim[]>(() => [
    { pos: 0.1, dir: 1, speed: 0.005 },
    { pos: 0.5, dir: -1, speed: 0.007 },
    { pos: 0.8, dir: -1, speed: 0.004 },
  ]);
  const [trolleyX, setTrolleyX] = useState(0.35); // 0~1
  const trolleyDir = useRef<1 | -1>(1);

  useEffect(() => {
    const id = setInterval(() => {
      setHoists(prev =>
        prev.map(h => {
          let next = h.pos + h.dir * h.speed;
          let dir = h.dir;
          if (next >= 1) { next = 1; dir = -1; }
          if (next <= 0) { next = 0; dir = 1; }
          return { ...h, pos: next, dir };
        })
      );
      setTrolleyX(prev => {
        let next = prev + trolleyDir.current * 0.003;
        if (next >= 0.75) { next = 0.75; trolleyDir.current = -1; }
        if (next <= 0.15) { next = 0.15; trolleyDir.current = 1; }
        return next;
      });
    }, 50);
    return () => clearInterval(id);
  }, []);

  return { hoists, trolleyX };
}

/* ── 크레인 SVG ── */
function CraneSvg() {
  const { hoists, trolleyX } = useCraneSim();

  // SVG 좌표계 상수
  const BEAM_Y = 96;       // 메인 빔 상단 Y
  const BEAM_BOTTOM = 124; // 메인 빔 하단 Y
  const ROPE_TOP = BEAM_BOTTOM;
  const ROPE_BOTTOM_MAX = 320; // 훅이 내려갈 수 있는 최저 Y
  const ROPE_RANGE = ROPE_BOTTOM_MAX - ROPE_TOP;

  // 호이스트 3개 X 위치 (빔 위)
  const HOIST_XS = [245, 430, 610];

  // 트롤리 X (0~1 → SVG x 좌표 150~750)
  const TX = 150 + trolleyX * 600;

  return (
    <svg
      viewBox="0 0 900 420"
      className="w-full h-full"
      style={{ maxHeight: 360 }}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* ── 레일 & 거더 ── */}
      <rect x="30"  y="360" width="160" height="18" rx="4" fill="#52525b"/>
      <rect x="710" y="360" width="160" height="18" rx="4" fill="#52525b"/>
      <rect x="50"  y="345" width="130" height="18" rx="3" fill="#6b7280"/>
      <rect x="720" y="345" width="130" height="18" rx="3" fill="#6b7280"/>

      {/* ── 좌측 다리 ── */}
      <rect x="80"  y="120" width="36" height="228" rx="6" fill="#f59e0b"/>
      <rect x="116" y="120" width="10" height="228" rx="3" fill="#d97706"/>
      <line x1="96"  y1="200" x2="170" y2="340" stroke="#d97706" strokeWidth="8" strokeLinecap="round"/>

      {/* ── 우측 다리 ── */}
      <rect x="784" y="120" width="36" height="228" rx="6" fill="#f59e0b"/>
      <rect x="774" y="120" width="10" height="228" rx="3" fill="#d97706"/>
      <line x1="804" y1="200" x2="730" y2="340" stroke="#d97706" strokeWidth="8" strokeLinecap="round"/>

      {/* ── 메인 빔 ── */}
      <rect x="60" y={BEAM_Y} width="780" height="28" rx="6" fill="#f59e0b"/>
      <rect x="60" y={BEAM_Y} width="780" height="8"  rx="6" fill="#fbbf24"/>
      <text x="450" y="120" textAnchor="middle" fill="white" fontSize="26" fontWeight="bold" fontFamily="sans-serif" opacity="0.85">Hanwha</text>

      {/* ── 트롤리 (이동) ── */}
      <rect x={TX - 28} y={BEAM_Y - 18} width="56" height="20" rx="4" fill="#f59e0b"/>
      <rect x={TX - 28} y={BEAM_Y - 18} width="56" height="6"  rx="4" fill="#fbbf24"/>
      <circle cx={TX - 16} cy={BEAM_Y - 1} r="5" fill="#374151"/>
      <circle cx={TX + 16} cy={BEAM_Y - 1} r="5" fill="#374151"/>

      {/* ── 호이스트 3개 ── */}
      {HOIST_XS.map((hx, i) => {
        const ropeBottom = ROPE_TOP + hoists[i].pos * ROPE_RANGE;
        const hookY = ropeBottom;
        const label = `H${i + 1}`;
        return (
          <g key={i}>
            {/* 로프 */}
            <line
              x1={hx} y1={ROPE_TOP}
              x2={hx} y2={hookY - 10}
              stroke="#9ca3af"
              strokeWidth="2.5"
              strokeDasharray="4 2"
            />
            {/* 도르래 블록 */}
            <rect x={hx - 18} y={hookY - 10} width="36" height="20" rx="4" fill="#4b5563"/>
            <rect x={hx - 18} y={hookY - 10} width="36" height="6"  rx="4" fill="#6b7280"/>
            {/* 훅 */}
            <rect x={hx - 5} y={hookY + 10} width="10" height="14" rx="2" fill="#9ca3af"/>
            <ellipse cx={hx} cy={hookY + 27} rx="8" ry="5" fill="none" stroke="#9ca3af" strokeWidth="3"/>
            {/* 호이스트 번호 라벨 */}
            <text
              x={hx} y={ROPE_TOP - 6}
              textAnchor="middle"
              fill="#fbbf24"
              fontSize="11"
              fontWeight="bold"
              fontFamily="sans-serif"
            >{label}</text>
            {/* 위치 값 */}
            <text
              x={hx + 22} y={hookY + 5}
              fill="#94a3b8"
              fontSize="10"
              fontFamily="monospace"
            >{(hoists[i].pos * 30).toFixed(1)}m</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ── 브리지 크레인 시뮬레이션 ── */
interface TrolleySim {
  x: number;   // 0~1 along bridge girder
  dir: 1 | -1;
  speed: number;
  hoistPos: number; // 0(top)~1(bottom)
  hoistDir: 1 | -1;
  hoistSpeed: number;
}

function useBridgeCraneSim() {
  const [trolleys, setTrolleys] = useState<TrolleySim[]>(() => [
    { x: 0.25, dir: 1,  speed: 0.004, hoistPos: 0.2, hoistDir: 1,  hoistSpeed: 0.005 },
    { x: 0.70, dir: -1, speed: 0.003, hoistPos: 0.6, hoistDir: -1, hoistSpeed: 0.006 },
  ]);

  useEffect(() => {
    const id = setInterval(() => {
      setTrolleys(prev =>
        prev.map(t => {
          let x = t.x + t.dir * t.speed;
          let dir = t.dir;
          if (x >= 0.82) { x = 0.82; dir = -1; }
          if (x <= 0.08) { x = 0.08; dir = 1; }

          let hoistPos = t.hoistPos + t.hoistDir * t.hoistSpeed;
          let hoistDir = t.hoistDir;
          if (hoistPos >= 1) { hoistPos = 1; hoistDir = -1; }
          if (hoistPos <= 0) { hoistPos = 0; hoistDir = 1; }

          return { ...t, x, dir, hoistPos, hoistDir };
        })
      );
    }, 50);
    return () => clearInterval(id);
  }, []);

  return trolleys;
}

/* ── 브리지(오버헤드) 크레인 SVG ── */
function BridgeCraneSvg() {
  const trolleys = useBridgeCraneSim();
  return <BridgeCraneTopView trolleys={trolleys} />;
}

/* ── 평면도(top-view) 브리지 크레인 ── */
function BridgeCraneTopView({ trolleys }: { trolleys: ReturnType<typeof useBridgeCraneSim> }) {

  // ── top-view 좌표 상수 ──────────────────────────────
  const VW = 900;
  const VH = 320;

  // 런웨이 레일 (좌우, 수평으로 뻗은 두 줄)
  const RAIL_Y1 = 80;   // 상단 레일 Y
  const RAIL_Y2 = 220;  // 하단 레일 Y
  const RAIL_X1 = 30;
  const RAIL_X2 = 870;
  const RAIL_H  = 22;   // 레일 두께

  // end truck (양 끝 세로 박스)
  const ET_X1 = 80;   // 좌측 end truck 우측 끝
  const ET_X2 = 820;  // 우측 end truck 좌측 시작
  const ET_W  = 68;   // end truck 폭
  const ET_Y  = RAIL_Y1 + RAIL_H;
  const ET_H  = RAIL_Y2 - RAIL_Y1 - RAIL_H;

  // 거더 2개 (상단/하단, top-view에서 두 줄로 보임)
  const GDR_Y1 = ET_Y + 14;       // 앞 거더 Y
  const GDR_Y2 = ET_Y + ET_H - 28; // 뒤 거더 Y
  const GDR_H  = 18;
  const GDR_X1 = ET_X1;
  const GDR_X2 = ET_X2 + ET_W;

  // 트롤리 이동 범위 (두 거더 사이 공간에서 X축으로 이동)
  const TX_MIN = ET_X1 + 10;
  const TX_MAX = ET_X2 + ET_W - 10;
  const TX_RNG = TX_MAX - TX_MIN;

  // 트롤리 Y 중심 (두 거더 사이 중앙)
  const TY = (GDR_Y1 + GDR_H + GDR_Y2) / 2;

  // 훅 깊이 → 원 크기로 표현 (평면도에서 아래 방향은 원 크기로)
  const HOOK_R_MIN = 4;
  const HOOK_R_MAX = 16;

  const C = ['#60a5fa', '#f59e0b'] as const;

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      className="w-full h-full"
      style={{ maxHeight: 300 }}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="railGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#6b7280"/>
          <stop offset="40%"  stopColor="#9ca3af"/>
          <stop offset="100%" stopColor="#4b5563"/>
        </linearGradient>
        <linearGradient id="girderGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#fbbf24"/>
          <stop offset="30%"  stopColor="#f59e0b"/>
          <stop offset="100%" stopColor="#b45309"/>
        </linearGradient>
        <linearGradient id="etGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#fbbf24"/>
          <stop offset="50%"  stopColor="#f59e0b"/>
          <stop offset="100%" stopColor="#d97706"/>
        </linearGradient>
        <filter id="ds">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.5"/>
        </filter>
        <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* ── 바닥/배경 격자 ── */}
      {Array.from({ length: 19 }, (_, i) => (
        <line key={`h${i}`} x1={RAIL_X1} y1={20 + i * 15} x2={RAIL_X2} y2={20 + i * 15}
          stroke="#1e293b" strokeWidth="1"/>
      ))}
      {Array.from({ length: 29 }, (_, i) => (
        <line key={`v${i}`} x1={RAIL_X1 + i * 30} y1={20} x2={RAIL_X1 + i * 30} y2={VH - 20}
          stroke="#1e293b" strokeWidth="1"/>
      ))}

      {/* ── 런웨이 레일 (상단) ── */}
      <rect x={RAIL_X1} y={RAIL_Y1} width={RAIL_X2 - RAIL_X1} height={RAIL_H}
        rx="4" fill="url(#railGrad)" filter="url(#ds)"/>
      {/* 레일 볼트 패턴 */}
      {Array.from({ length: 16 }, (_, i) => (
        <circle key={i} cx={RAIL_X1 + 30 + i * 52} cy={RAIL_Y1 + 11} r="3"
          fill="#374151" stroke="#6b7280" strokeWidth="1"/>
      ))}
      {/* 레일 중심선 (반사광) */}
      <rect x={RAIL_X1} y={RAIL_Y1 + 7} width={RAIL_X2 - RAIL_X1} height="3"
        fill="#d1d5db" opacity="0.25" rx="1"/>

      {/* ── 런웨이 레일 (하단) ── */}
      <rect x={RAIL_X1} y={RAIL_Y2} width={RAIL_X2 - RAIL_X1} height={RAIL_H}
        rx="4" fill="url(#railGrad)" filter="url(#ds)"/>
      {Array.from({ length: 16 }, (_, i) => (
        <circle key={i} cx={RAIL_X1 + 30 + i * 52} cy={RAIL_Y2 + 11} r="3"
          fill="#374151" stroke="#6b7280" strokeWidth="1"/>
      ))}
      <rect x={RAIL_X1} y={RAIL_Y2 + 7} width={RAIL_X2 - RAIL_X1} height="3"
        fill="#d1d5db" opacity="0.25" rx="1"/>

      {/* ── 좌측 end truck ── */}
      <rect x={RAIL_X1 + 4} y={ET_Y} width={ET_W} height={ET_H}
        rx="6" fill="url(#etGrad)" filter="url(#ds)"/>
      {/* 크로스 보강 */}
      <line x1={RAIL_X1 + 8} y1={ET_Y + 6} x2={RAIL_X1 + ET_W} y2={ET_Y + ET_H - 6}
        stroke="#92400e" strokeWidth="2" opacity="0.5"/>
      <line x1={RAIL_X1 + ET_W} y1={ET_Y + 6} x2={RAIL_X1 + 8} y2={ET_Y + ET_H - 6}
        stroke="#92400e" strokeWidth="2" opacity="0.5"/>
      {/* 테두리 하이라이트 */}
      <rect x={RAIL_X1 + 4} y={ET_Y} width={ET_W} height={ET_H}
        rx="6" stroke="#fde68a" strokeWidth="1" opacity="0.4"/>
      {/* 바퀴 4개 (코너) */}
      {[[RAIL_X1 + 14, RAIL_Y1 + 8], [RAIL_X1 + 14, RAIL_Y2 + 8],
        [RAIL_X1 + ET_W - 4, RAIL_Y1 + 8], [RAIL_X1 + ET_W - 4, RAIL_Y2 + 8]].map(([wx, wy], wi) => (
        <g key={wi}>
          <circle cx={wx} cy={wy} r="8" fill="#1f2937" stroke="#6b7280" strokeWidth="2"/>
          <circle cx={wx} cy={wy} r="3.5" fill="#374151"/>
          <line x1={wx - 7} y1={wy} x2={wx + 7} y2={wy} stroke="#4b5563" strokeWidth="1"/>
          <line x1={wx} y1={wy - 7} x2={wx} y2={wy + 7} stroke="#4b5563" strokeWidth="1"/>
        </g>
      ))}

      {/* ── 우측 end truck ── */}
      <rect x={ET_X2} y={ET_Y} width={ET_W} height={ET_H}
        rx="6" fill="url(#etGrad)" filter="url(#ds)"/>
      <line x1={ET_X2 + 8} y1={ET_Y + 6} x2={ET_X2 + ET_W - 8} y2={ET_Y + ET_H - 6}
        stroke="#92400e" strokeWidth="2" opacity="0.5"/>
      <line x1={ET_X2 + ET_W - 8} y1={ET_Y + 6} x2={ET_X2 + 8} y2={ET_Y + ET_H - 6}
        stroke="#92400e" strokeWidth="2" opacity="0.5"/>
      <rect x={ET_X2} y={ET_Y} width={ET_W} height={ET_H}
        rx="6" stroke="#fde68a" strokeWidth="1" opacity="0.4"/>
      {[[ET_X2 + 10, RAIL_Y1 + 8], [ET_X2 + 10, RAIL_Y2 + 8],
        [ET_X2 + ET_W - 10, RAIL_Y1 + 8], [ET_X2 + ET_W - 10, RAIL_Y2 + 8]].map(([wx, wy], wi) => (
        <g key={wi}>
          <circle cx={wx} cy={wy} r="8" fill="#1f2937" stroke="#6b7280" strokeWidth="2"/>
          <circle cx={wx} cy={wy} r="3.5" fill="#374151"/>
          <line x1={wx - 7} y1={wy} x2={wx + 7} y2={wy} stroke="#4b5563" strokeWidth="1"/>
          <line x1={wx} y1={wy - 7} x2={wx} y2={wy + 7} stroke="#4b5563" strokeWidth="1"/>
        </g>
      ))}

      {/* ── 거더 1 (상단) ── */}
      <rect x={GDR_X1} y={GDR_Y1} width={GDR_X2 - GDR_X1} height={GDR_H}
        rx="3" fill="url(#girderGrad)" filter="url(#ds)"/>
      <rect x={GDR_X1} y={GDR_Y1} width={GDR_X2 - GDR_X1} height="4"
        rx="3" fill="#fde68a" opacity="0.5"/>
      {/* 거더 보강재 */}
      {Array.from({ length: 14 }, (_, i) => (
        <line key={i}
          x1={GDR_X1 + (i + 1) * (GDR_X2 - GDR_X1) / 15} y1={GDR_Y1}
          x2={GDR_X1 + (i + 1) * (GDR_X2 - GDR_X1) / 15} y2={GDR_Y1 + GDR_H}
          stroke="#92400e" strokeWidth="1.5" opacity="0.45"/>
      ))}

      {/* ── 거더 2 (하단) ── */}
      <rect x={GDR_X1} y={GDR_Y2} width={GDR_X2 - GDR_X1} height={GDR_H}
        rx="3" fill="url(#girderGrad)" filter="url(#ds)"/>
      <rect x={GDR_X1} y={GDR_Y2} width={GDR_X2 - GDR_X1} height="4"
        rx="3" fill="#fde68a" opacity="0.5"/>
      {Array.from({ length: 14 }, (_, i) => (
        <line key={i}
          x1={GDR_X1 + (i + 1) * (GDR_X2 - GDR_X1) / 15} y1={GDR_Y2}
          x2={GDR_X1 + (i + 1) * (GDR_X2 - GDR_X1) / 15} y2={GDR_Y2 + GDR_H}
          stroke="#92400e" strokeWidth="1.5" opacity="0.45"/>
      ))}

      {/* HANWHA OCEAN 텍스트 (두 거더 사이 중앙) */}
      <text x={VW / 2} y={TY + 5} textAnchor="middle"
        fill="#fbbf24" fontSize="13" fontWeight="bold" fontFamily="sans-serif"
        opacity="0.5" letterSpacing="4">
        HANWHA OCEAN
      </text>

      {/* ── 트롤리 2개 (두 거더 사이를 X방향으로 이동) ── */}
      {trolleys.map((t, i) => {
        const tx  = TX_MIN + t.x * TX_RNG;
        const col = C[i];
        const hookR = HOOK_R_MIN + t.hoistPos * (HOOK_R_MAX - HOOK_R_MIN);
        const label = `T${i + 1}`;

        return (
          <g key={i}>
            {/* 트롤리 몸체 (두 거더 사이 폭으로) */}
            <rect
              x={tx - 22} y={GDR_Y1 + GDR_H - 2}
              width="44" height={GDR_Y2 - GDR_Y1 - GDR_H + 4}
              rx="5" fill="#1e293b" stroke={col} strokeWidth="2" filter="url(#ds)"
            />
            {/* 트롤리 내부 패널 */}
            <rect
              x={tx - 15} y={GDR_Y1 + GDR_H + 4}
              width="30" height={GDR_Y2 - GDR_Y1 - GDR_H - 8}
              rx="3" fill="#0f172a" stroke={col} strokeWidth="1" opacity="0.8"
            />
            {/* 드럼 (top-view에서 원) */}
            <circle cx={tx} cy={TY} r="10" fill="#0f172a" stroke={col} strokeWidth="1.5"/>
            <circle cx={tx} cy={TY} r="5"  fill="#1e293b" stroke={col} strokeWidth="1"/>
            {/* 바퀴 (거더 위) */}
            <circle cx={tx - 14} cy={GDR_Y1 + GDR_H / 2} r="5" fill="#111827" stroke={col} strokeWidth="1.5"/>
            <circle cx={tx + 14} cy={GDR_Y1 + GDR_H / 2} r="5" fill="#111827" stroke={col} strokeWidth="1.5"/>
            <circle cx={tx - 14} cy={GDR_Y2 + GDR_H / 2} r="5" fill="#111827" stroke={col} strokeWidth="1.5"/>
            <circle cx={tx + 14} cy={GDR_Y2 + GDR_H / 2} r="5" fill="#111827" stroke={col} strokeWidth="1.5"/>

            {/* 훅 (top-view: 깊이 = 원 크기로 표현) */}
            <circle cx={tx} cy={TY} r={hookR} fill="none" stroke={col} strokeWidth="2" opacity="0.6" filter="url(#glow)"/>
            <circle cx={tx} cy={TY} r="3" fill={col} opacity="0.9"/>

            {/* 라벨 */}
            <rect x={tx - 14} y={GDR_Y1 - 22} width="28" height="16" rx="4"
              fill="#0f172a" stroke={col} strokeWidth="1.5"/>
            <text x={tx} y={GDR_Y1 - 10} textAnchor="middle"
              fill={col} fontSize="10" fontWeight="bold" fontFamily="sans-serif">
              {label}
            </text>

            {/* 위치 수치 */}
            <text x={tx} y={GDR_Y2 + GDR_H + 16} textAnchor="middle"
              fill={col} fontSize="10" fontFamily="monospace">
              {`${(t.x * 100).toFixed(0)}%  ↓${(t.hoistPos * 20).toFixed(1)}m`}
            </text>
          </g>
        );
      })}

      {/* ── 범례 ── */}
      <rect x={VW - 152} y={10} width="140" height="54" rx="6" fill="#0f172a" opacity="0.9"/>
      <text x={VW - 82} y={26} textAnchor="middle" fill="#94a3b8" fontSize="9" fontFamily="sans-serif" letterSpacing="1">TOP VIEW</text>
      {trolleys.map((t, i) => (
        <g key={i}>
          <circle cx={VW - 138} cy={36 + i * 20} r="5" fill={C[i]}/>
          <text x={VW - 128} y={40 + i * 20} fill="#e2e8f0" fontSize="10" fontFamily="monospace">
            {`T${i + 1}  ${(t.x * 100).toFixed(0).padStart(3)}%  ↓${(t.hoistPos * 20).toFixed(1)}m`}
          </text>
        </g>
      ))}
    </svg>
  );
}

/* ── 기계별 컬럼 테이블 ── */
function MachineTable({ machines, t }: { machines: CmmsOverviewMachineRow[]; t: (k: string) => string }) {
  const rows: { label: string; render: (m: CmmsOverviewMachineRow) => ReactNode }[] = [
    { label: t('overview.table.runFault'),  render: m => <RunFaultBadge value={m.runFault} /> },
    { label: t('overview.table.joystick'),  render: m => <MonoCell>{m.joystickStep}</MonoCell> },
    { label: t('overview.table.speed'),     render: m => <MonoCell>{m.speed.toFixed(2)}</MonoCell> },
    { label: t('overview.table.position'),  render: m => <MonoCell>{m.position.toFixed(1)}</MonoCell> },
    { label: t('overview.table.load'),      render: m => <MonoCell>{m.load != null ? m.load.toFixed(1) : '—'}</MonoCell> },
  ];

  return (
    <table className="w-full text-xs border-collapse">
      <thead>
        <tr className="border-b border-border">
          <th className="text-left px-3 py-2 font-semibold text-muted-foreground w-32 border-r border-border"></th>
          {machines.map(m => (
            <th key={m.name} className="px-3 py-2 font-bold text-foreground text-center border-r border-border last:border-r-0 whitespace-pre-line">
              {m.name.replace(' ', '\n')}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(({ label, render }) => (
          <tr key={label} className="border-b border-border last:border-0">
            <td className="px-3 py-1.5 text-muted-foreground font-medium border-r border-border">{label}</td>
            {machines.map(m => (
              <td key={m.name} className="px-3 py-1.5 text-center border-r border-border last:border-0">
                {render(m)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ── 배지 그룹 행 ── */
function BadgeGroupRow({ label, badges, headers }: { label: string; badges: readonly string[]; headers: string[] }) {
  return (
    <div>
      <div className="flex justify-end gap-1 mb-0.5">
        {headers.map(h => <span key={h} className="text-[10px] text-muted-foreground w-8 text-center">{h}</span>)}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-foreground">{label}</span>
        <div className="flex gap-1">
          {badges.map((v, i) => <OnOffBadge key={i} value={v as 'ON' | 'OFF'} />)}
        </div>
      </div>
    </div>
  );
}

/* ── 모노 셀 ── */
function MonoCell({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block font-mono bg-muted border border-border px-2 py-0.5 rounded text-foreground text-xs min-w-12 text-center">
      {children}
    </span>
  );
}

/* ── 상태 인디케이터 ── */
function StatusIndicator({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`size-2 rounded-full shrink-0 ${color}`} />
      <span className="text-muted-foreground whitespace-nowrap">{label}</span>
    </span>
  );
}
