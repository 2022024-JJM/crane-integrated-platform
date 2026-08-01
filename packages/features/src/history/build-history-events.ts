import { getAllInspectionWOs } from '@crane/domain/inspection';
import type {
  InspectionResult,
  InspectionStatus,
  InspectionType,
} from '@crane/domain/inspection';
import { getAllRepairWOs } from '@crane/domain/maintenance';
import type { RepairPriority, RepairStatus } from '@crane/domain/maintenance';
import { getAllPartsRequests } from '@crane/domain/inventory';
import type {
  PartsRequestPriority,
  PartsRequestStatus,
} from '@crane/domain/inventory';

export type HistoryEventKind = 'inspection' | 'repair' | 'parts_request';

export interface HistoryEventPart {
  partId: string;
  partName: string;
  qty: number;
  unitCost: number;
}

interface HistoryEventBase {
  /** React key — `${kind}:${id}` */
  key: string;
  /** 원본 엔티티 id (상세 링크용) */
  id: string;
  /** woNumber | requestNumber */
  refNumber: string;
  /** 'YYYY-MM-DD' — 표시·기간 필터용 */
  date: string;
  /**
   * 'YYYY-MM-DD' 또는 'YYYY-MM-DDTHH:mm:ss' (로컬, TZ 없음).
   * zero-pad 문자열이므로 사전순 비교 = 시간순 비교 — Date 파싱 금지 (UTC off-by-one).
   */
  sortKey: string;
  craneId: string;
  craneName: string;
  siteId: string;
  siteName: string;
  /** findings | failureDescription | note — ko 매핑 적용, 없으면 '' */
  description: string;
  /** repair.partsUsed / request.items (unitPrice → unitCost) — inspection은 [] */
  parts: HistoryEventPart[];
  totalCost: number | null;
  /** 상세 페이지 경로 — parts request는 상세가 없어 null */
  href: string | null;
}

export type HistoryEvent =
  | (HistoryEventBase & {
      kind: 'inspection';
      status: InspectionStatus;
      result: InspectionResult;
      woType: InspectionType;
    })
  | (HistoryEventBase & {
      kind: 'repair';
      status: RepairStatus;
      priority: RepairPriority;
      componentName: string;
    })
  | (HistoryEventBase & {
      kind: 'parts_request';
      status: PartsRequestStatus;
      priority: PartsRequestPriority;
      requester: string;
    });

/**
 * 점검·수리·부품요청을 크레인 단위(옵션)로 합쳐 최신순 이벤트 목록으로 빌드.
 * InventoryTransaction은 craneId가 없어 소스로 쓰지 않는다 —
 * 부품 사용은 RepairWO.partsUsed, 부품 요청은 PartsRequest(craneId 보유)로 커버.
 */
export function buildHistoryEvents(opts: {
  craneId?: string;
  isKo: boolean;
  /**
   * 미시작 점검(예정·기한 초과)도 포함할지. 전역 이력 페이지는 "발생한 활동"만 보므로
   * 기본 제외. 자산 상세의 단일 이력 탭은 그 크레인의 미결 점검도 봐야 하므로 true로 켠다.
   */
  includeUpcoming?: boolean;
}): HistoryEvent[] {
  const { craneId, isKo, includeUpcoming = false } = opts;
  const events: HistoryEvent[] = [];

  for (const wo of getAllInspectionWOs()) {
    if (craneId && wo.craneId !== craneId) continue;
    // 이력은 "발생한 활동"의 기록 — 시작도 안 한 점검(예정·기한 초과)은
    // 점검 목록·캘린더의 몫이므로 기본 제외 (내용·비용이 비어 행이 무의미).
    // 단 자산 상세는 미결 점검이 액션 아이템이라 includeUpcoming으로 허용한다.
    if (!includeUpcoming && (wo.status === 'scheduled' || wo.status === 'overdue')) continue;
    const sortKey = wo.actualDate ?? wo.scheduledDate;
    events.push({
      kind: 'inspection',
      key: `inspection:${wo.id}`,
      id: wo.id,
      refNumber: wo.woNumber,
      date: sortKey.slice(0, 10),
      sortKey,
      craneId: wo.craneId,
      craneName: wo.craneName,
      siteId: wo.siteId,
      siteName: wo.siteName,
      description: (isKo ? (wo.findings_ko ?? wo.findings) : wo.findings) ?? '',
      parts: [],
      totalCost: wo.cost ?? null,
      href: `/inspection/${wo.id}`,
      status: wo.status,
      result: wo.result,
      woType: wo.woType,
    });
  }

  for (const wo of getAllRepairWOs()) {
    if (craneId && wo.craneId !== craneId) continue;
    const sortKey = wo.actualEnd ?? wo.actualStart ?? wo.scheduledStart;
    events.push({
      kind: 'repair',
      key: `repair:${wo.id}`,
      id: wo.id,
      refNumber: wo.woNumber,
      date: sortKey.slice(0, 10),
      sortKey,
      craneId: wo.craneId,
      craneName: wo.craneName,
      siteId: wo.siteId,
      siteName: wo.siteName,
      description: isKo
        ? (wo.failureDescription_ko ?? wo.failureDescription)
        : wo.failureDescription,
      parts: wo.partsUsed.map((p) => ({
        partId: p.partId,
        partName: p.partName,
        qty: p.qty,
        unitCost: p.unitCost,
      })),
      totalCost: wo.totalCost,
      href: `/maintenance/${wo.id}`,
      status: wo.status,
      priority: wo.priority,
      componentName: isKo
        ? (wo.componentName_ko ?? wo.componentName)
        : wo.componentName,
    });
  }

  for (const req of getAllPartsRequests()) {
    if (craneId && req.craneId !== craneId) continue;
    events.push({
      kind: 'parts_request',
      key: `parts_request:${req.id}`,
      id: req.id,
      refNumber: req.requestNumber,
      date: req.requestDate,
      sortKey: req.requestDate,
      craneId: req.craneId,
      craneName: req.craneName,
      siteId: req.siteId,
      siteName: req.siteName,
      description: req.note ?? '',
      parts: req.items.map((i) => ({
        partId: i.partId,
        partName: i.partName,
        qty: i.qty,
        unitCost: i.unitPrice,
      })),
      totalCost: req.items.reduce((sum, i) => sum + i.qty * i.unitPrice, 0),
      href: null,
      status: req.status,
      priority: req.priority,
      requester: req.requester,
    });
  }

  return events.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
}
