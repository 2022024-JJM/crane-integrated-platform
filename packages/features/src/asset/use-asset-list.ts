import { useTranslation } from 'react-i18next';
import {
  getAllCraneAssets,
  getAssetSummary,
  getComponentsByCraneId,
  getCraneAssetById,
} from '@crane/domain/asset';
import type { CraneComponent, ComponentStatus } from '@crane/domain/asset';
import { getAllInspectionWOs } from '@crane/domain/inspection';
import type { InspectionWO } from '@crane/domain/inspection';
import { getAllRepairWOs } from '@crane/domain/maintenance';
import type { RepairWO } from '@crane/domain/maintenance';
import { useEntityTicks } from '../shared/use-domain-event-store';

const ACTIVE_REPAIR_STATUSES = new Set(['received', 'waiting_parts', 'in_progress', 're_inspection']);

const STATUS_SEVERITY: Record<ComponentStatus, number> = {
  normal: 0,
  caution: 1,
  warning: 2,
  critical: 3,
  replace: 4,
};

export interface AssetHealthSnapshot {
  /** 0~100 — 잔여 수명 % (낮을수록 위험) */
  remainingPct: number;
  /** worst 부품 이름 */
  componentName: string;
  /** worst 부품 상태 */
  componentStatus: ComponentStatus;
  /** worst 부품 타입 (선택) */
  componentType: CraneComponent['componentType'];
}

export interface AssetComponentStats {
  /** 잎(개별 부품) 컴포넌트 총 개수 */
  total: number;
  /** 비정상 상태별 개수 */
  caution: number;
  warning: number;
  critical: number;
  replace: number;
  /** 정상 개수 */
  normal: number;
  /** 비정상(정상 아님) 총 개수 */
  issues: number;
}

/** 잎 컴포넌트(개별 부품)만 집계 — 클러스터 롤업 컴포넌트는 제외 */
function computeComponentStats(components: CraneComponent[]): AssetComponentStats {
  const leaves = components.filter((c) => c.parentId !== null);
  const stats: AssetComponentStats = {
    total: leaves.length,
    caution: 0,
    warning: 0,
    critical: 0,
    replace: 0,
    normal: 0,
    issues: 0,
  };
  for (const c of leaves) {
    stats[c.status] += 1;
    if (c.status !== 'normal') stats.issues += 1;
  }
  return stats;
}

function computeWorstHealth(components: CraneComponent[]): AssetHealthSnapshot | null {
  // "건강도 최저"는 잔여 수명이 가장 적은 부품 — 상세의 부품 수명 탭이 쓰는 최악 기준과
  // 동일하게 루트 클러스터에서 고른다(둘이 다른 부품을 가리켜 카드↔상세가 모순되던 것 해소).
  // 상태 심각도는 별도 '구성품' 타일이 이미 보여주므로 여기선 잔여 수명만 본다.
  const clusters = components.filter((c) => c.parentId === null);
  const pool = clusters.length > 0 ? clusters : components;
  if (pool.length === 0) return null;
  const usedRatio = (c: CraneComponent) =>
    c.expectedLifeHours > 0 ? Math.min(1, c.currentHours / c.expectedLifeHours) : 0;
  let worst = pool[0];
  for (const c of pool) {
    const diff = usedRatio(c) - usedRatio(worst);
    // 잔여 수명 최저(=소모율 최고) 우선, 동률이면 상태 심각도로 결정
    if (diff > 0 || (diff === 0 && STATUS_SEVERITY[c.status] > STATUS_SEVERITY[worst.status])) {
      worst = c;
    }
  }
  const remainingPct = Math.max(0, Math.round((1 - usedRatio(worst)) * 100));
  return {
    remainingPct,
    componentName: worst.componentName,
    componentStatus: worst.status,
    componentType: worst.componentType,
  };
}

function pickLatestDate(...dates: Array<string | null | undefined>): string | null {
  let latest: string | null = null;
  for (const d of dates) {
    if (!d) continue;
    if (!latest || new Date(d).getTime() > new Date(latest).getTime()) {
      latest = d;
    }
  }
  return latest;
}

