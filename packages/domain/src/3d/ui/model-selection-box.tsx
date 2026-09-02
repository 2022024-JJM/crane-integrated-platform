import { Line } from '@react-three/drei';
import { createPortal } from '@react-three/fiber';
import { Fragment, useMemo } from 'react';
import type { Object3D } from 'three';
import { getCachedLocalBoundingBoxPoints } from '../lib/selection-bounding-box';
import {
  SELECTION_LINE_COLOR,
  SELECTION_LINE_WIDTH,
} from '../lib/selection-style';

interface ModelSelectionBoxProps {
  clone: Object3D;
  isSelected: boolean;
  /**
   * 선택 box를 그릴 대상 객체. 주어지지 않으면 clone 전체를 박스로 그린다.
   * 모델 안쪽 노드가 선택된 경우 그 노드를 넘기면 박스가 노드에 좁혀지고,
   * 라인이 노드 자식으로 마운트돼 노드의 움직임(리그 드라이버 등)을 따라간다.
   */
  target?: Object3D | null;
}

const noRaycast = () => null;

/**
 * 박스 점은 마운트 대상의 로컬 좌표로 계산한다(`selection-bounding-box.ts`).
 * 라인을 대상 Object3D 의 자식으로 두면 부모 transform(TransformControls 가
 * 매 frame mutate 하는 것 포함)을 씬 그래프가 상속시켜 주므로 useFrame 동기화가
 * 필요 없다 — 이전 구현은 매 프레임 invalidate 를 강제해 R3F on-demand 렌더링을
 * 무력화했다.
 *
 * - clone 박스: ModelMesh 의 `<primitive object={clone}>` 자식으로 그냥 렌더.
 * - 노드 박스: clone 자식으로 두면 clone 로컬 좌표가 필요하고 노드 회전을
 *   못 따라가므로 `createPortal` 로 노드 자체에 마운트한다.
 *
 * 포털은 반드시 `target.uuid` 를 key 로 다시 마운트한다. R3F `Portal` 은
 * 컨테이너를 layout effect 에서 갱신되는 ref 로 읽는데, 컨테이너가 바뀌면
 * 새 store 를 렌더 중에 만들면서 아직 이전 ref 를 참조해 `scene` 이 이전
 * 노드로 잡힌다. 그러면 새 노드 기준으로 계산한 점이 이전 노드의 자식으로
 * 붙어, 두 노드의 scale 차이(양자화 GLB 는 노드 scale 이 0.19~127 까지 제각각)
 * 만큼 박스가 커지거나 작아지고 위치도 어긋난다. key 로 컴포넌트를 새로
 * 만들면 ref 초기값이 올바른 컨테이너라 이 경로를 타지 않는다.
 */
export function ModelSelectionBox({
  clone,
  isSelected,
  target,
}: ModelSelectionBoxProps) {
  const mountTarget = target ?? clone;
  const points = useMemo(() => {
    if (!isSelected) {
      return null;
    }
    return getCachedLocalBoundingBoxPoints(mountTarget);
  }, [isSelected, mountTarget]);

  if (!isSelected || !points) {
    return null;
  }

  // depthTest=false + renderOrder 1 → 모델 안쪽이어도 항상 보임.
  // raycast 차단: R3F가 primitive 자식까지 재귀 raycast하므로, 두꺼운 선이
  // 클릭 대상(event.object)이 되어 mesh path 계산에 끼어들지 않도록 한다.
  const line = (
    <Line
      segments
      points={points}
      color={SELECTION_LINE_COLOR}
      lineWidth={SELECTION_LINE_WIDTH}
      depthTest={false}
      renderOrder={1}
      raycast={noRaycast}
    />
  );

  return target ? (
    <Fragment key={target.uuid}>{createPortal(line, target)}</Fragment>
  ) : (
    line
  );
}
