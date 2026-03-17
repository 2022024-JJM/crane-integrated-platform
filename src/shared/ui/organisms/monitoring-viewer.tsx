import { Box } from "lucide-react"
import { useTranslation } from "react-i18next"
import { getRegionById } from "@/entities/region"
import { getRegionTitleKey } from "@/shared/lib/region-presentation"
import { Card, CardContent } from "@/shared/ui/molecules/card"

interface MonitoringViewerProps {
  regionId: string
}

export function MonitoringViewer({ regionId }: MonitoringViewerProps) {
  const { t } = useTranslation()
  const region = getRegionById(regionId)

  return (
    <Card className="flex h-full flex-col">
      <CardContent className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
        <Box className="size-12 stroke-1" />
        <div className="text-center">
          <p className="text-lg font-medium">{t("outdoor-work:monitoringTitle")}</p>
          <p className="text-sm">
            {t("outdoor-work:monitoringSubtitle", {
              region: region ? t(getRegionTitleKey(region.id)) : regionId,
            })}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