export function useAssetList() {
  useEntityTicks(['asset', 'repair', 'inspection']);
  const assets = getAllCraneAssets();
  const summary = getAssetSummary();

  const allInspections = getAllInspectionWOs();
  const allRepairs = getAllRepairWOs();

  const craneInspectionMap: Record<string, { overdueCount: number }> = {};
  for (const wo of allInspections) {
    if (wo.status === 'overdue') {
      craneInspectionMap[wo.craneId] = {
        overdueCount: (craneInspectionMap[wo.craneId]?.overdueCount ?? 0) + 1,
      };
    }
  }

  const craneRepairMap: Record<string, { activeCount: number }> = {};
  for (const wo of allRepairs) {
    if (ACTIVE_REPAIR_STATUSES.has(wo.status)) {
      craneRepairMap[wo.craneId] = {
        activeCount: (craneRepairMap[wo.craneId]?.activeCount ?? 0) + 1,
      };
    }
  }

  // Per-crane health + last activity + component stats
  const craneHealthMap: Record<string, AssetHealthSnapshot> = {};
  const craneComponentStatsMap: Record<string, AssetComponentStats> = {};
  const craneLastActivityMap: Record<string, string> = {};
  const craneNextInspectionMap: Record<string, string> = {};

  // 다가오는 예정 점검(가장 빠른 scheduled/overdue) 집계
  for (const wo of allInspections) {
    if (wo.status === 'completed' || wo.status === 'cancelled') continue;
    const prev = craneNextInspectionMap[wo.craneId];
    if (!prev || new Date(wo.scheduledDate).getTime() < new Date(prev).getTime()) {
      craneNextInspectionMap[wo.craneId] = wo.scheduledDate;
    }
  }

  // 마지막 점검/수리 일자 집계
  const lastInspectionByAsset: Record<string, string | null> = {};
  for (const wo of allInspections) {
    if (!wo.actualDate) continue;
    const prev = lastInspectionByAsset[wo.craneId];
    if (!prev || new Date(wo.actualDate).getTime() > new Date(prev).getTime()) {
      lastInspectionByAsset[wo.craneId] = wo.actualDate;
    }
  }
  const lastRepairByAsset: Record<string, string | null> = {};
  for (const wo of allRepairs) {
    if (!wo.actualEnd) continue;
    const prev = lastRepairByAsset[wo.craneId];
    if (!prev || new Date(wo.actualEnd).getTime() > new Date(prev).getTime()) {
      lastRepairByAsset[wo.craneId] = wo.actualEnd;
    }
  }

  for (const asset of assets) {
    const components = getComponentsByCraneId(asset.id);
    const health = computeWorstHealth(components);
    if (health) craneHealthMap[asset.id] = health;
    craneComponentStatsMap[asset.id] = computeComponentStats(components);
    const last = pickLatestDate(
      lastInspectionByAsset[asset.id],
      lastRepairByAsset[asset.id],
    );
    if (last) craneLastActivityMap[asset.id] = last;
  }

  return {
    assets,
    summary,
    craneInspectionMap,
    craneRepairMap,
    craneHealthMap,
    craneComponentStatsMap,
    craneLastActivityMap,
    craneNextInspectionMap,
  };
}

export function useAssetDetail(craneId: string) {
  const { i18n } = useTranslation();
  const isKo = i18n.language === 'ko';
  useEntityTicks(['asset', 'repair', 'inspection']);

  const asset = getCraneAssetById(craneId);
  const components = getComponentsByCraneId(craneId);

  // 이력 탭은 최신순(예정일 내림차순) — 생성순으로 뒤섞여 보이던 것 해소
  const inspections: InspectionWO[] = getAllInspectionWOs()
    .filter((w) => w.craneId === craneId)
    .map((w) =>
      isKo && w.findings_ko ? { ...w, findings: w.findings_ko } : w,
    )
    .sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime());

  const repairs: RepairWO[] = getAllRepairWOs()
    .filter((w) => w.craneId === craneId)
    .map((w) =>
      isKo
        ? {
            ...w,
            componentName: w.componentName_ko ?? w.componentName,
            failureDescription: w.failureDescription_ko ?? w.failureDescription,
          }
        : w,
    )
    .sort((a, b) => new Date(b.scheduledStart).getTime() - new Date(a.scheduledStart).getTime());

  return { asset, components, inspections, repairs };
}
