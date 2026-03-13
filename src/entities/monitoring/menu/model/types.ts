import type { LucideIcon } from 'lucide-react';

export type MonitoringMenuKey =
  | 'realtime-monitoring'
  | 'operation-info'
  | 'operation-status'
  | 'event-log'
  | 'playback'
  | 'screen-editor';

export interface MonitoringMenuItem {
  key: MonitoringMenuKey;
  label: string;
  icon: LucideIcon;
}
