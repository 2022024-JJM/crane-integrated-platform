import { useMemo } from 'react';
import { CODE_ASSETS, resolveGroundMaps } from '@crane/domain/3d';
import {
  buildGoliathCollisionZones,
  buildGoliathEgoTopPose,
} from '../lib/goliath-collision-zone';
import { useSceneInfoStore } from './use-scene-info-store';

/**
 * 씬에 배치된 골리앗 크레인의 현재 transform으로부터 충돌 감지 존과
 * 에고 카메라 포즈를 파생한다. 크레인 위치는 계속 바뀌므로(레일 주행,
 * 씬 편집) 하드코딩 대신 씬 정보 스토어를 구독한다 — 씬이 다시 로드되거나
 * 배치가 갱신되면 존/카메라도 함께 따라온다.
 *
 * 크레인은 자산 참조(`asset.id`)로 찾는다 — 파일 경로는 자산의 새 버전마다
 * 바뀔 수 있고, 코드에 GLB 경로를 적지 않는다. 같은 자산이 여럿이면 첫 모델을
 * 쓴다(필리 4도크는 GC-04 한 대).
 *
 * 씬 로드 전이나 크레인 모델이 없으면 null을 반환한다.
 */
export function useGoliathCollisionZones(regionId: string) {
  const sceneInfo = useSceneInfoStore((s) => s.sceneInfoByRegion[regionId]);

  return useMemo(() => {
    const crane = sceneInfo?.models.find(
      (model) => model.asset?.id === CODE_ASSETS.goliathCrane.id,
    );
    if (!crane) return null;
    return {
      zones: buildGoliathCollisionZones(crane.position, crane.rotation[1]),
      // 존 지면 높이의 기준 — 드롭 raycast 와 같은 바닥 지도(터레인 제외).
      groundMaps: resolveGroundMaps(sceneInfo.maps),
      egoTopPose: buildGoliathEgoTopPose(crane.position, crane.rotation[1]),
    };
  }, [sceneInfo]);
}
