import {
  OPERATION_INFO_TABLE,
  OPERATION_STATUS_TABLE,
  REALTIME_MONITORING_TABLE,
  type MonitoringStatusTableData,
} from '@/entities/monitoring/crane-status';
import {
  type MonitoringMenuItem,
  type MonitoringMenuKey,
} from '@/entities/monitoring/menu';
import {
  Activity,
  Clock3,
  FileText,
  Info,
  Monitor,
  PencilLine,
} from 'lucide-react';

export const INDOOR_WORK_MENU_TITLE = '내업';

export const INDOOR_WORK_MENU_ITEMS = [
  { key: 'realtime-monitoring', label: '실시간 감시', icon: Monitor },
  { key: 'operation-info', label: '운행 정보', icon: Info },
  { key: 'operation-status', label: '운행 현황', icon: Activity },
  { key: 'event-log', label: '이벤트 로그', icon: FileText },
  { key: 'playback', label: '다시 보기', icon: Clock3 },
  { key: 'screen-editor', label: '화면 편집', icon: PencilLine },
] satisfies readonly MonitoringMenuItem[];

export const INDOOR_WORK_BOTTOM_PANEL_TABLE_MAP: Record<
  MonitoringMenuKey,
  MonitoringStatusTableData<unknown>
> = {
  'event-log': REALTIME_MONITORING_TABLE,
  'operation-info': OPERATION_INFO_TABLE,
  'operation-status': OPERATION_STATUS_TABLE,
  playback: REALTIME_MONITORING_TABLE,
  'realtime-monitoring': REALTIME_MONITORING_TABLE,
  'screen-editor': REALTIME_MONITORING_TABLE,
};
