import { useEffect, useMemo, useRef } from 'react';
import type { SavedSceneInfo } from '@crane/domain/3d';
import {
  buildTagMappingIndex,
  resolveFromIndex,
  type TagMappingIndex,
} from '../lib/tag-mapping-index';
import { createTagBindingSource, rigValueStore } from './rig-value-store';
import { setTagIngest } from './tag-value-bus';

/**
 * 태그 값 버스 → 값 저장소 연결의 수명 관리.
 *
 * enabled 인 동안 씬의 tagMappings 로 만든 인덱스가 버스 값을 관절·node 맵핑
 * 주소로 흘려보낸다. 씬이 바뀌면 인덱스만 갈아 끼우고(재시작 없음), 꺼지면
 * 버스에서 떨어지고 값 저장소를 비워 노드가 rest 로 돌아간다. 모니터링 뷰와
 * 에디터 모두 화면이 떠 있는 동안 항상 켜 두고(언마운트가 곧 off), 재생
 * 일시정지는 러너 틱만 멈춰 노드가 마지막 값에 머문다 — 정지를 여기 off 에
 * 물리면 정지할 때마다 rest 로 튄다.
 *
 * 버스 소비자는 하나뿐이라(setTagIngest 단일 슬롯) 같은 화면에 두 번 두지
 * 않는다. 모니터링 뷰와 에디터 페이지가 각각 한 번씩 쓴다.
 */
export function useTagBindingSource(
  sceneInfo: SavedSceneInfo | null,
  enabled: boolean,
): void {
  const index = useMemo(() => buildTagMappingIndex(sceneInfo), [sceneInfo]);
  // resolve 가 최신 인덱스를 보도록 ref 에 두되, 갱신은 effect 에서만
  // (react-hooks/refs — 렌더 중 ref 접근 금지). 소스는 effect 안에서 만들어
  // 렌더 시점에 ref 를 읽는 클로저가 생기지 않게 한다.
  const indexRef = useRef<TagMappingIndex>(index);
  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  useEffect(() => {
    if (!enabled) return;
    const source = createTagBindingSource((key) =>
      resolveFromIndex(indexRef.current, key),
    );
    source.start(rigValueStore);
    setTagIngest(source.ingest);
    return () => {
      setTagIngest(null);
      source.stop();
      rigValueStore.reset();
    };
  }, [enabled]);
}
