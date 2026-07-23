import type { AssetStatus, ComponentStatus } from '@crane/domain/asset';
import type { InspectionStatus } from '@crane/domain/inspection';
import type { RepairPriority, RepairStatus } from '@crane/domain/maintenance';
import type {
  InventoryStatus,
  PartCriticality,
  PartsRequestStatus,
} from '@crane/domain/inventory';
import type { CertStatus } from '@crane/domain/compliance';
import type { Tone } from './tone';

/**
 * 도메인 상태 → Badge variant / StatusDot / Tone 단일 매핑.
 * 페이지·캘린더가 각자 재정의하며 어긋나던 것을 한 곳으로 모은다.
 */

export type BadgeVariant = 'success' | 'warning' | 'destructive' | 'secondary';
export type DotStatus = 'normal' | 'warning' | 'critical';

// ── 자산 ──
export const ASSET_STATUS_VARIANT: Record<AssetStatus, BadgeVariant> = {
  operating: 'success',
  inspection: 'warning',
  repair: 'destructive',
  idle: 'secondary',
  decommissioned: 'secondary',
};

export const ASSET_STATUS_DOT: Record<AssetStatus, DotStatus> = {
  operating: 'normal',
  inspection: 'warning',
  repair: 'critical',
  idle: 'warning',
  decommissioned: 'critical',
};

export const ASSET_STATUS_TONE: Record<AssetStatus, Tone> = {
  operating: 'positive',
  inspection: 'warning',
  repair: 'critical',
  idle: 'neutral',
  decommissioned: 'neutral',
};

// ── 구성품 ──
export const COMPONENT_STATUS_VARIANT: Record<ComponentStatus, BadgeVariant> = {
  normal: 'success',
  caution: 'warning',
  warning: 'warning',
  critical: 'destructive',
  replace: 'destructive',
};

export const COMPONENT_STATUS_DOT: Record<ComponentStatus, DotStatus> = {
  normal: 'normal',
  caution: 'warning',
  warning: 'warning',
  critical: 'critical',
  replace: 'critical',
};

// ── 점검 ──
export const INSPECTION_STATUS_VARIANT: Record<InspectionStatus, BadgeVariant> = {
  scheduled: 'secondary',
  in_progress: 'warning',
  completed: 'success',
  overdue: 'destructive',
  cancelled: 'secondary',
};

export const INSPECTION_RESULT_VARIANT: Record<'pass' | 'fail' | 'conditional', BadgeVariant> = {
  pass: 'success',
  fail: 'destructive',
  conditional: 'warning',
};

export const INSPECTION_STATUS_TONE: Record<InspectionStatus, Tone> = {
  scheduled: 'neutral',
  in_progress: 'warning',
  completed: 'positive',
  overdue: 'critical',
  cancelled: 'neutral',
};

// ── 수리 ──
export const REPAIR_PRIORITY_VARIANT: Record<RepairPriority, BadgeVariant> = {
  emergency: 'destructive',
  high: 'warning',
  normal: 'secondary',
  low: 'secondary',
};

export const REPAIR_STATUS_VARIANT: Record<RepairStatus, BadgeVariant> = {
  received: 'secondary',
  waiting_parts: 'destructive',
  in_progress: 'warning',
  re_inspection: 'warning',
  completed: 'success',
  on_hold: 'secondary',
};

export const REPAIR_STATUS_TONE: Record<RepairStatus, Tone> = {
  received: 'neutral',
  waiting_parts: 'critical',
  in_progress: 'warning',
  re_inspection: 'warning',
  completed: 'positive',
  on_hold: 'neutral',
};

// ── 부품 요청 ──
export const PARTS_REQUEST_STATUS_VARIANT: Record<PartsRequestStatus, BadgeVariant> = {
  pending: 'warning',
  approved: 'success',
  ordered: 'secondary',
  cancelled: 'secondary',
};

export const PARTS_REQUEST_STATUS_TONE: Record<PartsRequestStatus, Tone> = {
  pending: 'warning',
  approved: 'positive',
  ordered: 'info',
  cancelled: 'neutral',
};

// ── 재고 ──
export const INVENTORY_STATUS_VARIANT: Record<InventoryStatus, BadgeVariant> = {
  normal: 'success',
  low: 'warning',
  out_of_stock: 'destructive',
  excess: 'secondary',
  expiry_soon: 'warning',
};

export const CRITICALITY_VARIANT: Record<PartCriticality, BadgeVariant> = {
  critical: 'destructive',
  essential: 'warning',
  standard: 'secondary',
};

export const INVENTORY_STATUS_TONE: Record<InventoryStatus, Tone> = {
  normal: 'positive',
  low: 'warning',
  out_of_stock: 'critical',
  excess: 'neutral',
  expiry_soon: 'warning',
};

export const CRITICALITY_TONE: Record<PartCriticality, Tone> = {
  critical: 'critical',
  essential: 'warning',
  standard: 'neutral',
};

// ── 규제 ──
export const CERT_STATUS_VARIANT: Record<CertStatus, BadgeVariant> = {
  valid: 'success',
  expiry_soon: 'warning',
  expired: 'destructive',
  renewing: 'secondary',
};

// ── 티켓 우선순위 → 톤 (null = 무색, 기본 primary 스타일) ──
export type TicketPriority = 'emergency' | 'urgent' | 'high' | 'normal' | 'low' | 'scheduled';

export const PRIORITY_TONE: Record<TicketPriority, Tone | null> = {
  emergency: 'critical',
  urgent: 'critical',
  high: 'warning',
  normal: null,
  low: 'neutral',
  scheduled: 'info',
};
