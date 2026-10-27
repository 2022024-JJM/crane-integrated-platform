import { useEffect } from 'react';
import { rigValueStore } from './rig-value-store';
import { setActiveTagSource, type TagSourceId } from './tag-value-bus';

/**
 * 화면이 떠 있는 동안 버스의 활성 소스를 건다(lib/tag-source.ts 가 모드에서
 * 만든 값). 소스가 바뀌면 값 저장소를 비워 이전 소스의 자세가 남지 않게 하고
 * (시나리오에 없는 태그는 rest 로), 버스 쪽 live 캐시는 `setActiveTagSource`
 * 가 비운다. 언마운트하면 게이트를 푼다(null = 전부 통과 — 3D 뷰가 없는
 * 화면).
 *
 * 전환 순서는 중요하지 않다 — 부모(`Play3dView`)의 이탈 정리가 이 effect
 * 뒤에 publish 해도 소스가 달라 게이트가 버린다.
 */
export function useActiveTagSource(source: TagSourceId): void {
  useEffect(() => {
    setActiveTagSource(source);
    rigValueStore.reset();
    return () => {
      setActiveTagSource(null);
    };
  }, [source]);
}
