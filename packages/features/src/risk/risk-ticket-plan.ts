import type { CraneAsset } from '@crane/domain/asset';
import type { InventoryItem } from '@crane/domain/inventory';
import type { RepairTicketDraft, PartsTicketDraft } from '../ticket';
import type { OpenRisk } from './compute-open-risks';

/**
 * 리스크 → 티켓 액션 계획.
 * - repair/parts: 프리필 드래프트로 즉시 생성 가능 (일괄 발행 대상)
 * - parts_form: 품목 데이터가 없어 자동 결정 불가 → 프리필 폼 딥링크 (부품 대기 수리)
 * - link: 이미 WO가 존재해 신규 티켓이 중복 → 원천 화면 딥링크 (긴급 수리, 기한 초과 점검)
 */
export type RiskTicketPlan =
  | { kind: 'repair'; draft: RepairTicketDraft }
  | { kind: 'parts'; draft: PartsTicketDraft }
  | { kind: 'parts_form'; path: string }
  | { kind: 'link'; path: string };

export interface TicketPlanContext {
  cranes: CraneAsset[];
  inventoryItems: InventoryItem[];
  /** 폼과 동일 규칙의 담당자 폴백 (getTechnicians 첫 인력 등) */
  defaultAssignee: string;
  /** 오늘 로컬 날짜 'YYYY-MM-DD' — 순수성 유지를 위해 호출부가 주입 */
  today: string;
}

/** 즉시 생성 가능하고 아직 발행되지 않은 리스크만 일괄 발행 대상 */
export function isBatchEligible(risk: OpenRisk): boolean {
  if (risk.ticketIssued) return false;
  return risk.source === 'inspection_finding' || risk.source === 'stock';
}

export function planTicketForRisk(risk: OpenRisk, ctx: TicketPlanContext): RiskTicketPlan {
  if (risk.source === 'inspection_finding') {
    return { kind: 'repair', draft: findingRepairDraft(risk, ctx) };
  }
  if (risk.source === 'stock') {
    const draft = stockPartsDraft(risk, ctx);
    return draft ? { kind: 'parts', draft } : { kind: 'link', path: risk.detailPath };
  }
  if (risk.source === 'repair' && risk.riskType === 'production') {
    // 부품 대기 수리 — 대기 품목이 데이터에 없어 사용자가 품목만 고르는 반자동 흐름
    const params = new URLSearchParams({ type: 'parts' });
    if (risk.craneId) params.set('craneId', risk.craneId);
    if (risk.woNumber) params.set('sourceWo', risk.woNumber);
    return { kind: 'parts_form', path: `/ticket/create?${params.toString()}` };
  }
  // 긴급 수리·기한 초과 점검: WO가 이미 존재 → 원천 화면에서 처리
  return { kind: 'link', path: risk.detailPath };
}

function findingRepairDraft(risk: OpenRisk, ctx: TicketPlanContext): RepairTicketDraft {
  const crane = ctx.cranes.find((c) => c.id === risk.craneId);
  return {
    craneId: risk.craneId ?? '',
    craneName: risk.assetName ?? crane?.name ?? '',
    siteId: crane?.siteId ?? '',
    siteName: crane?.siteName ?? '',
    // componentName은 소견 항목명(영문) — compute-open-risks의 항목 단위 매칭과 일치해야
    // 발행 직후 ticketIssued, 완료 후 해소 판정이 정확히 이 소견에 걸린다
    componentName: risk.title,
    failureType: 'mechanical',
    sourceType: 'inspection',
    sourceWoNumber: risk.woNumber,
    priority: risk.severity === 'critical' ? 'high' : 'normal',
    repairLevel: 'minor',
    failureDescription: risk.description ?? risk.title,
    performerType: 'internal',
    assignedTo: ctx.defaultAssignee,
    scheduledStart: ctx.today,
    scheduledEnd: ctx.today,
  };
}

function stockPartsDraft(risk: OpenRisk, ctx: TicketPlanContext): PartsTicketDraft | null {
  const inv = ctx.inventoryItems.find((i) => i.partId === risk.partId);
  if (!inv) return null;
  const crane = ctx.cranes.find((c) => inv.craneIds.includes(c.id)) ?? ctx.cranes[0];
  return {
    craneId: crane?.id ?? '',
    craneName: crane?.name ?? '',
    siteId: crane?.siteId ?? '',
    siteName: crane?.siteName ?? '',
    priority: inv.status === 'out_of_stock' ? 'urgent' : 'normal',
    requester: ctx.defaultAssignee,
    items: [
      {
        partId: inv.partId,
        partName: inv.partName,
        // 재주문점까지 채우는 수량 — 최소 1
        qty: Math.max(1, inv.reorderPoint - inv.availableQty),
        unitPrice: inv.unitPrice,
      },
    ],
  };
}
