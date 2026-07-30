import type { ChecklistItem, InspectionWO } from '@crane/domain/inspection';
import type { RepairWO } from '@crane/domain/maintenance';
import type { InventoryItem, PartsRequest } from '@crane/domain/inventory';

export type RiskType = 'safety' | 'production';

export type RiskSource =
  | 'inspection_finding'
  | 'repair'
  | 'stock'
  | 'overdue_inspection';

export type RiskSeverity = 'critical' | 'major' | 'minor';

/**
 * 오픈 리스크 한 건 — Konecranes 원칙("리스크가 식별됐고 수리가 완료되지 않았다면
 * 그 결함은 열린 상태")에 따라 소견/WO/재고 단위로 집계된다.
 */
export interface OpenRisk {
  id: string;
  riskType: RiskType;
  source: RiskSource;
  title: string;
  title_ko?: string;
  description?: string;
  description_ko?: string;
  craneId?: string;
  assetName?: string;
  severity: RiskSeverity;
  /** 정렬용 로컬 날짜 (YYYY-MM-DD...) */
  date: string;
  detailPath: string;
  /** 원천 WO 번호 — 소견은 점검 WO, repair 리스크는 수리 WO (티켓 프리필/연결용) */
  woNumber?: string;
  /** stock 리스크의 부품 id (parts 티켓 프리필용) */
  partId?: string;
  /** 이 리스크에 대한 티켓(수리 WO/부품 요청)이 이미 발행되어 진행 중인지 — 중복 발행 방지용 */
  ticketIssued?: boolean;
}

const OPEN_ACTIONS = new Set(['repair_needed', 'immediate_replace', 'stop_operation']);

const SEVERITY_RANK: Record<RiskSeverity, number> = { critical: 0, major: 1, minor: 2 };

function findingSeverity(item: ChecklistItem): RiskSeverity {
  if (item.actionRequired === 'stop_operation' || item.actionRequired === 'immediate_replace') {
    return 'critical';
  }
  if (item.severity === 'critical') return 'critical';
  if (item.severity === 'major') return 'major';
  return 'minor';
}

/**
 * 연결 수리 WO가 특정 점검 항목을 다루는지 —
 * (a) WO의 componentName이 항목명과 일치하면 항목 단위 매칭,
 * (b) componentName이 그 점검의 어떤 항목명과도 일치하지 않으면 WO 단위 폴백 매칭으로 본다.
 * (티켓 생성은 첫 fail 항목명만 프리필하고 사용자가 수정할 수 있어 (b)가 필요하다)
 * 완료된 WO에 적용하면 해소 판정, 미완료 WO에 적용하면 "티켓 이미 발행" 판정이 된다.
 */
function repairMatchesItem(
  item: ChecklistItem,
  itemNames: Set<string | undefined>,
  repair: RepairWO,
): boolean {
  if (repair.componentName === item.itemName) return true;
  if (item.itemName_ko && repair.componentName === item.itemName_ko) return true;
  // WO 단위 폴백: componentName이 체크리스트 어느 항목과도 불일치 → 점검 전체 대상으로 간주
  return !itemNames.has(repair.componentName) && !itemNames.has(repair.componentName_ko ?? '');
}

function checklistItemNames(inspection: InspectionWO): Set<string | undefined> {
  return new Set(
    inspection.checklistItems.flatMap((c) => [c.itemName, c.itemName_ko]).filter(Boolean),
  );
}

