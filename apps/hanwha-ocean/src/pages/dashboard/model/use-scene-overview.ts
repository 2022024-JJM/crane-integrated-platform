import { useEffect, useMemo, useState } from 'react';
import { loadSceneInfoByRegionId } from '@crane/domain/3d';
import { getRegionTitleKey, type Region } from '@crane/domain/region';
import { useSceneInfoStore } from '@crane/features/3d';
import type { DashboardEquipmentRow } from './types';

/**
 * 씬 배치 기반 지역 개요 — 캔버스 없이 씬 JSON 만 읽는다.
 * `useSceneInfoStore` 캐시(모니터링 방문 시 채워짐)를 우선 쓰고, 없으면
 * `loadSceneInfoByRegionId`(fetch 전용, Canvas 불필요)로 직접 로드해 같은
 * 캐시에 넣는다 — 뒤에 모니터링 페이지로 이동해도 재로드가 없다.
 * 실패한 region 은 재시도하지 않고 null(개수 미상)로 남긴다.
 */

export interface SceneOverview {
  /** region 별 장비(모델) 수. 로드 전·실패면 null. */
  equipmentCountByRegion: Record<string, number | null>;
  /** 태그 맵핑이 있는 장비만 — 라이브 상태 섹션 대상. */
  equipment: DashboardEquipmentRow[];
}

export function useSceneOverview(regions: Region[]): SceneOverview {
  const sceneInfoByRegion = useSceneInfoStore(
    (state) => state.sceneInfoByRegion,
  );
  const [failedRegionIds, setFailedRegionIds] = useState<readonly string[]>([]);

  useEffect(() => {
    let cancelled = false;
    const { sceneInfoByRegion: cached, setSceneInfo } =
      useSceneInfoStore.getState();
    for (const region of regions) {
      if (cached[region.id] || failedRegionIds.includes(region.id)) continue;
      loadSceneInfoByRegionId(region.id)
        .then((info) => {
          if (!cancelled) setSceneInfo(region.id, info);
        })
        .catch((error: unknown) => {
          console.warn(
            `[dashboard] Failed to load scene for region ${region.id}.`,
            error,
          );
          if (!cancelled) {
            setFailedRegionIds((ids) =>
              ids.includes(region.id) ? ids : [...ids, region.id],
            );
          }
        });
    }
    return () => {
      cancelled = true;
    };
  }, [regions, failedRegionIds]);

  return useMemo(() => {
    const equipmentCountByRegion: Record<string, number | null> = {};
    const equipment: DashboardEquipmentRow[] = [];
    for (const region of regions) {
      const sceneInfo = sceneInfoByRegion[region.id];
      if (!sceneInfo) {
        equipmentCountByRegion[region.id] = null;
        continue;
      }
      equipmentCountByRegion[region.id] = sceneInfo.models.length;
      for (const model of sceneInfo.models) {
        const tagKeys = [
          ...new Set(
            (model.tagMappings ?? []).map((mapping) => mapping.tagKey),
          ),
        ];
        if (tagKeys.length === 0) continue;
        equipment.push({
          modelId: model.id,
          equipName: model.equipName,
          regionTitleKey: getRegionTitleKey(region.id),
          tags: tagKeys.map((tagKey) => ({ tagKey, label: tagKey, unit: null })),
        });
      }
    }
    return { equipmentCountByRegion, equipment };
  }, [regions, sceneInfoByRegion]);
}
