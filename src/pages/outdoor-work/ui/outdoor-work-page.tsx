import { useParams, Navigate } from "react-router-dom"
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/shared/ui/molecules/resizable"
import { getCranesByRegion } from "@/entities/crane"
import { getAlarmsByRegion, getAlarmStatsByRegion } from "@/entities/alarm"
import { MonitoringViewer } from "@/shared/ui/organisms/monitoring-viewer"
import { CraneStatusTable } from "@/shared/ui/organisms/crane-status-table"
import { AlarmPanel } from "@/shared/ui/organisms/alarm-panel"

function ThreeDMonitoringView({ regionId }: { regionId: string }) {
  const cranes = getCranesByRegion(regionId)
  const alarms = getAlarmsByRegion(regionId)
  const alarmStats = getAlarmStatsByRegion(regionId)

  return (
    <ResizablePanelGroup orientation="horizontal" className="h-full">
      <ResizablePanel defaultSize={75} minSize={50}>
        <ResizablePanelGroup orientation="vertical">
          <ResizablePanel defaultSize={60}>
            <MonitoringViewer regionId={regionId} />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={40}>
            <CraneStatusTable cranes={cranes} />
          </ResizablePanel>
        </ResizablePanelGroup>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={25} minSize={15}>
        <AlarmPanel stats={alarmStats} alarms={alarms} />
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}

function PlaceholderView({ title }: { title: string }) {
  return (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      <p className="text-lg">{title} — 준비 중</p>
    </div>
  )
}

export function OutdoorWorkPage() {
  const { regionId, "*": subRoute } = useParams<{
    regionId: string
    "*": string
  }>()

  if (!regionId) return null

  if (!subRoute) {
    return <Navigate to={`/outdoor-work/${regionId}/3d-monitoring`} replace />
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] w-full">
      {subRoute === "3d-monitoring" && (
        <ThreeDMonitoringView regionId={regionId} />
      )}
      {subRoute === "crane-status" && (
        <PlaceholderView title="크레인 상태 목록" />
      )}
      {subRoute === "work-history" && (
        <PlaceholderView title="작업 이력" />
      )}
    </div>
  )
}
