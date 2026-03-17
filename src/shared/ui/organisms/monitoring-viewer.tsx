import { Box } from "lucide-react"
import { Card, CardContent } from "@/shared/ui/molecules/card"

interface MonitoringViewerProps {
  regionId: string
}

export function MonitoringViewer({ regionId }: MonitoringViewerProps) {
  return (
    <Card className="flex h-full flex-col">
      <CardContent className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
        <Box className="size-12 stroke-1" />
        <div className="text-center">
          <p className="text-lg font-medium">3D 뷰어 영역</p>
          <p className="text-sm">{regionId} 구역 · 준비 중</p>
        </div>
      </CardContent>
    </Card>
  )
}
