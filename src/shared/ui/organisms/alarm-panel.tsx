import { Separator } from "@/shared/ui/atoms/separator";
import type { Alarm, AlarmStatistics } from "@/entities/alarm";
import { AlarmStats } from "./alarm-stats";
import { AlarmHistory } from "./alarm-history";

interface AlarmPanelProps {
  stats: AlarmStatistics;
  alarms: Alarm[];
}

export function AlarmPanel({ stats, alarms }: AlarmPanelProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-4 py-2">
        <h3 className="text-sm font-medium">알람 현황</h3>
      </div>
      <AlarmStats stats={stats} />
      <Separator />
      <div className="border-b px-3 py-2">
        <h4 className="text-xs font-medium text-muted-foreground">알람 이력</h4>
      </div>
      <AlarmHistory alarms={alarms} />
    </div>
  );
}
