import { CollisionGuard } from './collision-guard';
import { CollisionGuardCameraRig } from './collision-guard-camera-rig';
import { useGoliathCollisionZones } from '../model/use-goliath-collision-zones';

/**
 * 충돌 감지 표시의 씬 레이어 — Monitoring3dView 의 sceneExtras 슬롯(Canvas 안).
 *
 * 존은 그 region 씬의 골리앗 크레인 배치에서 파생한다 — 크레인이 이동하면
 * 존도 따라온다. 크레인이 없는 씬에서는 아무것도 그리지 않는다.
 */
export function CollisionGuardSceneLayer({ regionId }: { regionId: string }) {
  const derived = useGoliathCollisionZones(regionId);

  if (!derived) return null;

  return (
    <>
      <CollisionGuard zones={derived.zones} groundMaps={derived.groundMaps} />
      {/* 에고 프레이밍: 토글 ON에 크레인 중심 상공으로 날아가고, OFF에
          진입 직전 시점으로 되돌아온다. 카메라 조작으로 인한 자동 진입은
          두지 않는다 — 토글이 유일한 트리거라야 복귀 지점이 명확하다. */}
      <CollisionGuardCameraRig pose={derived.egoTopPose} duration={0.9} />
    </>
  );
}
