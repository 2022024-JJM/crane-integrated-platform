import { AlertTriangle, AlertCircle, Info } from "lucide-react"
import type { AlarmStatistics } from "@/entities/alarm"

interface AlarmStatsProps {
  stats: AlarmStatistics
}

export function AlarmStats({ stats }: AlarmStatsProps) {
  return (
    <div className="grid grid-cols-3 gap-2 p-3">
      <div className="flex flex-col items-center gap-1 rounded-lg bg-destructive/10 p-2">
        <AlertTriangle className="size-4 text-destructive" />
        <span className="text-lg font-bold text-destructive">{stats.critical}</span>
        <span className="text-[10px] text-muted-foreground">위험</span>
      </div>
      <div className="flex flex-col items-center gap-1 rounded-lg bg-amber-500/10 p-2">
        <AlertCircle className="size-4 text-amber-500" />
        <span className="text-lg font-bold text-amber-500">{stats.warning}</span>
        <span className="text-[10px] text-muted-foreground">경고</span>
      </div>
      <div className="flex flex-col items-center gap-1 rounded-lg bg-blue-500/10 p-2">
        <Info className="size-4 text-blue-500" />
        <span className="text-lg font-bold text-blue-500">{stats.info}</span>
        <span className="text-[10px] text-muted-foreground">정보</span>
      </div>
    </div>
  )
}
