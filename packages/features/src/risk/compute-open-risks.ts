import type { ChecklistItem, InspectionWO } from '@crane/domain/inspection';
import type { RepairWO } from '@crane/domain/maintenance';
import type { InventoryItem } from '@crane/domain/inventory';

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
 * 점검 fail 항목의 해소 여부 — 해당 점검을 원천으로 하는 완료된 수리 WO가 있고,
 * (a) WO의 componentName이 항목명과 일치하면 항목 단위 해소,
 * (b) componentName이 그 점검의 어떤 항목명과도 일치하지 않으면 WO 단위 폴백 해소로 본다.
 * (티켓 생성은 첫 fail 항목명만 프리필하고 사용자가 수정할 수 있어 (b)가 필요하다)
 */
function isFindingResolved(
  item: ChecklistItem,
  inspection: InspectionWO,
  completedLinkedRepairs: RepairWO[],
): boolean {
  if (completedLinkedRepairs.length === 0) return false;
  const itemNames = new Set(
    inspection.checklistItems.flatMap((c) => [c.itemName, c.itemName_ko]).filter(Boolean),
  );
  return completedLinkedRepairs.some((r) => {
    if (r.componentName === item.itemName) return true;
    if (item.itemName_ko && r.componentName === item.itemName_ko) return true;
    // WO 단위 폴백: componentName이 체크리스트 어느 항목과도 불일치 → 점검 전체를 해소로 간주
    return !itemNames.has(r.componentName) && !itemNames.has(r.componentName_ko ?? '');
  });
}

export function computeOpenRisks(input: {
  inspections: InspectionWO[];
  repairs: RepairWO[];
  inventoryItems: InventoryItem[];
}): { risks: OpenRisk[]; safety: OpenRisk[]; production: OpenRisk[] } {
  const { inspections, repairs, inventoryItems } = input;
  const safety: OpenRisk[] = [];
  const production: OpenRisk[] = [];

  // ── 안전 ① 미해소 점검 fail 소견 ──
  for (const wo of inspections) {
    const completedLinked = repairs.filter(
      (r) =>
        r.sourceType === 'inspection' &&
        r.sourceWoNumber === wo.woNumber &&
        r.status === 'completed',
    );
    for (const item of wo.checklistItems) {
      if (item.judgment !== 'fail' || !OPEN_ACTIONS.has(item.actionRequired)) continue;
      if (isFindingResolved(item, wo, completedLinked)) continue;
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
    });
  }

  const byPriority = (a: OpenRisk, b: OpenRisk) =>
    SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.date.localeCompare(a.date);
  safety.sort(byPriority);
  production.sort(byPriority);

  // 통합 목록은 안전 우선 (Konecranes: 안전 리스크가 최상단) — 각 그룹 내부는 심각도순
  return { risks: [...safety, ...production], safety, production };
}
