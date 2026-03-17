import { AlertTriangle, AlertCircle, Info } from "lucide-react"
import { ScrollArea } from "@/shared/ui/molecules/scroll-area"
import type { Alarm, AlarmSeverity } from "@/entities/alarm"

interface AlarmHistoryProps {
  alarms: Alarm[]
}

const severityIcon: Record<AlarmSeverity, { icon: typeof AlertTriangle; className: string }> = {
  critical: { icon: AlertTriangle, className: "text-destructive" },
  warning: { icon: AlertCircle, className: "text-amber-500" },
  info: { icon: Info, className: "text-blue-500" },
}

function formatTime(timestamp: string) {
  const date = new Date(timestamp)
  return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
}

export function AlarmHistory({ alarms }: AlarmHistoryProps) {
  return (
    <ScrollArea className="flex-1 overflow-auto">
      <div className="flex flex-col gap-1 p-3">
        {alarms.map((alarm) => {
          const sv = severityIcon[alarm.severity]
          const Icon = sv.icon
          return (
            <div
              key={alarm.id}
              className="flex items-start gap-2 rounded-md border p-2 text-xs"
            >
              <Icon className={`mt-0.5 size-3.5 shrink-0 ${sv.className}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-medium">{alarm.craneName}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {formatTime(alarm.timestamp)}
                  </span>
                </div>
                <p className="mt-0.5 text-muted-foreground">{alarm.message}</p>
              </div>
            </div>
          )
        })}
      </div>
    </ScrollArea>
  )
}
