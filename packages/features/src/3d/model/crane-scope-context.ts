import { createContext, useContext } from 'react';
import type { CraneScope } from '@crane/domain/monitoring';

/**
 * 화면이 보는 크레인 스냅샷 서버 범위 — 깊은 곳(에디터 인스펙터의 크레인 칸·
 * 태그 연결 다이얼로그)이 prop 사슬 없이 범위를 읽는다. 화면은 region 으로
 * 정한 값(`getCraneScopeByRegion`)을 `CraneScopeContext.Provider` 로 내린다.
 * 없으면 null — 피드를 켜지 않는다.
 */
export const CraneScopeContext = createContext<CraneScope | null>(null);

export function useCraneScope(): CraneScope | null {
  return useContext(CraneScopeContext);
}
