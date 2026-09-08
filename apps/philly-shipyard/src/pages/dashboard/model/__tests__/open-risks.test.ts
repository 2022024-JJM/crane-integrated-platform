import { describe, expect, it } from 'vitest';
import type { RepairWO } from '@crane/domain/maintenance';
import type { InspectionWO, ChecklistItem } from '@crane/domain/inspection';
import type { InventoryItem, PartsRequest } from '@crane/domain/inventory';
import { computeOpenRisks } from '@crane/features/risk';

// 계산이 읽는 필드만 채운 최소 목
function item(partial: Partial<ChecklistItem>): ChecklistItem {
  return {
    id: 'ci-1',
    itemName: 'Rope guide',
    judgment: 'fail',
    actionRequired: 'repair_needed',
    ...partial,
  } as ChecklistItem;
}

function inspection(partial: Partial<InspectionWO>): InspectionWO {
  return {
    id: 'insp-1',
    woNumber: 'INS-0001',
    craneId: 'crane-660t',
    craneName: '660T Goliath Crane',
    scheduledDate: '2026-07-01',
    actualDate: '2026-07-02',
    status: 'completed',
    checklistItems: [],
    ...partial,
  } as unknown as InspectionWO;
}

function repair(partial: Partial<RepairWO>): RepairWO {
  return {
    id: 'rep-1',
    craneId: 'crane-660t',
    craneName: '660T Goliath Crane',
    componentName: 'Rope guide',
    status: 'completed',
    priority: 'normal',
    sourceType: 'inspection',
    sourceWoNumber: 'INS-0001',
    scheduledStart: '2026-07-03',
    ...partial,
  } as RepairWO;
}

const NO_STOCK: InventoryItem[] = [];

describe('computeOpenRisks — 점검 소견', () => {
  it('연결된 수리가 없는 fail 항목은 열린 안전 리스크다', () => {
    const { safety } = computeOpenRisks({
      inspections: [inspection({ checklistItems: [item({})] })],
      repairs: [],
      inventoryItems: NO_STOCK,
    });
    expect(safety).toHaveLength(1);
    expect(safety[0]!.source).toBe('inspection_finding');
    expect(safety[0]!.detailPath).toBe('/inspection/insp-1');
  });

  it('actionRequired가 none/monitor인 fail 항목은 제외한다', () => {
    const { safety } = computeOpenRisks({
      inspections: [
        inspection({ checklistItems: [item({ actionRequired: 'monitor' })] }),
      ],
      repairs: [],
      inventoryItems: NO_STOCK,
    });
    expect(safety).toHaveLength(0);
  });

  it('componentName === itemName인 완료 수리는 해당 항목만 해소한다', () => {
    const { safety } = computeOpenRisks({
      inspections: [
        inspection({
          checklistItems: [
            item({ id: 'ci-1', itemName: 'Rope guide' }),
            item({ id: 'ci-2', itemName: 'Latch' }),
          ],
        }),
      ],
      repairs: [repair({ componentName: 'Rope guide' })],
      inventoryItems: NO_STOCK,
    });
    expect(safety).toHaveLength(1);
    expect(safety[0]!.title).toBe('Latch');
  });

  it('componentName이 어떤 항목명과도 불일치하면 WO 단위 폴백으로 점검 전체를 해소한다', () => {
    const { safety } = computeOpenRisks({
      inspections: [
        inspection({
          checklistItems: [item({ id: 'ci-1' }), item({ id: 'ci-2', itemName: 'Latch' })],
        }),
      ],
      repairs: [repair({ componentName: 'SINAMICS DCM Drive (Hoist)' })],
      inventoryItems: NO_STOCK,
    });
    expect(safety).toHaveLength(0);
  });

  it('미완료 수리는 소견을 해소하지 않는다', () => {
    const { safety } = computeOpenRisks({
      inspections: [inspection({ checklistItems: [item({})] })],
      repairs: [repair({ status: 'in_progress' })],
      inventoryItems: NO_STOCK,
    });
    expect(safety).toHaveLength(1);
  });

  it('stop_operation 항목은 critical로 우선 정렬된다', () => {
    const { safety } = computeOpenRisks({
      inspections: [
        inspection({
          checklistItems: [
            item({ id: 'ci-1', severity: 'minor' }),
            item({ id: 'ci-2', itemName: 'Brake', actionRequired: 'stop_operation' }),
          ],
        }),
      ],
      repairs: [],
      inventoryItems: NO_STOCK,
    });
    expect(safety[0]!.title).toBe('Brake');
    expect(safety[0]!.severity).toBe('critical');
  });
});

