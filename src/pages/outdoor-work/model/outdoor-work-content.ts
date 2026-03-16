import {
  OUTDOOR_OPERATION_INFO_TABLE,
  OUTDOOR_OPERATION_STATUS_TABLE,
  OUTDOOR_REALTIME_MONITORING_TABLE,
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

export const OUTDOOR_WORK_MENU_TITLE = '1도크';

export const OUTDOOR_WORK_MENU_ITEMS = [
  { key: 'realtime-monitoring', label: '실시간 감시', icon: Monitor },
  { key: 'operation-info', label: '운행 정보', icon: Info },
  { key: 'operation-status', label: '운행 현황', icon: Activity },
  { key: 'event-log', label: '이벤트 로그', icon: FileText },
  { key: 'playback', label: '다시 보기', icon: Clock3 },
  { key: 'screen-editor', label: '화면 편집', icon: PencilLine },
] satisfies readonly MonitoringMenuItem[];

export const OUTDOOR_WORK_BOTTOM_PANEL_TABLE_MAP: Record<
  MonitoringMenuKey,
  MonitoringStatusTableData<unknown>
> = {
  'event-log': OUTDOOR_REALTIME_MONITORING_TABLE,
  'operation-info': OUTDOOR_OPERATION_INFO_TABLE,
  'operation-status': OUTDOOR_OPERATION_STATUS_TABLE,
  playback: OUTDOOR_REALTIME_MONITORING_TABLE,
  'realtime-monitoring': OUTDOOR_REALTIME_MONITORING_TABLE,
  'screen-editor': OUTDOOR_REALTIME_MONITORING_TABLE,
};

export const OUTDOOR_WORK_VIEWER_SUBTITLE_MAP: Record<
  MonitoringMenuKey,
  string
> = {
  'realtime-monitoring': '',
  'operation-info': '운행 정보 · 장비 위치 · 작업 구간',
  'operation-status': '운행 현황 · 장비 상태 · 이벤트 흐름',
  'event-log': '이벤트 로그 · 최근 발생 이력',
  playback: '다시 보기 · 과거 시점 재생',
  'screen-editor': '화면 편집 · 배치 및 패널 구성',
};

export const OUTDOOR_WORK_LOWER_PANEL_TITLE_MAP: Record<
  MonitoringMenuKey,
  string
> = {
  'realtime-monitoring': '실시간 장비 상태 테이블',
  'operation-info': '장비 운행 정보',
  'operation-status': '운행 상태 이력',
  'event-log': '이벤트 로그 목록',
  playback: '재생 구간 요약',
  'screen-editor': '패널 배치 정보',
};
