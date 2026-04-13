import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getCmmsMockData } from '../../model/mock-data';
import { getCraneById } from '@crane/domain/crane';
import { RunFaultBadge, OkNgBadge, OnOffBadge } from '@crane/ui/molecules/cmms-status-badge';
import { CmmsPanel } from '@crane/ui/molecules/cmms-panel';
import { CmmsValueRow } from '@crane/ui/molecules/cmms-value-row';
import { CmmsBadgeRow } from '@crane/ui/molecules/cmms-badge-row';
import type { CmmsOverviewMachineRow } from '../../model/types';

interface CmmsOverviewInlineProps {
  craneId: string;
}

export function CmmsOverviewInline({ craneId }: CmmsOverviewInlineProps) {
  const { t } = useTranslation('cmms');
  const data = getCmmsMockData(craneId).overview;
  const isIndoor = getCraneById(craneId.replace(/-/g, '_'))?.regionId === 'dock-in';

  return (
    <div className="flex flex-col bg-background text-foreground">
      {/* ── 크레인 시각화 ── */}
      <div className="flex items-center justify-center bg-background px-4 pt-4 pb-2">
        {isIndoor ? <BridgeCraneSvg /> : <CraneSvg />}
      </div>

      {/* ── 기계별 요약 테이블 ── */}
      <div className="border-t border-border overflow-x-auto bg-card">
        <MachineTable machines={data.machines} t={t} />
      </div>

      {/* ── 우측 패널들 (세로 배치) ── */}
      <div className="flex flex-col border-t border-border bg-card">
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
          <CmmsValueRow label={t('overview.load.h1h2Diff')}  value={data.load.h1h2Diff.toFixed(1)}  bordered align="right" />
          <div className="mt-1 space-y-1">
            <BadgeGroupRow label={t('overview.load.overloadWarning')} badges={data.load.overloadWarning} headers={['H1','H2','H3']} />
            <BadgeGroupRow label={t('overview.load.overloadTrip')}    badges={data.load.overloadTrip}    headers={['H1','H2','H3']} />
            <CmmsBadgeRow label={t('overview.load.totalOverloadWarning')} badge={<OnOffBadge value={data.load.totalOverloadWarning} />} />
            <CmmsBadgeRow label={t('overview.load.totalOverloadTrip')}    badge={<OnOffBadge value={data.load.totalOverloadTrip} />} />
          </div>
        </CmmsPanel>

        {/* E-STOP */}
        <CmmsPanel variant="side" title={t('overview.eStop.title')}>
          {(Object.keys(data.eStop) as (keyof typeof data.eStop)[]).map((key) => (
            <div key={key} className="flex items-center gap-2 py-0.5">
              <OkNgBadge value={data.eStop[key]} />
              <span className="text-xs text-foreground">{t(`overview.eStop.${key}`)}</span>
            </div>
          ))}
        </CmmsPanel>
      </div>
    </div>
  );
}

/* ── 호이스트 시뮬레이션 상태 ── */
interface HoistSim {
  pos: number;
  dir: 1 | -1;
  speed: number;
}

