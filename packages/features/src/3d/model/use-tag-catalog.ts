import { useEffect, useMemo } from 'react';
import { useVirtualTagStore } from './use-virtual-tag-store';

/**
 * 태그 콤보박스가 보는 목록. 소스별 항목을 한 모양으로 합친다.
 *
 * 지금은 가상 태그 스토어뿐이다. 실서버가 붙으면 `getMonitoringTags()`
 * (`@crane/domain/monitoring`) 결과를 `source: 'server'` 로 여기서 합치면
 * 콤보박스·맵핑 UI 는 손대지 않아도 된다.
 */
export interface TagCatalogEntry {
  key: string;
  name: string;
  unit?: string;
  min?: number;
  max?: number;
  source: 'virtual' | 'server';
}

export function useTagCatalog(): TagCatalogEntry[] {
  const load = useVirtualTagStore((s) => s.load);
  const tags = useVirtualTagStore((s) => s.tags);
  useEffect(() => {
    void load();
  }, [load]);
  return useMemo(
    () =>
      tags.map((t) => ({
        key: t.key,
        name: t.name || t.key,
        unit: t.unit,
        min: t.min,
        max: t.max,
        source: 'virtual' as const,
      })),
    [tags],
  );
}
