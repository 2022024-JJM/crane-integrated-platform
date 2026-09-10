import type { Region } from '@crane/domain/region';
import type {
  AlarmJournalEntry,
  DailyAlarmPoint,
  DailyCountPoint,
} from '@crane/domain/journal';
import type { SceneCollisionRuntimePhase } from '@crane/features/3d';

export type DashboardMetricId =
  | 'detection'
  | 'todayCollisions'
  | 'activeAlarms'
  | 'dataSource';

export interface DashboardMetricCard {
  id: DashboardMetricId;
  titleKey: string;
  descriptionKey: string;
  value: number | string;
  format: 'number' | 'translation';
  tone: 'default' | 'success' | 'warning' | 'danger';
  href?: string;
  metaKey?: string;
  metaValues?: Record<string, string | number>;
}

export interface DashboardRegionStatusDatum {
  regionId: Region['id'];
  navigateTo: Region['navigateTo'];
  titleKey: string;
  /** 씬 배치 기준 장비(모델) 수. 씬 로드 전·실패면 null. */
  equipmentCount: number | null;
}

/** 충돌 journal 항목의 표시용 파생 — region 표기·이동 링크를 붙인 것. */
export interface DashboardCollisionRow {
  key: string;
  at: number;
  equipA: string;
  equipB: string;
  /** journal 의 regionId 를 못 찾으면(에디터 씬 등) null. */
  regionTitleKey: string | null;
  navigateTo: string | null;
}

export interface DashboardDetectionStatus {
  enabled: boolean;
  phase: SceneCollisionRuntimePhase;
  pauseOnCollision: boolean;
}

export interface DashboardDataSourceStatus {
  simulationRunning: boolean;
  realtimeRunning: boolean;
  realtimeHeld: boolean;
}

export interface DashboardActiveAlarmStats {
  critical: number;
  high: number;
  medium: number;
  info: number;
  total: number;
}

/** 씬 tagMappings 기반 장비별 라이브 태그 목록. 값은 UI 가 폴링으로 읽는다. */
export interface DashboardEquipmentTag {
  tagKey: string;
  /** 가상 태그 카탈로그 표시명. 정의가 없으면 tagKey 그대로. */
  label: string;
  unit: string | null;
}

export interface DashboardEquipmentRow {
  modelId: string;
  equipName: string;
  regionTitleKey: string;
  tags: DashboardEquipmentTag[];
}

export interface DashboardSummary {
  metrics: DashboardMetricCard[];
  /** 최근 7일 일별 충돌 건수(journal, 빈 날 0). */
  collisionTrend: DailyCountPoint[];
  /** 최근 7일 일별 알람 건수(journal, 심각도 분해). */
  alarmTrend: DailyAlarmPoint[];
  todayCollisionCount: number;
  weekCollisionTotal: number;
  weekAlarmTotal: number;
  weekCriticalTotal: number;
  regionStatuses: DashboardRegionStatusDatum[];
  recentCollisions: DashboardCollisionRow[];
  recentAlarms: AlarmJournalEntry[];
}
