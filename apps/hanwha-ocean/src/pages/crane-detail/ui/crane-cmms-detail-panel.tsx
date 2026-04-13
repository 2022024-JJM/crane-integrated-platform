import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { getCmmsMockData } from '../model/mock-data';
import { CmmsOverviewInline } from './cmms/cmms-overview-inline';
import { CmmsHoistInline } from './cmms/cmms-hoist-inline';
import { CmmsTrolleyInline } from './cmms/cmms-trolley-inline';
import { RunFaultBadge } from '@crane/ui/molecules/cmms-status-badge';
import { ScrollArea } from '@crane/ui/molecules/scroll-area';
import { ToggleGroup, ToggleGroupItem } from '@crane/ui/molecules/toggle-group';
import { Button } from '@crane/ui/atoms/button';

type CmmsTab = 'overview' | 'hoist' | 'trolley';

interface CraneCmmsDetailPanelProps {
  craneId: string;
  craneName: string;
  onClose: () => void;
}

export function CraneCmmsDetailPanel({ craneId, craneName, onClose }: CraneCmmsDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<CmmsTab>('overview');
  const { t } = useTranslation('cmms');

  const overview = getCmmsMockData(craneId).overview;
  const hoist1RunFault = getCmmsMockData(craneId).hoist.hoist1.runFault;
  const windSpeed = overview.wind.speed;
  const totalLoad = overview.load.totalLoad;
  const eStopOk = (Object.values(overview.eStop) as string[]).every((v) => v === 'OK');

  const handleTabChange = (val: string[]) => {
    if (val.length > 0) setActiveTab(val[0] as CmmsTab);
  };

  return (
    <div className="h-full flex flex-col bg-card border-l border-border overflow-hidden">
      {/* ── 헤더 (고정) ── */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/40">
        {/* 크레인 이름 */}
        <span className="text-sm font-bold text-sky-400 truncate max-w-22.5">{craneName}</span>

        {/* 운전 상태 */}
        <RunFaultBadge value={hoist1RunFault} />

        {/* KPI 인라인 */}
        <div className="flex items-center gap-2 ml-auto text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span>풍속</span>
            <span className={`font-mono font-bold ${windSpeed > 10 ? 'text-amber-400' : 'text-foreground'}`}>
              {windSpeed.toFixed(1)}
            </span>
          </span>
          <span className="flex items-center gap-1">
            <span>하중</span>
            <span className="font-mono font-bold text-foreground">{totalLoad.toFixed(0)}t</span>
          </span>
          <span className="flex items-center gap-1" title="E-STOP">
            <span className={`size-2 rounded-full shrink-0 ${eStopOk ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`} />
            <span className={eStopOk ? 'text-emerald-400' : 'text-red-400'}>E-STOP</span>
          </span>
        </div>

        {/* 닫기 버튼 */}
        <Button variant="ghost" size="icon" className="size-6 shrink-0" onClick={onClose}>
          <X className="size-3.5" />
        </Button>
      </div>

      {/* ── 탭 바 (고정) ── */}
      <div className="shrink-0 px-2 py-1.5 border-b border-border bg-muted/20">
        <ToggleGroup
          value={[activeTab]}
          onValueChange={handleTabChange}
          className="w-full bg-muted rounded-md border border-border"
        >
          <ToggleGroupItem
            value="overview"
            className="flex-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground hover:text-foreground aria-pressed:bg-background aria-pressed:text-sky-400 aria-pressed:shadow-sm py-1"
          >
            {t('overview.title')}
          </ToggleGroupItem>
          <ToggleGroupItem
            value="hoist"
            className="flex-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground hover:text-foreground aria-pressed:bg-background aria-pressed:text-sky-400 aria-pressed:shadow-sm py-1"
          >
            {t('hoist.title')}
          </ToggleGroupItem>
          <ToggleGroupItem
            value="trolley"
            className="flex-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground hover:text-foreground aria-pressed:bg-background aria-pressed:text-sky-400 aria-pressed:shadow-sm py-1"
          >
            {t('trolley.title')}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* ── 탭 콘텐츠 (스크롤) ── */}
      <ScrollArea className="flex-1 min-h-0">
        {activeTab === 'overview' && <CmmsOverviewInline craneId={craneId} />}
        {activeTab === 'hoist'    && <CmmsHoistInline    craneId={craneId} />}
        {activeTab === 'trolley'  && <CmmsTrolleyInline  craneId={craneId} />}
      </ScrollArea>
    </div>
  );
}