describe('computeOpenRisks — 수리/재고', () => {
  it('긴급이면서 부품 대기인 WO는 안전으로 1회만 집계한다', () => {
    const { safety, production } = computeOpenRisks({
      inspections: [],
      repairs: [
        repair({
          id: 'rep-9',
          priority: 'emergency',
          status: 'waiting_parts',
          sourceType: 'breakdown',
          sourceWoNumber: undefined,
        }),
      ],
      inventoryItems: NO_STOCK,
    });
    expect(safety).toHaveLength(1);
    expect(production).toHaveLength(0);
  });

  it('완료된 긴급 수리는 리스크가 아니다', () => {
    const { safety } = computeOpenRisks({
      inspections: [],
      repairs: [
        repair({ priority: 'emergency', status: 'completed', sourceType: 'breakdown', sourceWoNumber: undefined }),
      ],
      inventoryItems: NO_STOCK,
    });
    expect(safety).toHaveLength(0);
  });

  it('품절은 critical, 저재고는 criticality에 따라 major/minor 생산 리스크다', () => {
    const stock = (p: Partial<InventoryItem>): InventoryItem =>
      ({
        id: 'inv-1',
        partId: 'p-1',
        partName: 'Fuse',
        status: 'low',
        criticality: 'normal',
        lastIssueDate: '2026-07-01',
        ...p,
      }) as InventoryItem;

    const { production } = computeOpenRisks({
      inspections: [],
      repairs: [],
      inventoryItems: [
        stock({ id: 'inv-1', partId: 'p-1', status: 'out_of_stock' }),
        stock({ id: 'inv-2', partId: 'p-2', criticality: 'critical' }),
      ],
    });
    expect(production.map((r) => r.severity)).toEqual(['critical', 'major']);
    expect(production[0]!.detailPath).toBe('/inventory?part=p-1');
  });
});

describe('computeOpenRisks — ticketIssued (중복 발행 방지)', () => {
  const partsRequest = (p: Partial<PartsRequest>): PartsRequest =>
    ({
      id: 'pr-1',
      status: 'pending',
      items: [],
      ...p,
    }) as PartsRequest;

  it('미완료 연결 수리가 항목과 일치하면 리스크는 열린 채 ticketIssued=true다', () => {
    const { safety } = computeOpenRisks({
      inspections: [inspection({ checklistItems: [item({})] })],
      repairs: [repair({ status: 'in_progress', componentName: 'Rope guide' })],
      inventoryItems: NO_STOCK,
    });
    expect(safety).toHaveLength(1);
    expect(safety[0]!.ticketIssued).toBe(true);
  });

  it('미완료 연결 수리가 다른 항목명이면 그 항목은 미발행이다', () => {
    const { safety } = computeOpenRisks({
      inspections: [
        inspection({
          checklistItems: [
            item({ id: 'ci-1', itemName: 'Rope guide' }),
            item({ id: 'ci-2', itemName: 'Latch' }),
          ],
        }),
      ],
      repairs: [repair({ status: 'in_progress', componentName: 'Rope guide' })],
      inventoryItems: NO_STOCK,
    });
    const latch = safety.find((r) => r.title === 'Latch');
    expect(latch!.ticketIssued).toBe(false);
  });

  it('동일 partId의 비취소 부품 요청이 있으면 stock 리스크는 ticketIssued=true다', () => {
    const stockItem = {
      id: 'inv-1',
      partId: 'p-1',
      partName: 'Fuse',
      status: 'low',
      criticality: 'critical',
      lastIssueDate: '2026-07-01',
    } as InventoryItem;

    const issued = computeOpenRisks({
      inspections: [],
      repairs: [],
      inventoryItems: [stockItem],
      partsRequests: [partsRequest({ items: [{ partId: 'p-1', partName: 'Fuse', qty: 2, unitPrice: 10 }] })],
    });
    expect(issued.production[0]!.ticketIssued).toBe(true);

    const cancelled = computeOpenRisks({
      inspections: [],
      repairs: [],
      inventoryItems: [stockItem],
      partsRequests: [
        partsRequest({ status: 'cancelled', items: [{ partId: 'p-1', partName: 'Fuse', qty: 2, unitPrice: 10 }] }),
      ],
    });
    expect(cancelled.production[0]!.ticketIssued).toBe(false);
  });

  it('sourceWoNumber가 일치하는 부품 요청이 있으면 부품 대기 수리는 ticketIssued=true다', () => {
    const { production } = computeOpenRisks({
      inspections: [],
      repairs: [
        repair({
          woNumber: 'RO-0009',
          status: 'waiting_parts',
          sourceType: 'breakdown',
          sourceWoNumber: undefined,
        }),
      ],
      inventoryItems: NO_STOCK,
      partsRequests: [partsRequest({ sourceWoNumber: 'RO-0009' })],
    });
    expect(production).toHaveLength(1);
    expect(production[0]!.ticketIssued).toBe(true);
  });
});
