import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getCmmsMockData } from '../../model/mock-data';
import { RunFaultBadge, OkNgBadge, OnOffBadge } from '@crane/ui/molecules/cmms-status-badge';
import type { CmmsOverviewMachineRow } from '../../model/types';

export function CmmsOverview() {
  const { craneId = '' } = useParams<{ craneId: string }>();
  const { t } = useTranslation('cmms');
  const data = getCmmsMockData(craneId).overview;

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
            <CraneSvg />
          </div>

          {/* ── 하단 요약 테이블 ── */}
          <div className="shrink-0 border-t border-border overflow-x-auto bg-card">
            <MachineTable machines={data.machines} t={t} />
          </div>
        </div>

        {/* ── 우측 패널 ── */}
        <div className="w-64 shrink-0 flex flex-col border-l border-border bg-card overflow-y-auto">

          {/* WIND */}
          <SideSection title={t('overview.wind.title')}>
            <ValueRow label={t('overview.wind.speed')}   value={data.wind.speed.toFixed(1)} />
            <ValueRow label={t('overview.wind.direction')} value={data.wind.direction} />
            <BadgeRow label={t('overview.wind.highWindWarning')} badge={<OnOffBadge value={data.wind.highWindWarning} />} />
            <BadgeRow label={t('overview.wind.highWindTrip')}    badge={<OnOffBadge value={data.wind.highWindTrip} />} />
          </SideSection>

          {/* LOAD */}
          <SideSection title={t('overview.load.title')}>
            <ValueRow label={t('overview.load.totalLoad')}  value={data.load.totalLoad.toFixed(1)} />
            <ValueRow label={t('overview.load.h1h2Diff')}   value={data.load.h1h2Diff.toFixed(1)} />
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
              <BadgeRow label={t('overview.load.totalOverloadWarning')} badge={<OnOffBadge value={data.load.totalOverloadWarning} />} />
              <BadgeRow label={t('overview.load.totalOverloadTrip')}    badge={<OnOffBadge value={data.load.totalOverloadTrip} />} />
            </div>
          </SideSection>

          {/* E-STOP */}
          <SideSection title={t('overview.eStop.title')} flex>
            {(Object.keys(data.eStop) as (keyof typeof data.eStop)[]).map((key) => (
              <div key={key} className="flex items-center gap-2 py-0.5">
                <OkNgBadge value={data.eStop[key]} />
                <span className="text-xs text-foreground">{t(`overview.eStop.${key}`)}</span>
              </div>
            ))}
          </SideSection>
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

/* ── 우측 패널 섹션 ── */
function SideSection({ title, children, flex }: { title: string; children: ReactNode; flex?: boolean }) {
  return (
    <div className={`border-b border-border overflow-hidden ${flex ? 'flex-1 flex flex-col' : ''}`}>
      <div className="flex items-stretch border-b border-border shrink-0">
        <div className="w-1 bg-sky-500 shrink-0" />
        <div className="flex-1 px-3 py-1.5 bg-muted/60">
          <span className="text-[11px] font-bold uppercase tracking-widest text-sky-500 dark:text-sky-400">{title}</span>
        </div>
      </div>
      <div className={`px-3 py-2 space-y-0.5 ${flex ? 'flex-1 overflow-y-auto' : ''}`}>{children}</div>
    </div>
  );
}

/* ── 값 행 ── */
function ValueRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-border last:border-0">
      <span className="text-xs text-foreground">{label}</span>
      <span className="text-xs font-mono bg-muted border border-border px-2 py-0.5 rounded text-foreground min-w-14 text-right">
        {value}
      </span>
    </div>
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

/* ── 단일 배지 행 ── */
function BadgeRow({ label, badge }: { label: string; badge: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1 border-b border-border last:border-0">
      <span className="text-xs text-foreground shrink-0">{label}</span>
      {badge}
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
