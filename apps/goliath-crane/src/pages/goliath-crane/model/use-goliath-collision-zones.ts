import { useMemo } from 'react';
import { useSceneInfoStore } from '@crane/features/3d';
import {
  buildGoliathCollisionZones,
  buildGoliathEgoTopPose,
} from '../config/goliath-collision-zone';

const GOLIATH_REGION_ID = 'goliath';
const CRANE_MODEL_PATH = 'goliath_crane';

/**
 * 씬에 배치된 골리앗 크레인의 현재 transform으로부터 충돌 감지 존과
 * FSD 카메라 포즈를 파생한다. 크레인 위치는 계속 바뀌므로(레일 주행,
 * 씬 편집) 하드코딩 대신 씬 정보 스토어를 구독한다 — 씬이 다시 로드되거나
 * 배치가 갱신되면 존/카메라도 함께 따라온다.
 *
 * 씬 로드 전이나 크레인 모델이 없으면 null을 반환한다.
 */
export function useGoliathCollisionZones() {
  const sceneInfo = useSceneInfoStore(
    (s) => s.sceneInfoByRegion[GOLIATH_REGION_ID],
  );

  return useMemo(() => {
    const crane = sceneInfo?.models.find((model) =>
      model.path.includes(CRANE_MODEL_PATH),
    );
    if (!crane) return null;
    return {
      zones: buildGoliathCollisionZones(crane.position, crane.rotation[1]),
      egoTopPose: buildGoliathEgoTopPose(crane.position, crane.rotation[1]),
      // 현재 소비처 없음 — CollisionGuardTopViewSync(카메라 주목 자동 ON)의
      // 입력이었다. 자동 진입을 되살릴 때 그대로 쓴다.
      craneCenter: [crane.position[0], crane.position[2]] as [number, number],
    };
  }, [sceneInfo]);
}
