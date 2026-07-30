import { Package, Inbox, Clock, Wrench, SearchCheck, CheckCircle2 } from 'lucide-react';
import type { RepairStatus } from '@crane/domain/maintenance';
import type { Tone } from '../../../shared/ui/tone';
import { REPAIR_STATUS_TONE } from '../../../shared/ui/status-variants';

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

// 아이콘만 여기서 정의하고 톤은 status-variants의 단일 소스를 참조한다 —
// 같은 상태가 보드 도트·상태 배지·이력 화면에서 서로 다른 색으로 어긋나지 않게.
const COLUMN_ICON: Record<RepairStatus, React.ReactNode> = {
  received: <Inbox className="h-3.5 w-3.5" />,
  waiting_parts: <Package className="h-3.5 w-3.5" />,
  in_progress: <Wrench className="h-3.5 w-3.5" />,
  re_inspection: <SearchCheck className="h-3.5 w-3.5" />,
  completed: <CheckCircle2 className="h-3.5 w-3.5" />,
  on_hold: <Clock className="h-3.5 w-3.5" />,
};

export const COLUMN_CONFIG = Object.fromEntries(
  (Object.keys(COLUMN_ICON) as RepairStatus[]).map((s) => [
    s,
    { icon: COLUMN_ICON[s], tone: REPAIR_STATUS_TONE[s] },
  ]),
) as Record<RepairStatus, { icon: React.ReactNode; tone: Tone }>;
