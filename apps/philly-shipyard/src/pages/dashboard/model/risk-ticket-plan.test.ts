import { describe, expect, it } from 'vitest';
import type { CraneAsset } from '@crane/domain/asset';
import type { InventoryItem } from '@crane/domain/inventory';
import type { OpenRisk, TicketPlanContext } from '@crane/features/risk';
import { isBatchEligible, planTicketForRisk } from '@crane/features/risk';

const CRANE = {
  id: 'crane-660t',
  name: '660T Goliath Crane',
  siteId: 'dock-4',
  siteName: 'Dock 4',
} as CraneAsset;

const INV = {
  id: 'inv-1',
  partId: 'p-1',
  partName: 'Fuse',
  unitPrice: 12,
  availableQty: 1,
  reorderPoint: 5,
  status: 'low',
  craneIds: ['crane-660t'],
} as InventoryItem;

const ctx: TicketPlanContext = {
  cranes: [CRANE],
  inventoryItems: [INV],
  defaultAssignee: '조범희',
  today: '2026-07-27',
};

function risk(partial: Partial<OpenRisk>): OpenRisk {
  return {
    id: 'r-1',
    riskType: 'safety',
    source: 'inspection_finding',
    title: 'Rope guide',
    severity: 'major',
    date: '2026-07-20',
    detailPath: '/inspection/insp-1',
    ...partial,
  } as OpenRisk;
}

describe('planTicketForRisk — 소스별 액션 매핑', () => {
  it('점검 fail 소견 → 프리필된 repair 드래프트', () => {
    const plan = planTicketForRisk(
      risk({
        craneId: 'crane-660t',
        assetName: '660T Goliath Crane',
        woNumber: 'INS-0001',
        description: 'Worn rope guide',
        severity: 'critical',
      }),
      ctx,
    );
    expect(plan.kind).toBe('repair');
    if (plan.kind !== 'repair') return;
    expect(plan.draft).toMatchObject({
      craneId: 'crane-660t',
      siteId: 'dock-4',
      componentName: 'Rope guide',
      sourceType: 'inspection',
      sourceWoNumber: 'INS-0001',
      priority: 'high', // critical → high
      failureDescription: 'Worn rope guide',
      assignedTo: '조범희',
      scheduledStart: '2026-07-27',
    });
  });

  it('critical이 아닌 소견은 priority=normal', () => {
    const plan = planTicketForRisk(risk({ severity: 'major' }), ctx);
    expect(plan.kind === 'repair' && plan.draft.priority).toBe('normal');
  });

  it('저재고 stock → 재주문점까지 채우는 parts 드래프트', () => {
    const plan = planTicketForRisk(
      risk({ riskType: 'production', source: 'stock', partId: 'p-1', title: 'Fuse' }),
      ctx,
    );
    expect(plan.kind).toBe('parts');
    if (plan.kind !== 'parts') return;
    expect(plan.draft.priority).toBe('normal');
    expect(plan.draft.craneId).toBe('crane-660t');
    expect(plan.draft.items).toEqual([
      { partId: 'p-1', partName: 'Fuse', qty: 4, unitPrice: 12 }, // 5 - 1
    ]);
  });

  it('품절 stock은 urgent, 수량은 최소 1', () => {
    const outCtx: TicketPlanContext = {
      ...ctx,
      inventoryItems: [{ ...INV, status: 'out_of_stock', availableQty: 9 } as InventoryItem],
    };
    const plan = planTicketForRisk(
      risk({ riskType: 'production', source: 'stock', partId: 'p-1' }),
      outCtx,
    );
    expect(plan.kind === 'parts' && plan.draft.priority).toBe('urgent');
    expect(plan.kind === 'parts' && plan.draft.items[0]!.qty).toBe(1);
  });

  it('인벤토리에 없는 stock 리스크는 원천 딥링크로 폴백한다', () => {
    const plan = planTicketForRisk(
      risk({ riskType: 'production', source: 'stock', partId: 'p-없음', detailPath: '/inventory?part=x' }),
      ctx,
    );
    expect(plan).toEqual({ kind: 'link', path: '/inventory?part=x' });
  });

  it('부품 대기 수리 → parts 프리필 폼 딥링크 (품목은 사용자가 선택)', () => {
    const plan = planTicketForRisk(
      risk({
        riskType: 'production',
        source: 'repair',
        craneId: 'crane-660t',
        woNumber: 'RO-0009',
        detailPath: '/maintenance?wo=rep-9',
      }),
      ctx,
    );
    expect(plan).toEqual({
      kind: 'parts_form',
      path: '/ticket/create?type=parts&craneId=crane-660t&sourceWo=RO-0009',
    });
  });

  it('긴급 수리·기한 초과 점검은 원천 딥링크 유지 — 신규 티켓은 중복', () => {
    const emergency = planTicketForRisk(
      risk({ source: 'repair', riskType: 'safety', detailPath: '/maintenance?wo=rep-1' }),
      ctx,
    );
    expect(emergency).toEqual({ kind: 'link', path: '/maintenance?wo=rep-1' });

    const overdue = planTicketForRisk(
      risk({ source: 'overdue_inspection', detailPath: '/inspection/insp-2' }),
      ctx,
    );
    expect(overdue).toEqual({ kind: 'link', path: '/inspection/insp-2' });
  });
});

describe('isBatchEligible — 일괄 발행 대상', () => {
  it('즉시 생성 가능한 소견/재고만 대상이고, 발행됨/링크성 리스크는 제외한다', () => {
    expect(isBatchEligible(risk({}))).toBe(true);
    expect(isBatchEligible(risk({ source: 'stock', riskType: 'production' }))).toBe(true);
    expect(isBatchEligible(risk({ ticketIssued: true }))).toBe(false);
    expect(isBatchEligible(risk({ source: 'repair' }))).toBe(false);
    expect(isBatchEligible(risk({ source: 'overdue_inspection' }))).toBe(false);
  });
});
