import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@crane/core/lib/theme-context';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Play, FolderOpen, Download, ZoomIn, ZoomOut } from 'lucide-react';
import { getCmmsMockData } from '../../model/mock-data';

export function CmmsTrend() {
  const { craneId = '' } = useParams<{ craneId: string }>();
  const { t } = useTranslation('cmms');
  const data = getCmmsMockData(craneId).trend;

  const [selectedGroup1, setSelectedGroup1] = useState('main-hoist');
  const [selectedGroup2, setSelectedGroup2] = useState('trolley');
  const [activePens1, setActivePens1] = useState<number[]>([1, 2, 3, 4]);
  const [activePens2, setActivePens2] = useState<number[]>([1, 2, 3]);

  function togglePen(set: number[], pen: number, setter: (v: number[]) => void) {
    setter(set.includes(pen) ? set.filter((p) => p !== pen) : [...set, pen]);
  }

  return (
    <div className="h-full flex flex-col gap-3 p-4 bg-background text-foreground overflow-auto">
      {/* 상단 버튼 바 */}
      <div className="flex items-center gap-2 shrink-0">
        <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-emerald-600 hover:bg-emerald-500 text-white">
          <Play className="w-3 h-3" />
          {t('trend.realtime')}
        </button>
        <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-muted hover:bg-muted/80 text-foreground border border-border">
          <FolderOpen className="w-3 h-3" />
          {t('trend.openFile')}
        </button>
        <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-muted hover:bg-muted/80 text-foreground border border-border">
          <Download className="w-3 h-3" />
          {t('trend.exportTrend1')}
        </button>
        <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-muted hover:bg-muted/80 text-foreground border border-border">
          <Download className="w-3 h-3" />
          {t('trend.exportTrend2')}
        </button>
      </div>

      {/* TREND 1 / TREND 2 */}
      <div className="flex-1 grid grid-cols-2 gap-3 min-h-0">
        <TrendPanel
          title={t('trend.trend1')}
          groups={data.groups}
          selectedGroup={selectedGroup1}
          onGroupSelect={setSelectedGroup1}
          pens={data.pens}
          activePens={activePens1}
          onTogglePen={(pen) => togglePen(activePens1, pen, setActivePens1)}
          chartData={data.chartData}
          accent="text-orange-500 dark:text-orange-400"
          accentBar="bg-orange-500"
        />
        <TrendPanel
          title={t('trend.trend2')}
          groups={data.groups}
          selectedGroup={selectedGroup2}
          onGroupSelect={setSelectedGroup2}
          pens={data.pens}
          activePens={activePens2}
          onTogglePen={(pen) => togglePen(activePens2, pen, setActivePens2)}
          chartData={data.chartData}
          accent="text-cyan-500 dark:text-cyan-400"
          accentBar="bg-cyan-500"
        />
      </div>

      {/* 하단 시간/줌 버튼 */}
      <div className="flex items-center gap-2 shrink-0 pt-1">
        {['1h', '30mins', '10mins', '1min'].map((label) => (
          <button key={label} className="px-3 py-1 text-xs rounded bg-muted hover:bg-muted/80 text-foreground border border-border">
            {label}
          </button>
        ))}
        <div className="flex items-center gap-1 ml-4">
          <button className="p-1 rounded bg-muted hover:bg-muted/80 text-foreground border border-border">
            <ZoomIn className="w-4 h-4" />
          </button>
          <button className="p-1 rounded bg-muted hover:bg-muted/80 text-foreground border border-border">
            <ZoomOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

interface PenInfo { index: number; color: string; label: string; value1: number; value2: number; }
interface GroupInfo { id: string; label: string; }
interface TrendPanelProps {
  title: string;
  groups: GroupInfo[];
  selectedGroup: string;
  onGroupSelect: (id: string) => void;
  pens: PenInfo[];
  activePens: number[];
  onTogglePen: (pen: number) => void;
  chartData: Record<string, unknown>[];
  accent: string;
  accentBar: string;
}

function TrendPanel({
  title, groups, selectedGroup, onGroupSelect,
  pens, activePens, onTogglePen, chartData, accent, accentBar,
}: TrendPanelProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const gridColor   = isDark ? '#3f3f46' : '#e4e4e7';
  const axisColor   = isDark ? '#52525b' : '#a1a1aa';
  const tickColor   = isDark ? '#71717a' : '#71717a';
  const tooltipBg   = isDark ? '#18181b' : '#ffffff';
  const tooltipBorder = isDark ? '#3f3f46' : '#e4e4e7';
  const tooltipLabel = isDark ? '#a1a1aa' : '#52525b';

  const activePenObjects = pens.filter((p) => activePens.includes(p.index));

  return (
    <div className="flex flex-col rounded border border-border bg-card overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-stretch border-b border-border shrink-0">
        <div className={`w-1 ${accentBar} shrink-0`} />
        <div className="flex-1 flex items-center justify-between px-3 py-1.5 bg-muted/60">
          <span className={`text-xs font-bold uppercase tracking-wider ${accent}`}>{title}</span>
          <div className="flex gap-1">
            {groups.map((g) => (
              <button
                key={g.id}
                onClick={() => onGroupSelect(g.id)}
                className={`px-2 py-0.5 text-[10px] rounded font-medium transition-colors ${
                  selectedGroup === g.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80 text-muted-foreground border border-border'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* PEN 테이블 */}
      <div className="shrink-0">
        <table className="w-full text-[10px] text-foreground">
          <thead>
            <tr className="border-b border-border bg-muted text-muted-foreground">
              <th className="text-left px-2 py-1 w-6"></th>
              <th className="text-left px-2 py-1 w-8">PEN</th>
              <th className="text-left px-2 py-1">Label</th>
              <th className="text-right px-2 py-1 w-16">Value 1</th>
              <th className="text-right px-2 py-1 w-16">Value 2</th>
            </tr>
          </thead>
          <tbody>
            {pens.map((pen) => {
              const active = activePens.includes(pen.index);
              return (
                <tr
                  key={pen.index}
                  onClick={() => onTogglePen(pen.index)}
                  className={`border-b border-border cursor-pointer hover:bg-muted/50 ${active ? '' : 'opacity-40'}`}
                >
                  <td className="px-2 py-0.5">
                    <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: pen.color }} />
                  </td>
                  <td className="px-2 py-0.5 font-mono text-foreground">#{pen.index}</td>
                  <td className="px-2 py-0.5 truncate max-w-0" style={{ color: pen.color }}>{pen.label}</td>
                  <td className="px-2 py-0.5 text-right font-mono text-foreground">{pen.value1}</td>
                  <td className="px-2 py-0.5 text-right font-mono text-foreground">{pen.value2}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 차트 */}
      <div className="flex-1 min-h-0 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis dataKey="time" tick={{ fill: tickColor, fontSize: 9 }} interval={9} stroke={axisColor} />
            <YAxis tick={{ fill: tickColor, fontSize: 9 }} stroke={axisColor} />
            <Tooltip
              contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, fontSize: 10 }}
              labelStyle={{ color: tooltipLabel }}
            />
            {activePenObjects.map((pen) => (
              <Line key={pen.index} type="monotone" dataKey={`pen${pen.index}`} stroke={pen.color} dot={false} strokeWidth={1.5} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
