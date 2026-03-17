import { Badge } from "@/shared/ui/atoms/badge"
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
  "운행": "bg-green-500/15 text-green-600 dark:text-green-400",
  "대기": "bg-gray-500/15 text-gray-600 dark:text-gray-400",
  "점검": "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  "경고": "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  "정지": "bg-red-500/15 text-red-600 dark:text-red-400",
}

export function CraneStatusTable({ cranes }: CraneStatusTableProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-4 py-2">
        <h3 className="text-sm font-medium">크레인 실시간 상태</h3>
      </div>
      <ScrollArea className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>크레인명</TableHead>
              <TableHead>상태</TableHead>
              <TableHead className="text-right">하중(t)</TableHead>
              <TableHead className="text-right">풍속(m/s)</TableHead>
              <TableHead className="text-right">붐각도(°)</TableHead>
              <TableHead className="text-right">호이스트(m)</TableHead>
              <TableHead className="text-right">선회각도(°)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cranes.map((crane) => (
                <TableRow key={crane.id}>
                  <TableCell className="font-medium">{crane.name}</TableCell>
                  <TableCell>
                    <Badge className={statusStyle[crane.status]}>
                      {crane.status}
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
