import type { Key, ReactNode } from 'react';

export interface MonitoringStatusColumn<Row> {
  id: string;
  header: string;
  headerClassName?: string;
  cellClassName?: string | ((row: Row) => string | undefined);
  renderCell(row: Row): ReactNode;
}

export interface MonitoringStatusTableData<Row> {
  columns: readonly MonitoringStatusColumn<Row>[];
  rows: readonly Row[];
  getRowKey(row: Row): Key;
}

export interface MonitoringStatusTableProps<Row> {
  table: MonitoringStatusTableData<Row>;
  className?: string;
}

export function createMonitoringStatusTable<Row>(
  table: MonitoringStatusTableData<Row>,
): MonitoringStatusTableData<unknown> {
  return table as unknown as MonitoringStatusTableData<unknown>;
}