export function computeOpenRisks(input: {
  inspections: InspectionWO[];
  repairs: RepairWO[];
  inventoryItems: InventoryItem[];
  /** 발행 여부(ticketIssued) 판정용 — 생략 시 stock/waiting_parts 리스크는 항상 미발행으로 본다 */
  partsRequests?: PartsRequest[];
}): { risks: OpenRisk[]; safety: OpenRisk[]; production: OpenRisk[] } {
  const { inspections, repairs, inventoryItems, partsRequests = [] } = input;
  const safety: OpenRisk[] = [];
  const production: OpenRisk[] = [];
  const activeRequests = partsRequests.filter((pr) => pr.status !== 'cancelled');

  // ── 안전 ① 미해소 점검 fail 소견 ──
  for (const wo of inspections) {
    const linked = repairs.filter(
      (r) => r.sourceType === 'inspection' && r.sourceWoNumber === wo.woNumber,
    );
    const completedLinked = linked.filter((r) => r.status === 'completed');
    const openLinked = linked.filter((r) => r.status !== 'completed');
    const itemNames = checklistItemNames(wo);
    for (const item of wo.checklistItems) {
      if (item.judgment !== 'fail' || !OPEN_ACTIONS.has(item.actionRequired)) continue;
      if (completedLinked.some((r) => repairMatchesItem(item, itemNames, r))) continue;
      safety.push({
        id: `finding-${wo.id}-${item.id}`,
        riskType: 'safety',
        source: 'inspection_finding',
        title: item.itemName,
        title_ko: item.itemName_ko,
        description: item.comment,
        craneId: wo.craneId,
        assetName: wo.craneName,
        severity: findingSeverity(item),
        date: wo.actualDate ?? wo.scheduledDate,
        detailPath: `/inspection/${wo.id}`,
        woNumber: wo.woNumber,
        ticketIssued: openLinked.some((r) => repairMatchesItem(item, itemNames, r)),
      });
    }
  }

  // ── 안전 ② 미완료 긴급 수리 ──
  const emergencyIds = new Set<string>();
  for (const r of repairs) {
    if (r.priority !== 'emergency' || r.status === 'completed') continue;
    emergencyIds.add(r.id);
    safety.push({
      id: `repair-${r.id}`,
      riskType: 'safety',
      source: 'repair',
      title: r.componentName,
      title_ko: r.componentName_ko,
      description: r.failureDescription,
      description_ko: r.failureDescription_ko,
      craneId: r.craneId,
      assetName: r.craneName,
      severity: 'critical',
      date: r.scheduledStart,
      detailPath: `/maintenance?wo=${r.id}`,
      woNumber: r.woNumber,
    });
  }

  // ── 안전 ③ 기한 초과 점검 ──
  for (const wo of inspections) {
    if (wo.status !== 'overdue') continue;
    safety.push({
      id: `overdue-${wo.id}`,
      riskType: 'safety',
      source: 'overdue_inspection',
      title: wo.woNumber,
      craneId: wo.craneId,
      assetName: wo.craneName,
      severity: 'major',
      date: wo.scheduledDate,
      detailPath: `/inspection/${wo.id}`,
    });
  }

  // ── 생산 ① 부품 대기 수리 (긴급으로 이미 집계된 WO는 제외) ──
  for (const r of repairs) {
    if (r.status !== 'waiting_parts' || emergencyIds.has(r.id)) continue;
    production.push({
      id: `repair-${r.id}`,
      riskType: 'production',
      source: 'repair',
      title: r.componentName,
      title_ko: r.componentName_ko,
      description: r.failureDescription,
      description_ko: r.failureDescription_ko,
      craneId: r.craneId,
      assetName: r.craneName,
      severity: 'major',
      date: r.scheduledStart,
      detailPath: `/maintenance?wo=${r.id}`,
      woNumber: r.woNumber,
      ticketIssued: activeRequests.some((pr) => pr.sourceWoNumber === r.woNumber),
    });
  }

  // ── 생산 ② 저재고/품절 ──
  for (const i of inventoryItems) {
    if (i.status !== 'low' && i.status !== 'out_of_stock') continue;
    production.push({
      id: `stock-${i.id}`,
      riskType: 'production',
      source: 'stock',
      title: i.partName,
      title_ko: i.partName_ko,
      severity:
        i.status === 'out_of_stock'
          ? 'critical'
          : i.criticality === 'critical'
            ? 'major'
            : 'minor',
      date: i.lastIssueDate,
      detailPath: `/inventory?part=${encodeURIComponent(i.partId)}`,
      partId: i.partId,
      ticketIssued: activeRequests.some((pr) =>
        pr.items.some((it) => it.partId === i.partId),
      ),
    });
  }

  const byPriority = (a: OpenRisk, b: OpenRisk) =>
    SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.date.localeCompare(a.date);
  safety.sort(byPriority);
  production.sort(byPriority);

  // 통합 목록은 안전 우선 (Konecranes: 안전 리스크가 최상단) — 각 그룹 내부는 심각도순
  return { risks: [...safety, ...production], safety, production };
}