function useCraneSim() {
  const [hoists, setHoists] = useState<HoistSim[]>(() => [
    { pos: 0.1, dir: 1, speed: 0.005 },
    { pos: 0.5, dir: -1, speed: 0.007 },
    { pos: 0.8, dir: -1, speed: 0.004 },
  ]);
  const [trolleyX, setTrolleyX] = useState(0.35);
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

function CraneSvg() {
  const { hoists, trolleyX } = useCraneSim();

  const BEAM_Y = 96;
  const BEAM_BOTTOM = 124;
  const ROPE_TOP = BEAM_BOTTOM;
  const ROPE_BOTTOM_MAX = 260;
  const ROPE_RANGE = ROPE_BOTTOM_MAX - ROPE_TOP;
  const HOIST_XS = [245, 430, 610];
  const TX = 150 + trolleyX * 600;

  return (
    <svg viewBox="0 0 900 340" className="w-full h-full" style={{ maxHeight: 280 }} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="30"  y="300" width="160" height="18" rx="4" fill="#52525b"/>
      <rect x="710" y="300" width="160" height="18" rx="4" fill="#52525b"/>
      <rect x="50"  y="285" width="130" height="18" rx="3" fill="#6b7280"/>
      <rect x="720" y="285" width="130" height="18" rx="3" fill="#6b7280"/>
      <rect x="80"  y="120" width="36" height="168" rx="6" fill="#f59e0b"/>
      <rect x="116" y="120" width="10" height="168" rx="3" fill="#d97706"/>
      <line x1="96" y1="200" x2="170" y2="280" stroke="#d97706" strokeWidth="8" strokeLinecap="round"/>
      <rect x="784" y="120" width="36" height="168" rx="6" fill="#f59e0b"/>
      <rect x="774" y="120" width="10" height="168" rx="3" fill="#d97706"/>
      <line x1="804" y1="200" x2="730" y2="280" stroke="#d97706" strokeWidth="8" strokeLinecap="round"/>
      <rect x="60" y={BEAM_Y} width="780" height="28" rx="6" fill="#f59e0b"/>
      <rect x="60" y={BEAM_Y} width="780" height="8"  rx="6" fill="#fbbf24"/>
      <text x="450" y="120" textAnchor="middle" fill="white" fontSize="22" fontWeight="bold" fontFamily="sans-serif" opacity="0.85">Hanwha</text>
      <rect x={TX - 28} y={BEAM_Y - 18} width="56" height="20" rx="4" fill="#f59e0b"/>
      <circle cx={TX - 16} cy={BEAM_Y - 1} r="5" fill="#374151"/>
      <circle cx={TX + 16} cy={BEAM_Y - 1} r="5" fill="#374151"/>
      {HOIST_XS.map((hx, i) => {
        const ropeBottom = ROPE_TOP + hoists[i].pos * ROPE_RANGE;
        return (
          <g key={i}>
            <line x1={hx} y1={ROPE_TOP} x2={hx} y2={ropeBottom - 10} stroke="#9ca3af" strokeWidth="2.5" strokeDasharray="4 2"/>
            <rect x={hx - 18} y={ropeBottom - 10} width="36" height="20" rx="4" fill="#4b5563"/>
            <rect x={hx - 5}  y={ropeBottom + 10} width="10" height="14" rx="2" fill="#9ca3af"/>
            <ellipse cx={hx} cy={ropeBottom + 27} rx="8" ry="5" fill="none" stroke="#9ca3af" strokeWidth="3"/>
            <text x={hx} y={ROPE_TOP - 6} textAnchor="middle" fill="#fbbf24" fontSize="11" fontWeight="bold" fontFamily="sans-serif">{`H${i + 1}`}</text>
          </g>
        );
      })}
    </svg>
  );
}

interface TrolleySim {
  x: number;
  dir: 1 | -1;
  speed: number;
  hoistPos: number;
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

function BridgeCraneSvg() {
  const trolleys = useBridgeCraneSim();
  const VW = 900; const VH = 280;
  const RAIL_Y1 = 60; const RAIL_Y2 = 200; const RAIL_X1 = 30; const RAIL_X2 = 870; const RAIL_H = 22;
  const ET_X1 = 80; const ET_X2 = 820; const ET_W = 68;
  const ET_Y = RAIL_Y1 + RAIL_H; const ET_H = RAIL_Y2 - RAIL_Y1 - RAIL_H;
  const GDR_Y1 = ET_Y + 14; const GDR_Y2 = ET_Y + ET_H - 28; const GDR_H = 18;
  const GDR_X1 = ET_X1; const GDR_X2 = ET_X2 + ET_W;
  const TX_MIN = ET_X1 + 10; const TX_MAX = ET_X2 + ET_W - 10; const TX_RNG = TX_MAX - TX_MIN;
  const TY = (GDR_Y1 + GDR_H + GDR_Y2) / 2;
  const HOOK_R_MIN = 4; const HOOK_R_MAX = 14;
  const C = ['#60a5fa', '#f59e0b'] as const;

  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full h-full" style={{ maxHeight: 240 }} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="railGradI" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6b7280"/><stop offset="40%" stopColor="#9ca3af"/><stop offset="100%" stopColor="#4b5563"/>
        </linearGradient>
        <linearGradient id="girderGradI" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fbbf24"/><stop offset="30%" stopColor="#f59e0b"/><stop offset="100%" stopColor="#b45309"/>
        </linearGradient>
        <linearGradient id="etGradI" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#fbbf24"/><stop offset="50%" stopColor="#f59e0b"/><stop offset="100%" stopColor="#d97706"/>
        </linearGradient>
        <filter id="dsI"><feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.5"/></filter>
        <filter id="glowI" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      {Array.from({ length: 14 }, (_, i) => (
        <line key={`h${i}`} x1={RAIL_X1} y1={15 + i * 18} x2={RAIL_X2} y2={15 + i * 18} stroke="#1e293b" strokeWidth="1"/>
      ))}
      {Array.from({ length: 29 }, (_, i) => (
        <line key={`v${i}`} x1={RAIL_X1 + i * 30} y1={15} x2={RAIL_X1 + i * 30} y2={VH - 15} stroke="#1e293b" strokeWidth="1"/>
      ))}
      <rect x={RAIL_X1} y={RAIL_Y1} width={RAIL_X2 - RAIL_X1} height={RAIL_H} rx="4" fill="url(#railGradI)" filter="url(#dsI)"/>
      <rect x={RAIL_X1} y={RAIL_Y2} width={RAIL_X2 - RAIL_X1} height={RAIL_H} rx="4" fill="url(#railGradI)" filter="url(#dsI)"/>
      <rect x={RAIL_X1 + 4} y={ET_Y} width={ET_W} height={ET_H} rx="6" fill="url(#etGradI)" filter="url(#dsI)"/>
      <rect x={ET_X2}       y={ET_Y} width={ET_W} height={ET_H} rx="6" fill="url(#etGradI)" filter="url(#dsI)"/>
      <rect x={GDR_X1} y={GDR_Y1} width={GDR_X2 - GDR_X1} height={GDR_H} rx="3" fill="url(#girderGradI)" filter="url(#dsI)"/>
      <rect x={GDR_X1} y={GDR_Y2} width={GDR_X2 - GDR_X1} height={GDR_H} rx="3" fill="url(#girderGradI)" filter="url(#dsI)"/>
      <text x={VW / 2} y={TY + 5} textAnchor="middle" fill="#fbbf24" fontSize="11" fontWeight="bold" fontFamily="sans-serif" opacity="0.5" letterSpacing="4">HANWHA OCEAN</text>
      {trolleys.map((t, i) => {
        const tx = TX_MIN + t.x * TX_RNG;
        const col = C[i];
        const hookR = HOOK_R_MIN + t.hoistPos * (HOOK_R_MAX - HOOK_R_MIN);
        return (
          <g key={i}>
            <rect x={tx - 22} y={GDR_Y1 + GDR_H - 2} width="44" height={GDR_Y2 - GDR_Y1 - GDR_H + 4} rx="5" fill="#1e293b" stroke={col} strokeWidth="2" filter="url(#dsI)"/>
            <circle cx={tx} cy={TY} r="10" fill="#0f172a" stroke={col} strokeWidth="1.5"/>
            <circle cx={tx} cy={TY} r={hookR} fill="none" stroke={col} strokeWidth="2" opacity="0.6" filter="url(#glowI)"/>
            <circle cx={tx} cy={TY} r="3" fill={col} opacity="0.9"/>
            <text x={tx} y={GDR_Y1 - 8} textAnchor="middle" fill={col} fontSize="10" fontWeight="bold" fontFamily="sans-serif">{`T${i + 1}`}</text>
          </g>
        );
      })}
    </svg>
  );
}

function MachineTable({ machines, t }: { machines: CmmsOverviewMachineRow[]; t: (k: string) => string }) {
  const rows: { label: string; render: (m: CmmsOverviewMachineRow) => ReactNode }[] = [
    { label: t('overview.table.runFault'), render: m => <RunFaultBadge value={m.runFault} /> },
    { label: t('overview.table.joystick'), render: m => <MonoCell>{m.joystickStep}</MonoCell> },
    { label: t('overview.table.speed'),    render: m => <MonoCell>{m.speed.toFixed(2)}</MonoCell> },
    { label: t('overview.table.position'), render: m => <MonoCell>{m.position.toFixed(1)}</MonoCell> },
    { label: t('overview.table.load'),     render: m => <MonoCell>{m.load != null ? m.load.toFixed(1) : '—'}</MonoCell> },
  ];

  return (
    <table className="w-full text-xs border-collapse">
      <thead>
        <tr className="border-b border-border">
          <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground w-24 border-r border-border"></th>
          {machines.map(m => (
            <th key={m.name} className="px-2 py-1.5 font-bold text-foreground text-center border-r border-border last:border-r-0 whitespace-pre-line text-[10px]">
              {m.name.replace(' ', '\n')}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(({ label, render }) => (
          <tr key={label} className="border-b border-border last:border-0">
            <td className="px-2 py-1 text-muted-foreground font-medium border-r border-border text-[10px]">{label}</td>
            {machines.map(m => (
              <td key={m.name} className="px-2 py-1 text-center border-r border-border last:border-0">
                {render(m)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

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

function MonoCell({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block font-mono bg-muted border border-border px-1.5 py-0.5 rounded text-foreground text-[10px] min-w-10 text-center">
      {children}
    </span>
  );
}
