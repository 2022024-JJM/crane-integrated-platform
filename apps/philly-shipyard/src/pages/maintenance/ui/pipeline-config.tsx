import { Package, Inbox, Clock, Wrench, SearchCheck, CheckCircle2 } from 'lucide-react';
import type { RepairStatus } from '@crane/domain/maintenance';
import type { Tone } from '../../../shared/ui/tone';

/**
 * 보드/스테퍼는 3단계 매크로 파이프라인(접수→진행 중→완료)만 노출한다.
 * waiting_parts·re_inspection은 도메인 상태로는 유지하되(대시보드 KPI·캘린더 색상 소비처 보존)
 * UI에서는 '진행 중'의 세부 상태 칩으로만 표시한다.
 */
export type MacroStage = 'received' | 'in_progress' | 'completed';

export const MACRO_STAGES: MacroStage[] = ['received', 'in_progress', 'completed'];

/** 진행 중 매크로에 속하는 세부 상태 (표시 순서) */
export const SUB_STATES: RepairStatus[] = ['in_progress', 'waiting_parts', 're_inspection'];

export function macroOf(status: RepairStatus): MacroStage | null {
  if (status === 'on_hold') return null;
  if (status === 'waiting_parts' || status === 're_inspection') return 'in_progress';
  return status;
}

// 컬럼 크롬은 전부 뉴트럴 — 스테이지 식별은 도트 톤 하나로만.
export const COLUMN_CONFIG: Record<RepairStatus, { icon: React.ReactNode; tone: Tone }> = {
  received: { icon: <Inbox className="h-3.5 w-3.5" />, tone: 'neutral' },
  waiting_parts: { icon: <Package className="h-3.5 w-3.5" />, tone: 'warning' },
  in_progress: { icon: <Wrench className="h-3.5 w-3.5" />, tone: 'info' },
  re_inspection: { icon: <SearchCheck className="h-3.5 w-3.5" />, tone: 'info' },
  completed: { icon: <CheckCircle2 className="h-3.5 w-3.5" />, tone: 'positive' },
  on_hold: { icon: <Clock className="h-3.5 w-3.5" />, tone: 'neutral' },
};
