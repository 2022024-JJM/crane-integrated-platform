import { useEffect, useMemo } from 'react';
import { useVirtualTagStore } from './use-virtual-tag-store';

/**
 * 가상 태그 목록 — 태그 연결 다이얼로그의 가상 탭과 카드 칩(이름·단위)이
 * 본다. 실시간(서버) 태그는 여기 합치지 않는다 — 다이얼로그의 실시간 탭이
 * 크레인 스냅샷 스토어에서 크레인별로 직접 고른다(widgets/3d
 * ui/tag-pick-realtime-tab.tsx). `source` 는 항목의 출처 표시용이다.
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
