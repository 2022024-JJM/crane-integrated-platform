import type { MonitoringStatusTableProps } from '@/entities/monitoring/crane-status/model/types';
import {
  monitoringStatusTableCellClass,
  monitoringStatusTableHeadClass,
} from '@/entities/monitoring/crane-status/lib/monitoring-status-table-styles';
import { cn } from '@/shared/lib/utils';

function getCellClassName<Row>(
  cellClassName: string | ((row: Row) => string | undefined) | undefined,
  row: Row,
) {
  if (typeof cellClassName === 'function') {
    return cellClassName(row);
  }

  return cellClassName;
}

export function MonitoringStatusTable<Row>({
  table,
  className,
}: MonitoringStatusTableProps<Row>) {
  return (
    <table className={cn('w-full border-collapse', className)}>
      <thead>
        <tr>
          {table.columns.map((column) => (
            <th
              key={column.id}
              className={cn(
                monitoringStatusTableHeadClass,
                column.headerClassName,
              )}
            >
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {table.rows.map((row) => (
          <tr key={table.getRowKey(row)}>
            {table.columns.map((column) => (
              <td
                key={column.id}
                className={cn(
                  monitoringStatusTableCellClass,
                  getCellClassName(column.cellClassName, row),
                )}
              >
                {column.renderCell(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
