import {
  Activity,
  Clock3,
  FileText,
  Info,
  Monitor,
  PencilLine,
} from 'lucide-react';
import type { MonitoringMenuItem } from './types';

export const INDOOR_WORK_MENU_TITLE = '내업';

export const INDOOR_WORK_MENU_ITEMS = [
  { key: 'realtime-monitoring', label: '실시간 감시', icon: Monitor },
  { key: 'operation-info', label: '운행 정보', icon: Info },
  { key: 'operation-status', label: '운행 현황', icon: Activity },
  { key: 'event-log', label: '이벤트 로그', icon: FileText },
  { key: 'playback', label: '다시 보기', icon: Clock3 },
  { key: 'screen-editor', label: '화면 편집', icon: PencilLine },
] satisfies readonly MonitoringMenuItem[];
