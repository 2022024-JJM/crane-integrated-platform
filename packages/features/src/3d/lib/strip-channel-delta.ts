import { Quaternion, Vector3 } from 'three';
import {
  degToRad,
  type RigAxis,
  type TagMappingChannel,
} from '@crane/domain/3d';

/** 드라이버가 한 노드에 적용한 채널 Δ 하나. 적용 순서대로 나열된다. */
export interface ChannelDelta {
  channel: TagMappingChannel;
  axis: RigAxis;
  delta: number;
}

export interface ChannelPose {
  position: Vector3;
  quaternion: Quaternion;
  scale: Vector3;
}

const AXES: Record<RigAxis, Vector3> = {
  x: new Vector3(1, 0, 0),
  y: new Vector3(0, 1, 0),
  z: new Vector3(0, 0, 1),
};

const _q = new Quaternion();

/**
 * `apply-channel.ts` 의 역연산 — Δ 가 섞인 자세에서 Δ 를 벗겨 rest(배치값)를
 * 얻는다. 기즈모 드래그는 화면의 `rest + Δ` 자세 위에서 일어나므로, 커밋과
 * handoff 가 그 절대 자세를 그대로 배치값으로 삼으면 Δ 가 저장값에 흡수돼
 * 다음 프레임에 한 번 더 더해진다(모델이 Δ 만큼 더 가 있다).
 *
 * - rotation: 적용은 `q = rest ∘ R1 ∘ R2 …`(post-multiply) 이므로 **역순**으로
 *   `q ∘ Rn⁻¹ ∘ … ∘ R1⁻¹`.
 * - position: 부모 프레임 축 이동을 부모 scale 로 나눠 더했으므로 같은 값을 뺀다.
 * - scale: 더한 무차원 Δ 를 뺀다.
 *
 * 순서가 섞여 있어도(위치·회전·크기 채널 교대) 채널이 서로 독립이라 회전만
 * 역순이 의미 있다. 비유한·0 Δ 는 적용 쪽과 같이 건너뛴다. 자리에서 바꾼다.
 */
export function stripChannelDeltas(
  pose: ChannelPose,
  deltas: ReadonlyArray<ChannelDelta>,
  parentScale: number,
): ChannelPose {
  for (let i = deltas.length - 1; i >= 0; i -= 1) {
    const { channel, axis, delta } = deltas[i];
    const d = Number.isFinite(delta) ? delta : 0;
    if (d === 0) continue;
    if (channel === 'rotation') {
      pose.quaternion.multiply(
        _q.setFromAxisAngle(AXES[axis], degToRad(d)).invert(),
      );
      continue;
    }
    if (channel === 'position') {
      pose.position[axis] -= parentScale > 0 ? d / parentScale : d;
      continue;
    }
    pose.scale[axis] -= d;
  }
  return pose;
}
