import { useCallback, useMemo, useState } from 'react';
import type { CraneAsset, CraneComponent } from '@crane/domain/asset';
import { getCraneZoneConfig } from '@crane/domain/3d';
import { Crane3dViewer } from './crane-3d-viewer';
import { ZoneSpecPanel, type ZoneClusterGroup } from './zone-spec-panel';

/**
 * 자산 상세 "3D" 탭 — 좌측 3D 크레인(구역 hover/클릭 선택),
 * 우측 선택 구역의 BOM 부품 재원 패널.
 */
export function Asset3dTab({
  asset,
  components,
}: {
  asset: CraneAsset;
  components: CraneComponent[];
}) {
  const [selectedZoneKey, setSelectedZoneKey] = useState<string | null>(null);
  const [hoveredZoneKey, setHoveredZoneKey] = useState<string | null>(null);
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);

  const zoneConfig = useMemo(() => getCraneZoneConfig(asset.craneType), [asset.craneType]);
  const zoneKeys = useMemo(() => zoneConfig.zones.map((z) => z.key), [zoneConfig]);

  // 클러스터 루트: id = `comp-{craneId}-{clusterKey}` → clusterKey 역파싱
  const clusterEntries = useMemo(() => {
    const prefix = `comp-${asset.id}-`;
    const childrenByParent = new Map<string, CraneComponent[]>();
    for (const c of components) {
      if (c.parentId) {
        const list = childrenByParent.get(c.parentId) ?? [];
        list.push(c);
        childrenByParent.set(c.parentId, list);
      }
    }
    const byClusterKey = new Map<string, ZoneClusterGroup>();
    for (const c of components) {
      if (c.parentId !== null) continue;
      const clusterKey = c.id.startsWith(prefix) ? c.id.slice(prefix.length) : c.id;
      byClusterKey.set(clusterKey, { cluster: c, parts: childrenByParent.get(c.id) ?? [] });
    }
    return byClusterKey;
  }, [asset.id, components]);

  const clusterGroups = useMemo(() => {
    if (!selectedZoneKey) return [];
    const zone = zoneConfig.zones.find((z) => z.key === selectedZoneKey);
    if (!zone) return [];
    return zone.clusterKeys
      .map((key) => clusterEntries.get(key))
      .filter((g): g is ZoneClusterGroup => Boolean(g));
  }, [selectedZoneKey, zoneConfig, clusterEntries]);

  const selectedPart = useMemo(() => {
    if (!selectedPartId) return null;
    return components.find((c) => c.id === selectedPartId) ?? null;
  }, [selectedPartId, components]);

  const handleZoneSelect = useCallback((key: string | null) => {
    setSelectedZoneKey((prev) => (prev === key ? null : key));
    setSelectedPartId(null);
  }, []);

  return (
    <div className="grid grid-cols-1 gap-4 pt-4 lg:h-[calc(100vh-172px)] lg:grid-cols-[minmax(0,1fr)_380px]">
      <Crane3dViewer
        craneType={asset.craneType}
        zoneConfig={zoneConfig}
        hoveredZoneKey={hoveredZoneKey}
        selectedZoneKey={selectedZoneKey}
        onZoneHover={setHoveredZoneKey}
        onZoneSelect={handleZoneSelect}
        className="h-[440px] lg:h-full"
      />
      <ZoneSpecPanel
        zoneKeys={zoneKeys}
        selectedZoneKey={selectedZoneKey}
        hoveredZoneKey={hoveredZoneKey}
        onZoneHover={setHoveredZoneKey}
        onZoneSelect={handleZoneSelect}
        clusterGroups={clusterGroups}
        selectedPart={selectedPart}
        onSelectPart={setSelectedPartId}
        hasBomData={components.length > 0}
        className="max-h-[440px] lg:h-full lg:max-h-full"
      />
    </div>
  );
}
