import { useEffect, useMemo } from 'react';
import type {
  VirtualEquipment,
  VirtualTagDataType,
  VirtualTagGroup,
} from '@crane/domain/virtual-tag';
import { useVirtualTagStore } from './use-virtual-tag-store';

/**
 * 가상 태그 카탈로그 — 태그 연결 다이얼로그의 가상 탭(장비 › 그룹 › 태그)과
 * 카드 칩(이름·단위)이 본다. 실시간(서버) 태그는 여기 합치지 않는다 —
 * 다이얼로그의 실시간 탭이 크레인 스냅샷 스토어에서 크레인별로 직접 고른다
 * (widgets/3d ui/tag-pick-realtime-tab.tsx). 꺼진 장비·태그도 들어 있다 —
 * 씬이 연결해 둔 키를 "미등록" 으로 오판하지 않기 위해서다.
 */
export interface TagCatalogEntry {
  /** 값 버스 키 `장비키:코드`. */
  key: string;
  /** 표시명. 비면 코드. */
  name: string;
  code: string;
  equipmentId: string;
  /** 장비 ID 표시용(`GC-04`). */
  craneId: string;
  dataType: VirtualTagDataType;
  unit?: string;
  min: number;
  max: number;
  groupId?: string;
  groupName?: string;
  enabled: boolean;
  source: 'virtual';
}

export interface TagCatalogEquipment {
  id: string;
  craneId: string;
  name?: string;
  bay?: string;
  enabled: boolean;
  groups: VirtualTagGroup[];
  entries: TagCatalogEntry[];
}

function toCatalogEquipment(
  equipment: VirtualEquipment,
  entriesByEquipment: Map<string, TagCatalogEntry[]>,
): TagCatalogEquipment {
  return {
    id: equipment.id,
    craneId: equipment.craneId,
    name: equipment.name,
    bay: equipment.bay,
    enabled: equipment.enabled,
    groups: equipment.groups,
    entries: entriesByEquipment.get(equipment.id) ?? [],
  };
}

function useLoadedStore() {
  const load = useVirtualTagStore((s) => s.load);
  useEffect(() => {
    void load();
  }, [load]);
}

/** 평탄 목록 — 칩·검색이 키로 찾는다. */
export function useTagCatalog(): TagCatalogEntry[] {
  useLoadedStore();
  const entries = useVirtualTagStore((s) => s.entries);
  return useMemo(
    () =>
      entries.map(({ key, equipment, tag }) => {
        const group = tag.groupId
          ? equipment.groups.find((g) => g.id === tag.groupId)
          : undefined;
        return {
          key,
          name: tag.name || tag.code,
          code: tag.code,
          equipmentId: equipment.id,
          craneId: equipment.craneId,
          dataType: tag.dataType,
          unit: tag.unit,
          min: tag.min,
          max: tag.max,
          groupId: group?.id,
          groupName: group?.name,
          enabled: equipment.enabled && tag.enabled,
          source: 'virtual' as const,
        };
      }),
    [entries],
  );
}

/** 장비 단위 — 태그 연결 다이얼로그의 가상 탭이 왼쪽 목록·그룹 머리글을 그린다. */
export function useTagCatalogEquipments(): TagCatalogEquipment[] {
  const catalog = useTagCatalog();
  const equipments = useVirtualTagStore((s) => s.equipments);
  return useMemo(() => {
    const byEquipment = new Map<string, TagCatalogEntry[]>();
    for (const entry of catalog) {
      const list = byEquipment.get(entry.equipmentId) ?? [];
      list.push(entry);
      byEquipment.set(entry.equipmentId, list);
    }
    return equipments.map((e) => toCatalogEquipment(e, byEquipment));
  }, [catalog, equipments]);
}
