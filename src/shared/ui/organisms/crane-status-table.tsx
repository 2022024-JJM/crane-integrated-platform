import { Badge } from "@/shared/ui/atoms/badge"
import { useTranslation } from "react-i18next"
import { ScrollArea } from "@/shared/ui/molecules/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/molecules/table"
import type { CraneOperationalData, CraneStatus } from "@/entities/crane"

interface CraneStatusTableProps {
  cranes: CraneOperationalData[]
}

const statusStyle: Record<CraneStatus, string> = {
  operating: "bg-green-500/15 text-green-600 dark:text-green-400",
  idle: "bg-gray-500/15 text-gray-600 dark:text-gray-400",
  maintenance: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  warning: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  stopped: "bg-red-500/15 text-red-600 dark:text-red-400",
}

export function CraneStatusTable({ cranes }: CraneStatusTableProps) {
  const { t } = useTranslation()

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-4 py-2">
        <h3 className="text-sm font-medium">{t("common:craneStatus.title")}</h3>
      </div>
      <ScrollArea className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common:craneStatus.name")}</TableHead>
              <TableHead>{t("common:craneStatus.status")}</TableHead>
              <TableHead className="text-right">{t("common:craneStatus.load")}</TableHead>
              <TableHead className="text-right">{t("common:craneStatus.windSpeed")}</TableHead>
              <TableHead className="text-right">{t("common:craneStatus.boomAngle")}</TableHead>
              <TableHead className="text-right">{t("common:craneStatus.hoistHeight")}</TableHead>
              <TableHead className="text-right">{t("common:craneStatus.slewAngle")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cranes.map((crane) => (
                <TableRow key={crane.id}>
                  <TableCell className="font-medium">{crane.name}</TableCell>
                  <TableCell>
                    <Badge className={statusStyle[crane.status]}>
                      {t(`common:craneStatus.${crane.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {crane.load}/{crane.maxLoad}
                  </TableCell>
                  <TableCell className="text-right">{crane.windSpeed}</TableCell>
                  <TableCell className="text-right">{crane.boomAngle}</TableCell>
                  <TableCell className="text-right">{crane.hoistHeight}</TableCell>
                  <TableCell className="text-right">{crane.slewAngle}</TableCell>
                </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  )
}
