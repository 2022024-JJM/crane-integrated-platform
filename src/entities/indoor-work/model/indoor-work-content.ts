import type {
  IndoorAlarmRow,
  IndoorCraneRow,
  IndoorInfoCard,
  IndoorInfoRow,
  IndoorStatCard,
  IndoorStatusCard,
  IndoorStatusRow,
} from '@/entities/indoor-work/model/types';
import type { MonitoringMenuKey } from '@/entities/monitoring/menu/model/types';

export const INDOOR_WORK_TEXT = {
  alarmTitle: '알람 내역',
  live: '온라인',
  sidebarTitle: '내업',
  statsTitle: '알람 통계',
  topDescription: '창고 · 실내 설비 3D 모니터링',
  topTag: '실내 작업 모니터링',
  viewerTitle: '3D CRANE VIEW',
} as const;

export const INDOOR_WORK_VIEWER_SUBTITLE_MAP: Record<
  MonitoringMenuKey,
  string
> = {
  'event-log': '이벤트 로그 · 최근 발생 이력',
  'operation-info': '운행 정보 · 설비 위치 · 작업 구간',
  'operation-status': '운행 현황 · 장비 상태 · 이벤트 흐름',
  playback: '다시 보기 · 과거 시점 재생',
  'realtime-monitoring': '',
  'screen-editor': '화면 편집 · 배치 및 패널 구성',
};

export const INDOOR_WORK_LOWER_PANEL_TITLE_MAP: Record<
  MonitoringMenuKey,
  string
> = {
  'event-log': '이벤트 로그 목록',
  'operation-info': '장비 운행 정보',
  'operation-status': '운행 상태 이력',
  playback: '재생 구간 요약',
  'realtime-monitoring': '실시간 장비 상태 테이블',
  'screen-editor': '패널 배치 정보',
};

export const INDOOR_WORK_STAT_CARDS = [
  { label: '# Alarms', value: '2', tone: 'danger' },
  { label: 'Elapsed Time', value: '3 min', tone: 'neutral' },
  { label: '# Occurrence', value: '1', tone: 'ok' },
  { label: 'Abnormal', value: '2', tone: 'danger' },
  { label: 'Danger', value: '1', tone: 'danger' },
  { label: 'Normal', value: '0', tone: 'ok' },
] satisfies readonly IndoorStatCard[];

export const INDOOR_WORK_ALARM_ROWS = [
  ['88', 'Normal', '2019-01-23 14:55', 'BL-01', '1'],
  ['87', 'Warning', '2019-01-23 14:48', 'BL-03', '2'],
  ['86', 'Warning', '2019-01-23 14:40', 'OHC-11', '3'],
  ['85', 'Critical', '2019-01-23 14:31', 'OHC-07', '1'],
  ['84', 'Normal', '2019-01-23 14:22', 'BL-05', '2'],
  ['83', 'Warning', '2019-01-23 14:15', 'OHC-02', '1'],
] satisfies readonly IndoorAlarmRow[];

export const INDOOR_WORK_CRANE_ROWS = [
  [
    'OHC-01',
    true,
    true,
    false,
    false,
    false,
    false,
    '12.5',
    '',
    '18.4',
    '22.1',
    '',
    '34.2',
    '',
    '112.3',
    '8.2',
  ],
  [
    'OHC-02',
    true,
    true,
    false,
    false,
    false,
    false,
    '30.1',
    '',
    '22',
    '',
    '',
    '58.7',
    '',
    '230.1',
    '5.5',
  ],
  [
    'OHC-07',
    true,
    true,
    true,
    false,
    false,
    false,
    '',
    '95.3',
    '35',
    '',
    '42.1',
    '',
    '95.3',
    '415.9',
    '-0.3',
  ],
  [
    'OHC-11',
    true,
    true,
    false,
    false,
    false,
    false,
    '',
    '72',
    '28.5',
    '',
    '19.8',
    '',
    '72',
    '508.4',
    '3.8',
  ],
  [
    'OHC-14',
    true,
    true,
    false,
    false,
    true,
    false,
    '',
    '210.5',
    '0',
    '',
    '8.3',
    '',
    '210.5',
    '0',
    '0',
  ],
  [
    'BL-01',
    true,
    true,
    false,
    false,
    false,
    false,
    '5.8',
    '22.1',
    '14.2',
    '10.5',
    '',
    '22.1',
    '',
    '178.6',
    '12.1',
  ],
  [
    'BL-03',
    true,
    true,
    false,
    false,
    false,
    false,
    '',
    '140.3',
    '16',
    '',
    '30.7',
    '',
    '140.3',
    '320.5',
    '0',
  ],
] satisfies readonly IndoorCraneRow[];

export const INDOOR_WORK_OPERATION_INFO_CARDS = [
  ['도크명', '1도크 / Indoor Storage'],
  ['활성 장비', 'OHC 4기, Bay Lift 2기'],
  ['현재 작업', '창고 반입 · 베이 이송'],
  ['작업 구간', '1Bay ~ 3Bay / 조립 5공장'],
] satisfies readonly IndoorInfoCard[];

export const INDOOR_WORK_OPERATION_INFO_ROWS = [
  ['OHC-01', 'Overhead Crane', '3Bay', '정상', '반입 적재', '동측'],
  ['OHC-07', 'Overhead Crane', '1Bay', '주의', '라인 이송', '중앙'],
  ['BL-01', 'Bay Lift', '2Bay', '정상', '자재 이동', '서측'],
  ['BL-03', 'Bay Lift', '1Bay', '정상', '적재 완료', '남측'],
] satisfies readonly IndoorInfoRow[];

export const INDOOR_WORK_OPERATION_STATUS_CARDS = [
  ['총 운행 장비', '9', 'neutral'],
  ['정상 장비', '6', 'ok'],
  ['주의 장비', '2', 'danger'],
  ['점검 장비', '1', 'danger'],
] satisfies readonly IndoorStatusCard[];

export const INDOOR_WORK_OPERATION_STATUS_ROWS = [
  ['09:05', 'OHC-01', '횡행 이동 시작', '정상', '3Bay 상단'],
  ['09:12', 'OHC-07', '권상 속도 편차', '주의', '1Bay 중앙'],
  ['09:16', 'BL-01', '베이간 이송 완료', '정상', '2Bay'],
  ['09:19', 'OHC-14', '점검 모드 전환', '점검', '3Bay 후면'],
  ['09:22', 'BL-03', '자재 반입 대기', '정상', '1Bay'],
] satisfies readonly IndoorStatusRow[];

export const INDOOR_WORK_OPERATION_INFO_NOTES = [
  '1Bay 반입 라인 우선순위 상향',
  'OHC-14는 점검 모드 유지',
  'BL-01 자재 이송 사이클 정상',
  '3Bay 상부 센서 응답 0.6s',
] as const;

export const INDOOR_WORK_OPERATION_STATUS_SUMMARY = [
  '정상 장비 비율 66%',
  '주의 레벨 2건 유지',
  '점검 장비 1건 대응 중',
  '평균 베이 이송 응답 0.74s',
] as const;
