import {
  COLLISION_LINE_COLOR,
  COLLISION_LINE_WIDTH,
  ModelSelectionBox,
} from '@crane/domain/3d';
import { useSceneCollisionStore } from '../model/use-scene-collision-store';

/**
 * 충돌한 두 메쉬에 빨간 박스를 그린다. `ModelSelectionBox` 에 `target` 을
 * 주면 그 노드에 포털로 붙어 노드의 움직임을 씬 그래프 상속으로 따라간다
 * (선택 박스와 같은 구조, 색만 다르다). Canvas 안에 둔다.
 */
export function SceneCollisionHighlight() {
  const report = useSceneCollisionStore((s) => s.report);
  if (!report) return null;
  return (
    <>
      {[report.a, report.b].map((party) => (
        <ModelSelectionBox
          key={`${report.id}:${party.node.uuid}`}
          clone={party.node}
          target={party.node}
          isSelected
          color={COLLISION_LINE_COLOR}
          lineWidth={COLLISION_LINE_WIDTH}
        />
      ))}
    </>
  );
}
